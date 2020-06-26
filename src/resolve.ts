import { Loader } from './loader-pool'
import { File } from './file'
import { ResolveDepOptions, normalizeOptions } from './options'
import { resolveSync } from './node-loader'

function renderSortedObject(entries: [string, File | null][]) {
  return entries.sort().reduce((obj, [key, value]) => {
    return Object.assign(obj, { [key]: value })
  }, {})
}

export default async function resolve(...options: (Partial<ResolveDepOptions> | string)[]) {
  const opts = normalizeOptions(options),
    loader = new Loader(opts)
  await loader.setup()

  const res = await Promise.all(opts.entries.map((request) => loader.loadEntry(opts.cwd, request, opts.files))),
    warnings: string[] = [],
    entries = opts.entries.sort().reduce((entryMap, entry, i) => {
      entryMap[entry] = res[i].entry!
      warnings.push(...res[i].warnings)
      return entryMap
    }, {} as { [key: string]: File }),
    files = renderSortedObject(Object.entries(opts.files))
  loader.quit()
  return { files, entries, warnings }
}
export { resolve, resolveSync }
