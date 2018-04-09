import { Loader } from './loader-pool'
import { File, FileMap } from './file'
import { ResolveDepOptions, normalizeOptions } from './options'
import { resolve as resolveFileName } from './node-loader'

import * as path from 'path'

export default async function resolve(...options: (Partial<ResolveDepOptions> | string)[]) {
  const opts = normalizeOptions(options),
    loader = new Loader(opts),
    res = await Promise.all(
      opts.entries.map(request => loader.loadEntry(opts.cwd, request, opts.files))
    ),
    entryMap = opts.entries.reduce(
      (entryMap, entry, i) => {
        entryMap[entry] = res[i].entry!
        return entryMap
      },
      {} as { [key: string]: File }
    )

  return { files: opts.files, entries: entryMap }
}
export { resolve, resolveFileName }
