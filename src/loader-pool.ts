import { File, FileMap, ensureDottedRelative, JsLoaderOptions } from './file'
import { resolve, dirname } from 'path'
import { WorkerThread } from './worker'
import builtins from './node-builtins'
import { cpus } from 'os'
import { ResolveDepOptions } from './options'

type context = Pick<JsLoaderOptions, 'context'>['context']

export class Loader {
  private pool: WorkerThread[] = []
  private starting: WorkerThread[]
  private ended = false
  private workerOptions: ResolveDepOptions
  private size: number
  private currentWorker = 0
  private initializing: Promise<undefined> | undefined

  constructor(private options: ResolveDepOptions) {
    const cores = (cpus() ?? []).length
    this.size = Number(process.env.RESOLVE_DEPENDENCIES_CPUS) || (cores > 2 ? cores - 1 : 1)
    this.starting = [...Array(this.size)].map((x) => new WorkerThread({ taskConccurency: 100 }))
    this.workerOptions = { ...options, files: {} }
  }

  setup() {
    if (this.initializing) {
      return this.initializing
    }
    this.ended = false

    //initailize all, but only wait for the first one
    return (this.initializing = Promise.race(
      this.starting.map((x) => {
        return x
          .sendMessage({
            modulePath: require.resolve('./node-loader'),
            contextName: 'node-loader',
            options: this.workerOptions,
          })
          .then(() => {
            if (this.ended) {
              x.end()
            }
            this.pool.push(x)
          })
      })
    ).then(() => undefined))
  }

  quit() {
    this.ended = true
    this.pool.forEach((x) => x.end())
  }

  private getWorker() {
    //todo wait for workers to warm up
    const worker = this.pool[this.currentWorker++]
    if (this.currentWorker === this.pool.length) {
      this.currentWorker = 0
    }
    return worker
  }

  loadEntry(workingDirectory: string, request: string, files: FileMap = {}, warnings = []) {
    const mainFile = ensureDottedRelative(workingDirectory, resolve(workingDirectory, request))
    return this.load(workingDirectory, mainFile, files, warnings).then(
      (entry) => {
        return { entry, files, warnings }
      },
      (e) => {
        throw e
      }
    )
  }

  private async load(
    cd: string,
    request: string,
    files: FileMap = {},
    warnings: string[],
    context?: any
  ): Promise<File | null> {
    const worker = this.getWorker()

    const options = {}
    if (context) {
      Object.assign(options, this.workerOptions, { context })
    } else {
      Object.assign(options, this.workerOptions)
    }

    const file = await worker.sendMessage({
      contextName: 'node-loader',
      method: 'load',
      args: [cd, request, options],
    })
    if ('warning' in file) {
      warnings.push(file.warning)
      return null
    }

    if (files[file.absPath] !== undefined) {
      return files[file.absPath]
    } else {
      files[file.absPath] = file
    }

    let packageGlobs: string[] | undefined = undefined
    if (file.moduleRoot && file.package && file.package.files) {
      packageGlobs = file.package.files
    }

    if (!packageGlobs && file.belongsTo && file.belongsTo.package && file.belongsTo.package.files) {
      packageGlobs = file.belongsTo.package.files
    }

    const fileDir = dirname(file.absPath)
    const ctx = {
      moduleRoot: file.moduleRoot || (file.belongsTo && file.belongsTo.moduleRoot) || undefined,
      package: file.package,
      expanded: Boolean(file.contextExpanded),
      globs: packageGlobs,
    }

    await Promise.all(
      Object.keys(file.deps).map((req) => {
        if (~builtins.indexOf(req)) {
          return (file.deps[req] = null as any)
        }
        return this.load(fileDir, req, files, warnings, ctx).then((dep) => {
          file.deps[req] = dep
          if ((file.moduleRoot || file.belongsTo) && dep && !dep.moduleRoot) {
            const owner = file.moduleRoot ? file : file.belongsTo
            dep.belongsTo = owner
          }
        })
      })
    )
    return file
  }
}
