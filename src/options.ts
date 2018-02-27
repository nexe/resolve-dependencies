export type ResolveDepOptions = { entries: string[]; cwd: string; strict: boolean }

export function normalizeOptions(args: Partial<ResolveDepOptions | string>[]) {
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
