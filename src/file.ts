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

export function createFile(absPath: string): File {
  return {
    deps: {},
    absPath,
    contents: '',
    variableImports
  }
}
