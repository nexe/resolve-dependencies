import * as path from 'path'
import * as resolve from 'enhanced-resolve'
import builtins from './node-builtins'
import { JsLoader } from './js-loader';
import { File, JSONObject } from './file'
import { isModuleDeclaration } from 'babel-types';

function resolveDependency (rootFile: string, request: string) {
  //return path.resolve(path.dirname(rootFile), request)
  return resolve.sync(path.dirname(rootFile), request)
}

function loadFile (
  files: Map<string, File>, 
  absPath: string, 
  loader = JsLoader, 
  context: ResolveContext = contexts.node, 
  packageJson?: JSONObject
) {
  const file = loader.create(absPath).load()
  if (!files.size) {
    files.set(absPath, file)
  }
  for(const [request] of file.dependencies) {
    if (context[request]) {
      continue
    }
    const resolvedDep = resolveDependency(absPath, request)
    let depFile = files.get(resolvedDep)
    let isModuleEntry = false
    if (!request.startsWith('.')) {
      //node module found...
      const packagePath = request.split('/')[0] + '/package.json'
      packageJson = require(resolveDependency(absPath, packagePath)) //todo FS?
      isModuleEntry = true
    }
    if (!depFile) {
      files.set(resolvedDep, depFile = loader.create(absPath))
      const tmp = loadFile(files, resolvedDep, loader, context, packageJson)
      depFile.copy(tmp)
    }
    depFile.isModuleEntry = isModuleEntry
    depFile.package = packageJson
    depFile.requests.add(request)
    file.dependencies.set(request, depFile)    
  }
  return file
}

type ResolveContext = { [key: string]: true | File }
const contexts: { [key: string]: ResolveContext } = {
  browser: {
    //maybe, probably not
  },
  node: builtins.reduce((ctx: { [key: string]: boolean }, builtin) => {
    ctx[builtin] = true
    return ctx
  }, {})
}
