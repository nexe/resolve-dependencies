# resolve-dependencies

Given an entrypoint, get a map of files, with their contents, description and dependencies. 

File processing occurs concurrently in (CPUs - 1) child processes.

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


