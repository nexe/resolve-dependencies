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

function getModuleRoot(entryFile: string, request: string) {
  console.log({ entryFile, request })
  request = normalize(request)
  const reqSplits = request.split(sep)
  const moduleRoot = [reqSplits[0]]
  if (request.startsWith('@')) {
    moduleRoot.push(reqSplits[1])
  }
  const root = join(entryFile.split(request)[0], ...moduleRoot)
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
  return Resolve.sync(from, request)
}

export function load(wd: string, request: string) {
  const absPath = resolve(wd, request)
  const file = createFile(request)
  file.absPath = absPath

  if (absPath.endsWith('.node')) {
    return file
  }

  const fileContents = readFileSync(absPath, 'utf-8')

  if (absPath.endsWith('.json')) {
    file.contents = fileContents
    return file
  }

  if (isNodeModule(request)) {
    //Assumptions: module folder is module name, and package.json exists
    file.moduleRoot = getModuleRoot(file.absPath, request)
    console.log(file.moduleRoot)
    file.package = JSON.parse(readFileSync(join(file.moduleRoot, 'package.json'), 'utf-8'))
  }
  const result = babel.transform(fileContents, {
    sourceType: fileContents.match(esmRegEx) ? 'module' : 'script',
    plugins: [
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
  })
  file.contents = result.code!
  return file
}
