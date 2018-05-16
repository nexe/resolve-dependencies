import { readFile as fsReadFile } from 'fs'
import globby = require('globby')
import pify = require('pify')
const readFile = pify(fsReadFile)
import { join, sep, normalize, dirname, extname } from 'path'
import { gatherDependencies } from './gather-deps'
import { File, isScript, createFile, isNodeModule, ensureDottedRelative } from './file'
import { ResolverFactory, CachedInputFileSystem, NodeJsInputFileSystem } from 'enhanced-resolve'

export type JsLoaderOptions = {
  loadContent: boolean
  expand: boolean
}

function createResolver(useSyncFileSystemCalls = true) {
  const resolver = ResolverFactory.createResolver({
    extensions: ['.js', '.json', '.node'],
    useSyncFileSystemCalls: true,
    fileSystem: new CachedInputFileSystem(new NodeJsInputFileSystem(), 4000)
  } as any)

  return resolver.resolve.bind(resolver, {
    environments: ['node+es3+es5+process+native']
  })
}

const nodeResolve = createResolver(),
  asyncNodeResolve = createResolver(false),
  moduleGlob = ['**/*', '!node_modules', '!test'],
  identity = <T>(x: T) => x,
  defaultOptions = { loadContent: true, expand: false }

export function resolveSync(from: string, request: string) {
  let result = {
    absPath: '',
    pkgPath: '',
    pkg: null,
    warning: ''
  }
  nodeResolve(from, request, {}, (err: Error | null, path: string, data: any) => {
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
    asyncNodeResolve(from, request, {}, (err: Error | null, path: string, data: any) => {
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

export async function load(wd: string, request: string, options = defaultOptions) {
  let { absPath, pkg, pkgPath, warning } = await resolve(wd, request)
  if (!absPath) {
    return { warning: warning }
  }
  const file = createFile(absPath)
  const isJs = absPath.endsWith('.js')

  file.absPath = absPath

  if (isJs || absPath.endsWith('json')) {
    file.contents = await readFile(absPath, 'utf-8')
  }
  if (isJs) {
    try {
      const parseResult = gatherDependencies(file.contents!)
      Object.assign(file.deps, parseResult.deps)
      file.variableImports = parseResult.variable
    } catch (e) {
      return { warning: `Error parsing file: "${file.absPath}"\n${e.stack}` }
    }
  }

  if (isNodeModule(request)) {
    if (pkg && pkgPath) {
      const pkgDir = (file.moduleRoot = dirname(pkgPath))
      const fileDir = dirname(file.absPath)
      file.package = pkg
      file.deps[ensureDottedRelative(fileDir, pkgPath)] = null
      if (options.expand) {
        const files = await globby(file.package.files || moduleGlob, { cwd: pkgDir })
        files
          .map(dep => ensureDottedRelative(fileDir, join(pkgDir, dep)))
          .filter(relDep => file.absPath !== join(pkgDir, relDep))
          .forEach(relDep => {
            file.deps[relDep] = file.deps[relDep] || null
          })
        const currentDeps = Object.keys(file.deps)
        //when expand is set, include dependencies in the package.json that might be dynamically required
        Object.keys(file.package.dependencies || {}).forEach(dependency => {
          if (!currentDeps.some(curDep => curDep.startsWith(dependency))) {
            file.deps[dependency] = file.deps[dependency] || null
          }
        })
      }
    }
  }

  if (!options.loadContent) {
    file.contents = null
  }

  return file
}
