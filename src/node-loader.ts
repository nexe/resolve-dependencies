import { readFileSync, statSync } from 'fs'
import globby = require('globby')
import { join, sep, normalize, dirname, extname } from 'path'
import * as babel from 'babel-core'
import { File, createFile, isNodeModule, ensureDottedRelative } from './file'
import * as Resolve from 'enhanced-resolve'

//Module level configuration
let strict = true
export function initialize(config: any = {}) {
  strict = 'strict' in config ? Boolean(config.strict) : true
}

//SOMEDAY use maintained regex https://github.com/systemjs/systemjs/issues/1733
const esmRegEx = /(^\s*|[}\);\n]\s*)(import\s*(['"]|(\*\s+as\s+)?(?!type)([^"'\(\)\n; ]+)\s*from\s*['"]|\{)|export\s+\*\s+from\s+["']|export\s*(\{|default|function|class|var|const|let|async\s+function))/
const trailingSep = /[\\/]+$/
const trailingSlashes = /\/+$/

function tryGetPackage(file: File, packagePath: string) {
  try {
    return JSON.parse(readFileSync(packagePath, 'utf-8'))
  } catch (e) {
    process.stderr.write(
      `[ERROR]: Can't find package.json for package with entry file: ${file.absPath}\n`
    )
    return null
  }
}

function getModuleRoot(entryFile: string, request: string) {
  request = normalize(request)
  const reqSplits = request.split(sep)
  const moduleRoot = [reqSplits[0]]
  if (request.startsWith('@')) {
    moduleRoot.push(reqSplits[1])
  }
  const root = join(
    entryFile.split(join('node_modules', ...moduleRoot))[0],
    'node_modules',
    ...moduleRoot
  )
  return root.replace(trailingSep, '')
}

function captureDeps(nodePath: any, file: File) {
  const callee = nodePath.get('callee')
  if (callee.isIdentifier() && callee.equals('name', 'require')) {
    const arg = nodePath.get('arguments')[0]
    if (arg && arg.isStringLiteral()) {
      return (file.deps[arg.node.value] = null)
    }
    if (arg && arg.isTemplateLiteral() && arg.node.quasis.length === 1) {
      const dep = arg.gnode.quasis[0].value.cooked
      return (file.deps[dep] = null)
    }
    file.variableImports = true
  }
}

function resolveModuleFiles(file: File) {
  const cwd = file.moduleRoot!,
    main = dirname(file.absPath)
  let globs = '**/*'

  globby
    .sync(globs, { cwd })
    .map(filepath => {
      return ensureDottedRelative(main, join(cwd, filepath))
    })
    .concat(Object.keys(file.package.dependencies || {}))
    .reduce((deps, dep) => {
      deps[dep] = null
      return deps
    }, file.deps)

  return file
}

export function resolve(from: string, request: string) {
  try {
    return Resolve.sync(from, request)
  } catch (e) {
    process.stderr.write('[WARN]: ' + e.message + '\n')
  }
}

export function load(wd: string, request: string, options: any) {
  const absPath = resolve(wd, request)
  if (!absPath) {
    return null
  }
  const file = createFile(absPath)
  const isJs = absPath.endsWith('.js')

  file.absPath = absPath

  if (isJs || absPath.endsWith('.json')) {
    file.contents = readFileSync(absPath, 'utf-8')
  }

  if (!options.parse) {
    return file
  }

  if (isNodeModule(request) && file.contents) {
    //Assumptions: module folder is module name, and package.json exists
    file.moduleRoot = getModuleRoot(file.absPath, request)
    const pkgPath = join(file.moduleRoot, 'package.json')
    const packageInfo = tryGetPackage(file, pkgPath)
    if (packageInfo) {
      file.package = packageInfo
      file.deps[ensureDottedRelative(dirname(file.absPath), pkgPath)] = null
    } else {
      process.stderr.write(
        //TODO don't track errors like this...(racing threads)
        `[WARN]: package.json not found for: "${request}" in ${file.moduleRoot}\n`
      )
    }

    if (!strict) {
      return resolveModuleFiles(file)
    }
  }

  if (!isJs) {
    return file
  }

  const sourceType = file.contents.match(esmRegEx) ? 'module' : 'script'
  let code = true
  let plugins = [
    'babel-plugin-transform-es2015-modules-commonjs',
    'babel-plugin-dynamic-import-node',
    {
      visitor: {
        CallExpression: {
          enter: (nodePath: any) => {
            captureDeps(nodePath, file)
          }
        }
      }
    }
  ]

  if (sourceType === 'script') {
    //avoid generating code...
    plugins = plugins.slice(2)
    code = false
  }

  const result = babel.transform(file.contents, {
    sourceType,
    code,
    compact: true,
    plugins
  })

  if (code) {
    file.contents = result.code!
  }

  return file
}
