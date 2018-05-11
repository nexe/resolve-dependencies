import { File, FileMap, isNodeModule, ensureDottedRelative } from './file'
import { resolve, dirname } from 'path'
import { WorkerThread } from './worker'
import builtins from './node-builtins'
const cpus = require('os').cpus().length
import { ResolveDepOptions } from './options'

export class Loader {
  private pool: WorkerThread[]
  private workerOptions: ResolveDepOptions
  private size = cpus - 1
  private idx = 0
  private initializing: Promise<any> | undefined

  constructor(private options: ResolveDepOptions) {
    this.pool = [...Array(this.size)].map(
      x => new WorkerThread({ taskConccurency: 10 })
    )
    this.workerOptions = { ...options, files: {} }
  }

  initialize() {
    if (this.initializing) {
      return this.initializing
    }
    return (this.initializing = Promise.all(
      this.pool.map(x =>
        x.sendMessage({
          modulePath: require.resolve('./node-loader'),
          contextName: 'node-loader',
          options: this.workerOptions
        })
      )
    ))
  }

  quit() {
    this.pool.forEach(x => x.end())
  }

  private getWorker() {
    const worker = this.pool[this.idx++]
    if (this.idx === this.pool.length) {
      this.idx = 0
    }
    return worker
  }

  loadEntry(wd: string, request: string, files: FileMap = {}) {
    const mainFile = ensureDottedRelative(wd, resolve(wd, request))
    return this.load(wd, mainFile, files).then(
      entry => {
        return { entry, files }
      },
      e => {
        throw e
      }
    )
  }

  private async load(
    cd: string,
    request: string,
    files: FileMap = {}
  ): Promise<File | null> {
    const worker = this.getWorker()
    const file = await worker.sendMessage({
      contextName: 'node-loader',
      method: 'load',
      args: [cd, request, this.workerOptions]
    })

    if (!file) {
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
        return this.load(fileDir, req, files).then(dep => {
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
