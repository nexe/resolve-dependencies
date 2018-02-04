import { Semaphore } from '@calebboyd/semaphore'
import { createFile, File, FileMap } from './file'
import { Worker, WorkerThread, StandardWorker } from './worker'
import { dirname } from 'path'
import builtins from './node-builtins'

const cpus = require('os').cpus().length
export { cpus }

export class LoaderPool<T = any> {
  private pool: Worker[] = []
  private inuse: Worker[] = []
  private lock = new Semaphore(this.size)
  private depReqs: Promise<File>[] = []

  constructor(private size: number = cpus - 1, worker: any, options: any) {
    this.pool = [...Array(this.size)].map(x => new worker('./node-loader'))
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

  load(wd: string, request: string, files: FileMap) {
    return this._load(wd, request, files).then(async x => {
      this.kill()
      return x
    })
  }

  private _load(wd: string, request: string, files: FileMap): Promise<File | null> {
    return this.lock.acquire().then(async () => {
      const { worker, release } = this.aqcuire()
      let file: File
      let error: Error | null = null

      try {
        file = await worker.execute<File>('node-loader', 'load', [wd, request])
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

      if (files[file.absPath]) {
        return files[file.absPath]!
      } else {
        files[file.absPath] = file
      }

      const fileDir = dirname(file.absPath)

      return Promise.all(
        Object.keys(file.deps).map(req => {
          if (~builtins.indexOf(req)) {
            return (file.deps[req] = null as any)
          }
          return this._load(fileDir, req, files).then(dep => {
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
