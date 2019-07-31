import { relative, sep } from 'path'

const esmRegex = /(^\s*|[}\);\n]\s*)(import\s*(['"]|(\*\s+as\s+)?(?!type)([^"'\(\)\n; ]+)\s*from\s*['"]|\{)|export\s+\*\s+from\s+["']|export\s*(\{|default|function|class|var|const|let|async\s+function))/

export function isScript(code: string) {
  return !Boolean(code.match(esmRegex))
}

export type JsLoaderOptions = {
  loadContent: boolean
  isEntry: boolean
  context?: {
    moduleRoot: string
    package: any
    expanded?: boolean
    globs?: string[]
  }
  expand: 'all' | 'variable' | 'none'
}

export type FileMap = { [key: string]: File | null }
export interface File {
  deps: FileMap
  belongsTo?: File
  absPath: string
  contents: string | null
  contextExpanded?: boolean
  variableImports?: boolean
  moduleRoot?: string
  package?: any
}

const variableImports = false
const notNodeModule = /^\.|^\//

export function isNodeModule(request: string) {
  return !notNodeModule.test(request)
}

export function ensureDottedRelative(from: string, to: string) {
  let rel = relative(from, to)
  if (!rel.startsWith('.')) {
    rel = './' + rel
  }
  return rel.split(sep).join('/')
}

export function createFile(absPath: string): File {
  return {
    deps: {},
    absPath,
    contents: null,
    variableImports
  }
}
