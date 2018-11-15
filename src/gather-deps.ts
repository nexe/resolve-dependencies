import { parse } from 'acorn'
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

function walk(node: any, visit: Function): void {
  if (!node || typeof node.type !== 'string' || node._visited) {
    return
  }
  visit(node)
  node._visited = true
  for (let childNode in node) {
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

export function gatherDependencies(code: string) {
  const result: { variable: boolean; deps: { [key: string]: any } } = {
      variable: false,
      deps: {}
    },
    visit = (node: any) => {
      if (node.type === 'CallExpression' && (isRequire(node) || isImport(node))) {
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
    }

  walk(
    parse(code, {
      ecmaVersion: 10,
      allowReserved: true,
      allowHashBang: true,
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      sourceType: isScript(code) ? 'script' : 'module'
    }),
    visit
  )

  return result
}
