import { readFile as fsReadFile } from 'fs'
import * as globby from 'globby'
import pify = require('pify')
import { join, dirname } from 'path'
import { gatherDependencies } from './gather-deps'
import { File, createFile, isNodeModule, ensureDottedRelative, JsLoaderOptions } from './file'
import { ResolverFactory, CachedInputFileSystem, NodeJsInputFileSystem } from 'enhanced-resolve'

const readFile = pify(fsReadFile)

interface Resolver {
  resolve: (context: any, path: string, request: string, resolveContext: any, callback: any) => void
}

const fileSystem = new CachedInputFileSystem(new NodeJsInputFileSystem(), 4000) as any,
  resolver = ResolverFactory.createResolver({
    extensions: ['.js', '.json', '.node'],
    fileSystem: new CachedInputFileSystem(new NodeJsInputFileSystem(), 4000) as any
  }) as Resolver,
  syncResolver = ResolverFactory.createResolver({
    extensions: ['.js', '.json', '.node'],
    useSyncFileSystemCalls: true,
    fileSystem
  }) as Resolver,
  moduleGlob = ['**/*', '!node_modules', '!test'],
  defaultOptions: JsLoaderOptions = { loadContent: true, expand: false, isEntry: false }

export function resolveSync(from: string, request: string) {
  let result = {
    absPath: '',
    pkgPath: '',
    pkg: null,
    warning: ''
  }
  syncResolver.resolve({}, from, request, {}, (err: Error | null, path: string, data: any) => {
    if (err) {
      result.warning = err.message
      return
    }
    result.absPath = path
    result.pkgPath = data.descriptionFilePath
    result.pkg = data.descriptionFileData
    return
  })
  return result
}

export function resolve(
  from: string,
  request: string
): Promise<{
  absPath: string
  pkgPath: string
  pkg: any
  warning: string
}> {
  let result = {
    absPath: '',
    pkgPath: '',
    pkg: null,
    warning: ''
  }
  return new Promise((resolve, reject) => {
    resolver.resolve({}, from, request, {}, (err: Error | null, path: string, data: any) => {
      if (err) {
        result.warning = err.message
        return resolve(result)
      }
      result.absPath = path
      result.pkgPath = data.descriptionFilePath
      result.pkg = data.descriptionFileData
      resolve(result)
    })
  })
}

async function expand(file: File, fileDir: string, baseDir: string, globs?: string[] | string) {
  const files = await globby(globs || moduleGlob, { cwd: baseDir })
  files
    .map(dep => ensureDottedRelative(fileDir, join(baseDir, dep)))
    .filter(relDep => file.absPath !== join(baseDir, relDep))
    .forEach(relDep => {
      file.deps[relDep] = file.deps[relDep] || null
    })
  const currentDeps = Object.keys(file.deps)
  file.package &&
    file.package.dependencies &&
    Object.keys(file.package.dependencies || {}).forEach(dependency => {
      if (!currentDeps.some(curDep => curDep.startsWith(dependency))) {
        file.deps[dependency] = file.deps[dependency] || null
      }
    })
}

export async function load(workingDirectory: string, request: string, options = defaultOptions) {
  let { absPath, pkg, pkgPath, warning } = await resolve(workingDirectory, request)
  if (!absPath) {
    return { warning: warning }
  }
  const file = createFile(absPath),
    isJs = absPath.endsWith('.js') || absPath.endsWith('.mjs') || options.isEntry

  file.absPath = absPath

  if (isJs || absPath.endsWith('json')) {
    file.contents = await readFile(absPath, 'utf-8')
  }

  if (isJs) {
    try {
      const parseResult = gatherDependencies(file.contents!, absPath.endsWith('.mjs') || undefined)
      Object.assign(file.deps, parseResult.deps)
      file.variableImports = parseResult.variable
    } catch (e) {
      return { warning: `Error parsing file: "${file.absPath}"\n${e.stack}` }
    }
  }

  const fileDir = dirname(file.absPath)

  if (isNodeModule(request) && pkg && pkgPath) {
    const pkgDir = (file.moduleRoot = dirname(pkgPath))
    file.package = pkg
    file.deps[ensureDottedRelative(fileDir, pkgPath)] = null
    if (options.expand === 'all' || (options.expand === 'variable' && file.variableImports)) {
      await expand(file, fileDir, pkgDir, file.package.files)
      file.contextExpanded = true
    }
  } else if (
    options.expand === 'variable' &&
    file.variableImports &&
    options.context &&
    !options.context.expanded
  ) {
    await expand(file, fileDir, options.context.moduleRoot, options.context.globs)
    file.contextExpanded = true
  }

  if (!options.loadContent) {
    file.contents = null
  }
  return file
}
