const builtinBlacklist = [
	'freelist',
	'sys'
];
const builtins = Object.keys((process as any).binding('natives'))
  .filter(x => !/^_|^internal|\//.test(x) && builtinBlacklist.indexOf(x) === -1)
  .sort();

export default builtins

