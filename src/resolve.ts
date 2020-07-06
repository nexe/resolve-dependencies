import { Loader } from './loader'
import { File, Files } from './file'
import { ResolveDepOptions, normalizeOptions } from './options'
import { resolveSync } from './node-loader'

export default function resolveFiles(
  ...options: (Partial<ResolveDepOptions> | string)[]
): { entries: Files; files: Files; warnings: string[] } {
  const opts = normalizeOptions(options),
    loader = new Loader(opts)
  const res = opts.entries.map((request) => loader.loadEntry(opts.cwd, request, opts.files)),
    warnings: string[] = [],
    entries = opts.entries.sort().reduce((entryMap, entry, i) => {
      entryMap[entry] = res[i].entry as File
      warnings.push(...res[i].warnings)
      return entryMap
    }, {} as { [key: string]: File }),
    files = opts.files

  return { files: files as Files, entries, warnings }
}

export { File, Files, resolveSync }
