import { fork } from 'child_process'
import * as loader from './node-loader'

export interface Worker {
  execute<T>(context: string, method: string, args?: any): Promise<T>
  kill(): void
}

export class StandardWorker implements Worker {
  constructor(private bs: string) {}
  execute<T>(context: string, method: string, args?: any) {
    return Promise.resolve(loader.load.apply(null, args))
  }
  kill() {}
}
export class WorkerThread implements Worker {
  private child = fork(require.resolve('./worker-runtime'))
  private ready = false
  private starting = new Promise<boolean>(resolve =>
    this.child.once('message', x => resolve(x === 'ready'))
  ).then(x => (this.ready = x))

  constructor(module: string) {
    this.child.send({ module })
  }

  private onceReady(exec: () => Promise<any>) {
    if (this.ready) {
      this.onceReady = x => x()
      return exec()
    }
    return this.starting.then(() => exec())
  }

  execute<T>(context: string, method: string, args?: any): Promise<T> {
    const exec = () => {
      const response = new Promise((resolve, reject) => {
        this.child.once('message', payload => {
          if (payload.error) {
            return reject(payload.error)
          }
          resolve(payload.result)
        })
      })
      this.child.send({ context, method, args })
      return response
    }
    return this.onceReady(exec)
  }

  kill() {
    this.child.kill()
  }
}
