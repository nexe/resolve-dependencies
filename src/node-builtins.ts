const builtins =
  require('module').builtinModules ||
  Object.keys((process as any).binding('natives'))
    .filter((x) => !/^_|^internal|\//.test(x))
    .sort()

export default builtins
