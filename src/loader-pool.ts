import { Semaphore } from '@calebboyd/semaphore'
import { createFile, File, FileMap, isNodeModule } from './file'
import { Worker, WorkerThread, StandardWorker } from './worker'
import { dirname } from 'path'
import builtins from './node-builtins'

const cpus = require('os').cpus().length
export { cpus }

export class LoaderPool<T = any> {
  private pool: Worker[] = []
  private inuse: Worker[] = []
  private lock = new Semaphore(this.size)
  public files: FileMap = {}

  constructor(private size: number = cpus - 1, worker: any, private options: any = {}) {
    this.pool = [...Array(this.size)].map(x => new worker('./node-loader', options))
  }

  private kill() {
    this.pool.forEach(x => x.kill())
    this.inuse.forEach(x => x.kill())
  }

  private aqcuire() {
    const worker = this.pool.shift()!
    const i = this.inuse.push(worker) - 1
    const release = () => {
      this.pool.push(worker)
      this.inuse.splice(i, 1)
      this.lock.release()
    }
    return { worker, release }
  }

  load(wd: string, request: string) {
    return this._load(wd, request).then(async x => {
      this.kill()
      return x
    })
  }

  private _load(wd: string, request: string, parse = true): Promise<File | null> {
    return this.lock.acquire().then(async () => {
      const { worker, release } = this.aqcuire()
      let file: File
      let error: Error | null = null

      try {
        file = await worker.execute<File>('node-loader', 'load', [wd, request, { parse }])
      } catch (e) {
        error = e
      } finally {
        release()
        if (error) throw error
        file = file!
      }

      if (!file) {
        return null
      }

      if (this.files[file.absPath]) {
        return this.files[file.absPath]!
      } else {
        this.files[file.absPath] = file
      }

      const fileDir = dirname(file.absPath)

      return Promise.all(
        Object.keys(file.deps).map(req => {
          if (~builtins.indexOf(req)) {
            return (file.deps[req] = null as any)
          }
          let parseDep = true
          if (!this.options.strict && file.moduleRoot && !isNodeModule(req)) {
            parseDep = false
          }
          return this._load(fileDir, req, parseDep).then(dep => {
            file.deps[req] = dep
            if ((file.moduleRoot || file.belongsTo) && dep && !dep.moduleRoot) {
              const owner = file.moduleRoot ? file : file.belongsTo
              dep.belongsTo = owner
            }
          })
        })
      ).then(() => file)
    })
  }
}
