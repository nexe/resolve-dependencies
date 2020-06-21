import { relative, sep } from 'path'

const esmRegex = /(^\s*|[}\);\n]\s*)(import\s*(['"]|(\*\s+as\s+)?(?!type)([^"'\(\)\n; ]+)\s*from\s*['"]|\{)|export\s+\*\s+from\s+["']|export\s*(\{|default|function|class|var|const|let|async\s+function))/,
  moduleGlob = ['**/*', '!node_modules', '!test']

export function isScript(code: string) {
  return !Boolean(code.match(esmRegex))
}

export function hasModuleGlobs(file: Pick<File, 'package' | 'belongsTo'>) {
  return nodeModuleGlobs(file) !== moduleGlob
}

export function extraGlobs(file: Pick<File, 'package' | 'belongsTo'>) {
  const globs: string[] = []
  return globs
    .concat([file.package?.pkg?.scripts || []])
    .concat([file.package?.pkg?.assets || []])
    .flat()
}

export function nodeModuleGlobs(file: Pick<File, 'package' | 'belongsTo'>, useDefault = true): string[] {
  const normalGlobs = (file.package?.files || []).flat()
  if (useDefault && !normalGlobs.length) {
    return moduleGlob
  }
  return normalGlobs
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
    variableImports,
  }
}
