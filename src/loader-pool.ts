import { Semaphore } from '@calebboyd/semaphore'
import { createFile, mergeFile, File } from './file'
import { Worker } from './worker'

const cpus = require('os').cpus().length

export { cpus }

export class LoaderPool<T = any> {  
  private pool = [...Array(this.size)].map(x => new Worker('./loader'))
  private visted: { [key: string]: true } = {}
  private lock = new Semaphore(this.size)
  constructor (private size: number = cpus - 1, options: any) {}

  kill () {
    this.pool.forEach(x => x.kill())
  }

  async load (filename: string, files: Map<string, File> ) {
    let file = createFile()
    if (!files.has(filename)) {
      files.set(filename, file)
    }
    mergeFile(file, await this._load(filename))
    return file
  }

  resolve (from: string, request: string) {
    return this.lock.acquire().then(async () => {
      const worker = this.pool.shift()!
      const result = await worker.execute('loader', 'resolve', [from, request])
      this.pool.push(worker)
      this.lock.release()
      return result
    })
  }

  private _load (filename: string): Promise<File> {
    return this.lock.acquire().then(async () => {      
      if (filename in this.visted) {
        this.lock.release()
        return null
      }      
      let worker = this.pool.shift()!

      this.visted[filename] = true      
      const file = await worker.execute('loader', 'load', [filename])
      this.pool.push(worker)
      this.lock.release()
      return file
    })
  }
}
