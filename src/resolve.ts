import { Loader } from './loader-pool'
import { File } from './file'
import { ResolveDepOptions, normalizeOptions } from './options'
import { resolveSync } from './node-loader'

export default async function resolve(...options: (Partial<ResolveDepOptions> | string)[]) {
  const opts = normalizeOptions(options),
    loader = new Loader(opts)
  await loader.setup()

  const res = await Promise.all(opts.entries.map((request) => loader.loadEntry(opts.cwd, request, opts.files))),
    warnings: string[] = [],
    entryMap = opts.entries.reduce((entryMap, entry, i) => {
      entryMap[entry] = res[i].entry!
      warnings.push(...res[i].warnings)
      return entryMap
    }, {} as { [key: string]: File })
  loader.quit()
  return { files: opts.files, entries: entryMap, warnings }
}
export { resolve, resolveSync }
