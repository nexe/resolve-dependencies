export type JSONPrimitive = string | number | boolean | null
export interface JSONArray extends Array<AnyJSON> {}
export interface JSONObject { [key: string]: AnyJSON }
export type AnyJSON = JSONPrimitive | JSONArray | JSONObject
export interface File {
  dependencies: { [key: string]: File }
  absPath?: string
  requests: { [key: string]: string }
  contents: string
  variableImports: boolean
  package?: JSONObject
}

const variableImports = false

export function createFile (absPath?: string): File {
  return {
    dependencies: {},
    absPath,
    requests: {},
    contents: '',
    variableImports
  }
}

export function mergeFile (a: File, b: File): File {
  Object.assign(a.dependencies, b.dependencies)
  Object.assign(a.requests, b.requests)
  if (!a.contents && b.contents) {
    a.contents = b.contents
  }
  a.absPath = b.absPath = a.absPath || b.absPath  
  return a
}
