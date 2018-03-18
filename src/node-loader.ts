import { readFileSync, statSync } from 'fs'
import globby = require('globby')
import { join, sep, normalize, dirname, extname } from 'path'
import { gatherDependencies } from './gather-deps'
import { File, isScript, createFile, isNodeModule, ensureDottedRelative } from './file'
import nodeResolve = require('resolve')

export type JsLoaderOptions = {
  loadContent: boolean
  expand: boolean
}

const trailingSep = /[\\/]+$/
const trailingSlashes = /\/+$/
const trailingPkg = /package\.json$/
const extensions = ['.js', '.json', '.node']
const defaultOptions = { loadContent: true, expand: false }

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
    pkgDir: '',
    pkg: null
  }
  try {
    result.absPath = nodeResolve.sync(request, {
      basedir: from,
      extensions,
      packageFilter: (pkg, pkgDir) => {
        result.pkg = pkg
        result.pkgDir = pkgDir
        return pkg
      }
    })
  } catch (e) {
    if (!silent) {
      process.stderr.write('[WARN]: ' + e.message + '\n')
    }
  } finally {
    return result
  }
}

export function load(wd: string, request: string, options = defaultOptions) {
  let { absPath, pkg, pkgDir } = resolve(wd, request)
  if (!absPath) {
    return null
  }
  const file = createFile(absPath)
  const isJs = absPath.endsWith('.js')

  file.absPath = absPath

  if (isJs || absPath.endsWith('json')) {
    file.contents = readFileSync(absPath, 'utf-8')
  }

  if (isNodeModule(request)) {
    if (!pkg) {
      const resolution = resolve(wd, getPackageName(request), { silent: true })
      pkg = resolution.pkg
      pkgDir = resolution.pkgDir
    }
    if (pkg && pkgDir) {
      file.moduleRoot = pkgDir
      file.package = pkg
      file.deps[ensureDottedRelative(pkgDir, join(pkgDir, 'package.json'))] = null
      if (options.expand) {
        globby
          .sync('**/*', { cwd: pkgDir })
          .map(dep => ensureDottedRelative(pkgDir, join(pkgDir, dep)))
          .filter(relDep => file.absPath !== join(pkgDir, relDep))
          .forEach(relDep => {
            file.deps[relDep] = file.deps[relDep] || null
          })
      }
    }
  }

  if (isJs) {
    const parseResult = gatherDependencies(file.contents!)
    Object.assign(file.deps, parseResult.deps)
    file.variableImports = parseResult.variable
  }

  if (!options.loadContent) {
    file.contents = null
  }

  return file
}
