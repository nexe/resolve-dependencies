import { LoaderPool, cpus } from './loader-pool'
import { WorkerThread, StandardWorker } from './worker'
import { File, FileMap } from './file'
import { relative } from 'path'

export { resolve }
export default async function resolve(options: any) {
  const { cwd, entries } = normalizeOptions(options)
  const loader = new LoaderPool<File>(cpus - 1, WorkerThread, {
      unsafeCache: true,
      extensions: ['.js', '.mjs', '.json', '.node']
    }),
    files: FileMap = {},
    res = await Promise.all(
      entries.map(x => './' + relative(cwd, x)).map(request => loader.load(cwd, request, files))
    )

  const entryMap = entries.reduce((entryMap: FileMap, entry, i) => {
    entryMap[entry] = res[i]
    return entryMap
  }, {})

  return { files, entries: entryMap }
}

function normalizeOptions(options: any) {
  const entries: string[] = []
  let cwd = process.cwd()

  if (typeof options === 'string') {
    entries.push(options)
  }
  if (typeof options === 'object') {
    if (options.entries && options.entries.length) {
      entries.push(...options.entries)
    }
    if (options.cwd) {
      cwd = options.cwd
    }
  }

  if (!entries.length) {
    try {
      entries.push(require.resolve(process.cwd()))
    } catch (e) {
      throw new Error('No entry file found')
    }
  }
  return { cwd, entries }
}
