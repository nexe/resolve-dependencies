<h2 align="center">resolve-dependencies</h2>

---

<p align="center"><code>npm i resolve-dependencies</code></p>

`resolve-dependencies` is the very originally named bundler for [nexe](https://github.com/nexe/nexe). It wasn't our intention to build a bundler but that is kind of what this is.

## Exports


### `resolve(options: Options, ...opts: Options[]): Promise<Result>`
  
  - `Options`: Object | string
    - `entries`:  string[]                              - a list of entrypoints to traverse, resolved against cwd
    - `cwd`:      string                                - the base directory that the resolution occurs from
    - `loadContent`: boolean                            - indicates that the content should be included int he FileMap (this may be unreasonable for large dependency trees)
    - `files`: ({ [key: string]: File | null })[]       - a cache of already resolved files
    - `expand`: 'all' | 'none' | 'variable'             - how module contexts should be expanded to include extra files

All options are deeply merged, string options are added as `entries`

Result returns a Promise of a result object:
  - `Result`: Object
    - `entries`: { [key: entry]: File } - all the entries as provided to the `resolve` method and the tree of connected `files`
    - `files`: { [key: absPath]: File } - all resolved files keyed by their absolute path
    - `warnings`: string[] - an array warnings generated while processing the `files`

A `File` has the following shape
  - `File`: Object
    - `size`: number
    - `absPath`: string
    - `moduleRoot`: string
    - `package`: any | undefined
    - `deps`: { [key: request]: File | null }
    - `belongsTo`: File | undefined
    - `realSize`: number | undefined
    - `realPath`: string | undefined
    - `contents`: string | null
    - `contextExpanded`: boolean
    - `variableImports`: boolean


## Example:

```javascript
import { resolve } from 'resolve-dependencies'

;(async () => {
  const { entries, files } = await resolve('./entry-file.js')
  console.log(entries['./entry-file.js'])
})()

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


