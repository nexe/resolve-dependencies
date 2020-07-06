import * as fs from 'fs'
import { sync as glob } from 'globby'
import { join, dirname } from 'path'
import { gatherDependencies } from './gather-deps'
import {
  File,
  createFile,
  isNodeModule,
  ensureDottedRelative,
  JsLoaderOptions,
  nodeModuleGlobs,
  extraGlobs,
} from './file'
import { ResolverFactory, CachedInputFileSystem, NodeJsInputFileSystem } from 'enhanced-resolve'

const { readFileSync, lstatSync, statSync, realpathSync } = fs

interface Resolver {
  resolve: (context: any, path: string, request: string, resolveContext: any, callback: any) => void
}

const fileSystem = new CachedInputFileSystem(new NodeJsInputFileSystem(), 4000) as any,
  resolver = ResolverFactory.createResolver({
    extensions: ['.js', '.json', '.node'],
    symlinks: false,
    fileSystem: new CachedInputFileSystem(new NodeJsInputFileSystem(), 4000) as any,
  }) as Resolver,
  syncResolver = ResolverFactory.createResolver({
    extensions: ['.js', '.json', '.node'],
    useSyncFileSystemCalls: true,
    symlinks: false,
    fileSystem,
  }) as Resolver,
  defaultOptions: Partial<JsLoaderOptions> = { loadContent: true, expand: 'none', isEntry: false }

export type Resolved = { absPath: string; pkgPath: string; pkg: any; warning: string }

export function resolveSync(from: string, request: string): Resolved {
  const result = {
    absPath: '',
    pkgPath: '',
    pkg: null,
    warning: '',
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

export function resolve(from: string, request: string): Promise<Resolved> {
  const result = {
    absPath: '',
    pkgPath: '',
    pkg: null,
    warning: '',
  }
  return new Promise((resolve) => {
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

async function expand(file: File, fileDir: string, baseDir: string, globs: string[] | string) {
  const files = glob(globs, {
    cwd: baseDir,
    followSymbolicLinks: false,
  })
  files
    .sort() //glob search is width first and not deterministic
    .map((dep) => ensureDottedRelative(fileDir, join(baseDir, dep)))
    .filter((relDep) => file.absPath !== join(baseDir, relDep))
    .forEach((relDep) => {
      file.deps[relDep] = file.deps[relDep] || null
    })
  const currentDeps = Object.keys(file.deps)
  file.package &&
    file.package.dependencies &&
    Object.keys(file.package.dependencies || {}).forEach((dependency) => {
      if (!currentDeps.some((curDep) => curDep.startsWith(dependency))) {
        file.deps[dependency] = file.deps[dependency] || null
      }
    })
}

export function load(
  workingDirectory: string,
  request: string,
  options = defaultOptions
): File | { warning: string } {
  const { absPath, pkg, pkgPath, warning } = resolveSync(workingDirectory, request)
  if (!absPath) {
    return { warning: warning }
  }
  const file = createFile(absPath),
    isJs = absPath.endsWith('.js') || absPath.endsWith('.mjs') || options.isEntry

  file.absPath = absPath

  if (isJs || absPath.endsWith('json')) {
    file.contents = readFileSync(absPath, 'utf-8')
  }

  if (isJs) {
    try {
      const parseResult = gatherDependencies(file.contents, absPath.endsWith('.mjs'))
      Object.assign(file.deps, parseResult.deps)
      file.variableImports = parseResult.variable
    } catch (e) {
      return { warning: `Error parsing file: "${file.absPath}"\n${e.stack}` }
    }
  }

  const fileDir = dirname(file.absPath),
    expandVariable = Boolean(options.expand === 'variable' && file.variableImports)

  if (isNodeModule(request) && pkg && pkgPath) {
    file.package = pkg
    file.deps[ensureDottedRelative(fileDir, pkgPath)] = null
    const pkgDir = (file.moduleRoot = dirname(pkgPath)),
      expandAll = options.expand === 'all'
    if (expandVariable || expandAll) {
      expand(file, fileDir, pkgDir, nodeModuleGlobs(file))
      file.contextExpanded = true
    }
    if (extraGlobs(file).length) {
      expand(file, fileDir, pkgDir, extraGlobs(file))
    }
  } else if (expandVariable && options.context?.moduleRoot && !options.context.expanded) {
    expand(
      file,
      fileDir,
      options.context.moduleRoot,
      nodeModuleGlobs({ package: { files: options.context.globs } })
    )
    file.contextExpanded = true
  }

  if (!options.loadContent) {
    file.contents = null
  }
  const stats = lstatSync(file.absPath)
  if (stats.isSymbolicLink()) {
    const path = realpathSync(file.absPath)
    const absStat = statSync(file.absPath)
    file.realPath = path
    file.realSize = absStat.size
  }
  file.size = stats.size
  return file
}
