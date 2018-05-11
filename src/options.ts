import { FileMap } from './file'

export type ResolveDepOptions = {
  entries: string[]
  cwd: string
  expand: boolean
  loadContent: boolean
  files: FileMap
}

export function normalizeOptions(args: Partial<ResolveDepOptions | string>[]): ResolveDepOptions {
  const options = {
    entries: [] as string[],
    cwd: process.cwd(),
    loadContent: true,
    expand: false,
    files: {} as FileMap
  }

  args.forEach(x => {
    if (typeof x === 'string') return options.entries.push(x)
    if (x.cwd) options.cwd = x.cwd
    if (Array.isArray(x.entries)) options.entries.push(...x.entries)
    if ('expand' in x) options.expand = Boolean(x.expand)
    if ('loadContent' in x) options.loadContent = Boolean(x.loadContent)
    if ('files' in x) Object.assign(options.files, x.files)
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
