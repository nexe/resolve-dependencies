import { relative, sep } from 'path'

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
    contents: '',
    variableImports
  }
}
