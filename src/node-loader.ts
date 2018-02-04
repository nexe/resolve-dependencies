import { readFileSync } from 'fs'
import { join, sep, normalize } from 'path'
import * as babel from 'babel-core'
import { File, createFile } from './file'
import * as Resolve from 'enhanced-resolve'

//SOMEDAY use maintained regex https://github.com/systemjs/systemjs/issues/1733
const esmRegEx = /(^\s*|[}\);\n]\s*)(import\s*(['"]|(\*\s+as\s+)?(?!type)([^"'\(\)\n; ]+)\s*from\s*['"]|\{)|export\s+\*\s+from\s+["']|export\s*(\{|default|function|class|var|const|let|async\s+function))/
const notNodeModule = /^\.|^\//
const trailingSep = /[\\/]+$/

function isNodeModule(name: string) {
  return !notNodeModule.test(name)
}

function tryGetPackage(file: File) {
  try {
    return JSON.parse(readFileSync(join(file.moduleRoot!, 'package.json'), 'utf-8'))
  } catch (e) {
    process.stderr.write(
      `[ERROR]: Can't find package.json for package with entry file: ${file.absPath}\n`
    )
    return {}
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
    entryFile.split(join('node_modules', request))[0],
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
      return (file.deps[arg.node.value] = file.deps[arg.node.value] || createFile(''))
    }
    if (arg && arg.isTemplateLiteral() && arg.node.quasis.length === 1) {
      const dep = arg.gnode.quasis[0].value.cooked
      return (file.deps[dep] = file.deps[dep] || createFile(''))
    }
    file.variableImports = true
  }
}

export function resolve(from: string, request: string) {
  try {
    return Resolve.sync(from, request)
  } catch (e) {
    process.stderr.write('[WARN]: ' + e.message + '\n')
  }
}

export function load(wd: string, request: string) {
  const absPath = resolve(wd, request)
  if (!absPath) {
    return null
  }
  const file = createFile(request)
  file.absPath = absPath

  if (absPath.endsWith('.node')) {
    return file
  }

  const fileContents = readFileSync(absPath, 'utf-8')
  file.contents = fileContents

  if (absPath.endsWith('.json')) {
    return file
  }

  const sourceType = fileContents.match(esmRegEx) ? 'module' : 'script'
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

  if (isNodeModule(request)) {
    //Assumptions: module folder is module name, and package.json exists
    file.moduleRoot = getModuleRoot(file.absPath, request)
    file.package = tryGetPackage(file)
  }

  if (~file.absPath.indexOf('node_modules') && sourceType === 'script') {
    //avoid extra work...
    plugins = plugins.slice(2)
    code = false
  }

  const result = babel.transform(fileContents, {
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
