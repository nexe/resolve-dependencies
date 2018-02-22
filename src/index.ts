import { Loader } from './loader-pool'
import { WorkerThread, StandardWorker } from './worker'
import { File, FileMap, ensureDottedRelative } from './file'
import { relative } from 'path'

export { resolve }
export type ResolveOptions = { entries: string[]; cwd: string; strict: boolean }

export default async function resolve(...options: Partial<ResolveOptions | string>[]) {
  const opts = normalizeOptions(options),
    files: FileMap = {},
    loader = new Loader(options),
    res = await Promise.all(
      opts.entries
        .map(x => ensureDottedRelative(opts.cwd, x))
        .map(request => loader.loadEntry(opts.cwd, request, files))
    ),
    entryMap = opts.entries.reduce((entryMap: FileMap, entry, i) => {
      entryMap[entry] = res[i].entry
      return entryMap
    }, {})

  return { files, entries: entryMap }
}

function normalizeOptions(args: Partial<ResolveOptions | string>[]) {
  const options = {
    entries: [] as string[],
    cwd: process.cwd(),
    strict: true
  }

  args.forEach(x => {
    if (typeof x === 'string') return options.entries.push(x)
    if (x.cwd) options.cwd = x.cwd
    if (Array.isArray(x.entries)) options.entries.push(...x.entries)
    if ('strict' in x) options.strict = Boolean(x.strict)
  })

  options.entries = Array.from(new Set(options.entries))

  if (!options.entries.length) {
    try {
      options.entries.push(require.resolve(options.cwd))
    } catch (e) {
      throw new Error('No entry file found')
    }
  }
  return options
}
