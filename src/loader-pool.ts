import { File, FileMap, isNodeModule, ensureDottedRelative } from './file'
import { resolve, dirname } from 'path'
import { WorkerThread } from './worker'
import builtins from './node-builtins'
const cpus = require('os').cpus().length
import { ResolveDepOptions } from './options'

export class Loader {
  private pool: WorkerThread[] = []
  private starting: WorkerThread[]
  private ended: boolean = false
  private workerOptions: ResolveDepOptions
  private size = cpus - 1
  private currentWorker = 0
  private initializing: Promise<undefined> | undefined

  constructor(private options: ResolveDepOptions) {
    this.starting = [...Array(this.size)].map(x => new WorkerThread({ taskConccurency: 100 }))
    this.workerOptions = { ...options, files: {} }
  }

  initialize() {
    if (this.initializing) {
      return this.initializing
    }
    this.ended = false
    //initailize all, but only wait for the first one
    return (this.initializing = Promise.race(
      this.starting.map(x => {
        return x
          .sendMessage({
            modulePath: require.resolve('./node-loader'),
            contextName: 'node-loader',
            options: this.workerOptions
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
    this.pool.forEach(x => x.end())
  }

  private getWorker() {
    //todo wait for workers to warm up
    const worker = this.pool[this.currentWorker++]
    if (this.currentWorker === this.pool.length) {
      this.currentWorker = 0
    }
    return worker
  }

  loadEntry(wd: string, request: string, files: FileMap = {}, warnings = []) {
    const mainFile = ensureDottedRelative(wd, resolve(wd, request))
    return this.load(wd, mainFile, files, warnings).then(
      entry => {
        return { entry, files, warnings }
      },
      e => {
        throw e
      }
    )
  }

  private async load(
    cd: string,
    request: string,
    files: FileMap = {},
    warnings: string[]
  ): Promise<File | null> {
    const worker = this.getWorker()
    const file = await worker.sendMessage({
      contextName: 'node-loader',
      method: 'load',
      args: [cd, request, this.workerOptions]
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

    const fileDir = dirname(file.absPath)

    await Promise.all(
      Object.keys(file.deps).map(req => {
        if (~builtins.indexOf(req)) {
          return (file.deps[req] = null as any)
        }
        return this.load(fileDir, req, files, warnings).then(dep => {
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
