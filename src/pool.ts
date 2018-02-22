import { Semaphore } from '@calebboyd/semaphore'
import { Worker, WorkerThread, StandardWorker } from './worker'
const cpus = require('os').cpus().length
export { cpus }

export class Pool {
  private pool: Worker[] = []
  private inuse: Worker[] = []

  protected lock = new Semaphore(this.size)

  constructor(options: any, private size = cpus - 1, worker = WorkerThread) {
    this.pool = [...Array(this.size)].map(x => new worker('./node-loader', options))
  }

  protected end() {
    this.pool.forEach(x => x.end())
    this.inuse.forEach(x => x.end())
  }

  protected aqcuire() {
    const worker = this.pool.shift()!
    const i = this.inuse.push(worker) - 1
    const release = () => {
      this.pool.push(worker)
      this.inuse.splice(i, 1)
      this.lock.release()
    }
    return { worker, release }
  }
}
