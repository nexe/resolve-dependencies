import { readFileSync } from 'fs'
import * as babel from 'babel-core'
import { File, createFile } from './file'
import * as Resolve from 'enhanced-resolve'

const esmRegEx = /(^\s*|[}\);\n]\s*)(import\s*(['"]|(\*\s+as\s+)?(?!type)([^"'\(\)\n; ]+)\s*from\s*['"]|\{)|export\s+\*\s+from\s+["']|export\s*(\{|default|function|class|var|const|let|async\s+function))/

function captureDeps (nodePath: any, file: File) {
  const callee = nodePath.get('callee') 
  if (callee.isIdentifier() && callee.equals('name', 'require')) {
    const arg = nodePath.get('arguments')[0]
    if (arg && arg.isStringLiteral()) {
      return file.dependencies[arg.node.value] = file.dependencies[arg.node.value] 
        || createFile()
    }
    if (arg && arg.isTemplateLiteral() && arg.node.quasis.length === 1) {
      const dep = arg.gnode.quasis[0].value.cooked
      return file.dependencies[dep] = file.dependencies[dep] || createFile()
    }
    file.variableImports = true
  }
}

export function resolve (from: string, request: string) {
  return Resolve.sync(from, request)
}

export function load (filepath: string) {
  const fileContents = readFileSync(filepath, 'utf-8')
  const file = createFile(filepath)
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
