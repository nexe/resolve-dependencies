import { Loader } from './loader-pool'
import { WorkerThread, StandardWorker } from './worker'
import { File, FileMap, ensureDottedRelative } from './file'
import { ResolveDepOptions, normalizeOptions } from './options'

import * as path from 'path'

export { resolve }
export default async function resolve(...options: Partial<ResolveDepOptions | string>[]) {
  const opts = normalizeOptions(options),
    files: FileMap = {},
    loader = new Loader(opts),
    res = await Promise.all(
      opts.entries.map(request => loader.loadEntry(opts.cwd, request, files))
    ),
    entryMap = opts.entries.reduce((entryMap: FileMap, entry, i) => {
      entryMap[entry] = res[i].entry
      return entryMap
    }, {})

  return { files, entries: entryMap }
}
