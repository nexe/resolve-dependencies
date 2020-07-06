import { resolve, dirname } from 'path'
import builtins from './node-builtins'
import * as loader from './node-loader'
import { ResolveDepOptions } from './options'
import { File, FileMap, ensureDottedRelative, nodeModuleGlobs, hasModuleGlobs } from './file'

export class Loader {
  constructor(private options: ResolveDepOptions) {}
  loadEntry(
    workingDirectory: string,
    request: string,
    files: FileMap = {},
    warnings = []
  ): { entry: File; files: FileMap; warnings: string[] } {
    const mainFile = ensureDottedRelative(workingDirectory, resolve(workingDirectory, request))
    console.log('MAIN', mainFile)

    const entry = this.load(workingDirectory, mainFile, files, warnings)
    return { entry: entry as File, files, warnings }
  }

  private load(
    cd: string,
    request: string,
    files: FileMap = {},
    warnings: string[],
    context?: any
  ): File | null {
    const options: Partial<ResolveDepOptions> = { ...this.options }
    if (context) {
      Object.assign(options, { context })
    }
    const file = loader.load(cd, request, options)
    if ('warning' in file) {
      warnings.push(file.warning)
      return null
    }

    if (files[file.absPath] !== undefined) {
      return files[file.absPath]
    } else {
      files[file.absPath] = file
    }

    const packageGlobs: string[] = []
    if (file.moduleRoot && hasModuleGlobs(file)) {
      packageGlobs.push(...nodeModuleGlobs(file, false))
    }

    if (!packageGlobs.length && hasModuleGlobs(file?.belongsTo || {})) {
      packageGlobs.push(...nodeModuleGlobs(file.belongsTo || {}, false))
    }

    const fileDir = dirname(file.absPath),
      ctx = {
        moduleRoot: file.moduleRoot || file.belongsTo?.moduleRoot || undefined,
        package: file.package,
        expanded: Boolean(file.contextExpanded),
        globs: packageGlobs,
      },
      rejectBuiltins = (req: string) => {
        if (~builtins.indexOf(req)) {
          file.deps[req] = null
          return false
        }
        return true
      }

    Object.keys(file.deps)
      .sort()
      .filter(rejectBuiltins)
      .map((req) => {
        const dep = (file.deps[req] = this.load(fileDir, req, files, warnings, ctx))
        if (dep) {
          dep.belongsTo = file.moduleRoot ? file : file.belongsTo
        }
      })
    return file
  }
}
