# resolve-dependencies

Given an entrypoint, get a map of files, with their contents, description and dependencies. 

File processing occurs concurrently in (CPUs - 1) child processes.

### `Options`

A string:
- an entrypoint to begin traversal from

An object:
- `entries`:  string[]                              - a list of entrypoints to traverse, resolved against cwd
- `cwd`:      string                                - the base directory that the resolution occurs from
- `loadContent`: boolean                            - indicates that the content should be included int he FileMap (this may be unreasonable for large dependency trees)
- `files`: ({ [key: string]: File | null })[]       - a cache of already resolved files
- `expand`: 'all' | 'none' | 'variable'             - how module contexts should be expanded to include extra files

Strings and Objects
- Strings are treated as entries
- Objects are merged


```javascript
import { resolve } from 'resolve-dependencies'

;(async () => {
  const { entries, files } = await resolve('./entry-file.js')
  console.log(entries['./entry-file.js'])
})()
// {
//   absPath: "/path/to/entry-file.js",
//   contents: "console.log('hello world')",
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
//         name: 'mkdirp'
//         ...
//       }
//     }
//   }
// }
//  `files` is a similar structure to entries, but 
//   is flat and keyed by the file's absolute path.
```


