import { parseScript, parseModule } from 'cherow'
import { isScript } from './file'

function isNodeAString(node: any) {
  return Boolean(node && (node.type === 'Literal' || node.type === 'StringLiteral'))
}

export function gatherDependencies(code: string) {
  const result: { variable: boolean; deps: { [key: string]: any } } = {
      variable: false,
      deps: {}
    },
    delegate = (node: any) => {
      if (!node) return
      if (node.type === 'CallExpression' && node.callee) {
        if (
          (node.callee.type === 'Identifier' && node.callee.name === 'require') ||
          node.callee.type === 'Import'
        ) {
          const request = node.arguments[0]
          if (isNodeAString(request)) {
            result.deps[request.value] = null
          } else {
            result.variable = true
          }
        }
      }
      if (node.type === 'ImportDeclaration' && isNodeAString(node.source)) {
        result.deps[node.source.value] = null
      }
    },
    options = { next: true, delegate }

  if (isScript(code)) {
    parseScript(code, options)
  } else {
    parseModule(code, options)
  }
  return result
}
