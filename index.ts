import { File } from './file'
import * as path from 'path'
import * as resolve from 'enhanced-resolve'

function resolveDependency (rootFile: string, request: string) {
  //return path.resolve(path.dirname(rootFile), request)
  return resolve.sync(path.dirname(rootFile), request)
}

function loadFile (files: Map<string, File>, absPath: string, fileAbstraction = File) {
  const file = fileAbstraction.load(absPath)
  if (!files.size) {
    files.set(absPath, file)
  }
  const deps = Array.from(file.dependencies.entries())
  for(const [request] of deps) {
    const resolvedDep = resolveDependency(absPath, request)
    let depFile = files.get(resolvedDep)
    if (!depFile) {
      files.set(resolvedDep, File.empty)
      depFile = loadFile(files, resolvedDep, fileAbstraction)
    }
    files.set(resolvedDep, depFile)
    depFile.requests.add(request)
    file.dependencies.set(request, depFile)    
  }
  return file
}

function collectFiles (entry: string, fileAbstraction = File) {
  const files = new Map()
  return {
    entry: loadFile(files, entry, fileAbstraction),
    files
  }
}

//collectFiles(path.resolve('./test-entry.js'))
