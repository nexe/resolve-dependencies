export type JSONPrimitive = string | number | boolean | null
export interface JSONArray extends Array<AnyJSON> {}
export interface JSONObject {
  [key: string]: AnyJSON
}
export type FileMap = { [key: string]: File | null }
export type AnyJSON = JSONPrimitive | JSONArray | JSONObject
export interface File {
  deps: FileMap
  absPath: string
  contents: string
  variableImports?: boolean
  moduleRoot?: string
  package?: JSONObject
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
