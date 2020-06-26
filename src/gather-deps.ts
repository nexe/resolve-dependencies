import { parse } from 'meriyah'
import { isScript } from './file'

function isNodeAString(node: any) {
  return Boolean(node && (node.type === 'Literal' || node.type === 'StringLiteral'))
}

function isRequire(node: any) {
  return node.callee.type === 'Identifier' && node.callee.name === 'require'
}

function isImport(node: any) {
  return node.callee.type === 'Import'
}

function walk(node: any, visit: (node: any) => void): void {
  if (!node || typeof node.type !== 'string' || node._visited) {
    return
  }
  visit(node)
  node._visited = true
  for (const childNode in node) {
    const child = node[childNode]
    if (Array.isArray(child)) {
      for (let i = 0; i < child.length; i++) {
        walk(child[i], visit)
      }
    } else {
      walk(child, visit)
    }
  }
}

export function gatherDependencies(code: string, isModule?: boolean) {
  const result: { variable: boolean; deps: { [key: string]: any } } = {
      variable: false,
      deps: {},
    },
    visit = (node: any) => {
      if (
        node.type === 'CallExpression' &&
        (isRequire(node) || isImport(node) || node.type === 'ImportExpression')
      ) {
        const request = node.arguments[0]
        if (isNodeAString(request)) {
          result.deps[request.value] = null
        } else {
          result.variable = true
        }
      }
      if (node.type === 'ImportDeclaration' && isNodeAString(node.source)) {
        result.deps[node.source.value] = null
      }
    },
    options = {
      globalReturn: true,
      next: true,
      module: isModule || !isScript(code),
      specDeviation: true,
    }

  walk(parse(code, options), visit)

  return result
}
