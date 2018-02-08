import { LoaderPool, cpus } from './loader-pool'
import { WorkerThread, StandardWorker } from './worker'
import { File, FileMap } from './file'
import { relative } from 'path'

export { resolve }
export type ResolveOptions = { entries: string[]; cwd: string; strict: boolean } | string

export default async function resolve(...options: Partial<ResolveOptions>[]) {
  const opts = parseOptions(options)
  const loader = new LoaderPool<File>(cpus - 1, WorkerThread, opts),
    res = await Promise.all(
      opts.entries
        .map(x => './' + relative(opts.cwd, x))
        .map(request => loader.load(opts.cwd, request))
    )

  const entryMap = opts.entries.reduce((entryMap: FileMap, entry, i) => {
    entryMap[entry] = res[i]
    return entryMap
  }, {})

  return { files: loader.files, entries: entryMap }
}

function parseOptions(args: Partial<ResolveOptions>[]) {
  const options = {
    entries: [] as string[],
    cwd: process.cwd(),
    strict: true
  }

  args.forEach(x => {
    if (typeof x === 'string') return options.entries.push(x)
    if (x.cwd) options.cwd = x.cwd
    if (x.entries && x.entries.length) options.entries.push(...x.entries)
    if ('strict' in x) options.strict = Boolean(x.strict)
  })

  const entries = new Set(options.entries)
  options.entries.length = 0
  options.entries.push(...Array.from(entries))

  if (!options.entries.length) {
    try {
      options.entries.push(require.resolve(options.cwd))
    } catch (e) {
      throw new Error('No entry file found')
    }
  }
  return options
}
