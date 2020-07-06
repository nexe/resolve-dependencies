<h2 align="center">resolve-dependencies</h2>

---

<p align="center"><code>npm i resolve-dependencies</code></p>

`resolve-dependencies` is the very originally named bundler for [nexe](https://github.com/nexe/nexe). It wasn't our intention to build a bundler but that is kind of what this is.

## Exports


### `default: resolveSync(options: Options, ...opts: Options[]): Promise<Result>`
  
  - `Options`: _Object | string_ -- the entry to start from (if string)
    - `entries`: _string[]_ -- a list of entrypoints to traverse, resolved against cwd
    - `cwd`: _string_ -- the base directory that the resolution occurs from
    - `loadContent`: _boolean_ -- indicates that the content should be included int he FileMap (this may be unreasonable for large dependency trees)
    - `files`: _({ [key: string]: File | null })[]_ -- a cache of already resolved files
    - `expand`: _'all' | 'none' | 'variable'_ -- how module contexts should be expanded to include extra files

All options are deeply merged, string options are added as `entries`

Result returns a Promise of a result object:
  - `Result`: _Object_
    - `entries`: _{ [key: entry]: File }_ - all the entries as provided to the `resolve` method and the tree of connected `files`
    - `files`: _{ [key: absPath]: File }_ - all resolved files keyed by their absolute path
    - `warnings`: _string[]_ - an array warnings generated while processing the `files`

A `File` has the following shape
  - `File`: _Object_ -- An object representing a file
    - `size`: _number_ -- file size of the link or file
    - `absPath`: _string_ -- absolute path to the file
    - `moduleRoot`: _string | undefined_ -- Directory containing a modules package.json
    - `package`: _any | undefined_
    - `deps`: _{ [key: request]: File | null }_ -- Dependencies identified in the file, keyed by request
    - `belongsTo`: _File | undefined_ -- The main file of the owning module
    - `realSize`: _number | undefined_ -- set to the realfile size if the absPath is a symlink
    - `realPath`: _string | undefined_ -- set to the realpath if the absPath is a symlink
    - `contents`: _string | null_
    - `contextExpanded`: _boolean_
    - `variableImports`: _boolean_


## Example:

```javascript
import resolveDependencies from 'resolve-dependencies'

const { entries, files } = resolveDependencies('./entry-file.js')
console.log(entries['./entry-file.js'])

// {
//   absPath: "/path/to/entry-file.js",
//   contents: "console.log('hello world')",
//   realSize: 26,
//   realPath: "/path/to/entry/lib/file.js"
//   size: 12
//   variableImports: false,
//   deps: {
//     "./dependency": {
//       absPath: "/path/to/dependency.js"
//       ...
//     },
//     path: null, //node builtin does not resolve
//     mkdirp: {
//       absPath: "/path/to/node_modules/mkdirp/index.js",
//       modulePath: "/path/to/node_modules/mkdirp",
//       package: {
//         name: "mkdirp"
//         ...
//       }
//     }
//   }
// }
//  `files` is a similar structure to entries, but 
//   is flat and keyed by the file's absolute path.
```


