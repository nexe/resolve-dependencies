import { relative } from 'path'

export type FileMap = { [key: string]: File | null }
export interface File {
  deps: FileMap
  belongsTo?: File
  absPath: string
  contents: string
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
  const rel = relative(from, to)
  if (!rel.startsWith('.')) {
    return './' + rel
  }
  return rel
}

export function createFile(absPath: string): File {
  return {
    deps: {},
    absPath,
    contents: '',
    variableImports
  }
}
