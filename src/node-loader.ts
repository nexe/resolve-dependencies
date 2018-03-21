import { readFileSync, statSync } from 'fs'
import globby = require('globby')
import { join, sep, normalize, dirname, extname } from 'path'
import { gatherDependencies } from './gather-deps'
import { File, isScript, createFile, isNodeModule, ensureDottedRelative } from './file'
import { ResolverFactory, CachedInputFileSystem, NodeJsInputFileSystem } from 'enhanced-resolve'

export type JsLoaderOptions = {
  loadContent: boolean
  expand: boolean
}

const resolver = ResolverFactory.createResolver({
    extensions: ['.js', '.json', '.node'],
    useSyncFileSystemCalls: true,
    fileSystem: new CachedInputFileSystem(new NodeJsInputFileSystem(), 4000)
  } as any),
  nodeResolve = resolver.resolve.bind(resolver, {
    environments: ['node+es3+es5+process+native']
  }),
  moduleGlob = ['**/*', '!node_modules'],
  defaultOptions = { loadContent: true, expand: false }

function getPackageName(request: string) {
  const parts = request.split('/')
  if (request.startsWith('@')) {
    parts.length = 2
    return parts.join('/')
  }
  return parts[0]
}

export function resolve(from: string, request: string, { silent = false } = {}) {
  let result = {
    absPath: '',
    pkgPath: '',
    pkg: null
  }
  try {
    let error = null
    nodeResolve(from, request, {}, (err: Error | null, path: string, data: any) => {
      if (err) {
        return (error = err)
      }
      result.absPath = path
      result.pkgPath = data.descriptionFilePath
      result.pkg = data.descriptionFileData
    })
    if (error) {
      throw error
    }
  } catch (e) {
    if (!silent) {
      process.stderr.write('[WARN]: ' + e.message + '\n')
    }
  } finally {
    return result
  }
}

export function load(wd: string, request: string, options = defaultOptions) {
  let { absPath, pkg, pkgPath } = resolve(wd, request)
  if (!absPath) {
    return null
  }
  const file = createFile(absPath)
  const isJs = absPath.endsWith('.js')

  file.absPath = absPath

  if (isJs || absPath.endsWith('json')) {
    file.contents = readFileSync(absPath, 'utf-8')
  }

  if (isJs) {
    try {
      const parseResult = gatherDependencies(file.contents!)
      Object.assign(file.deps, parseResult.deps)
      file.variableImports = parseResult.variable
    } catch (e) {
      process.stderr.write(`[ERROR]: Error parsing file: "${file.absPath}"\n${e.stack}\n`)
    }
  }

  if (isNodeModule(request)) {
    if (pkg && pkgPath) {
      const pkgDir = (file.moduleRoot = dirname(pkgPath))
      file.package = pkg
      file.deps[ensureDottedRelative(pkgDir, pkgPath)] = null
      if (options.expand) {
        globby
          .sync(file.package.files || moduleGlob, { cwd: pkgDir })
          .map(dep => ensureDottedRelative(pkgDir, join(pkgDir, dep)))
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
