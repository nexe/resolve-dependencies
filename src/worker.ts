import { fork } from 'child_process'
import { AnyJSON } from './file'

export class Worker {
  private child = fork(require.resolve('./worker-runtime'))
  private ready = false
  private starting = new Promise<boolean>((resolve) =>
      this.child.once('message', x => resolve(x === 'ready'))
    ).then(x => this.ready = x)

  constructor (module: string) {
    this.child.send({ module })
  }

  private onceReady(exec: () => Promise<any>) {
    if (this.ready) {
      this.onceReady = x => x()
      return exec()
    }
    return this.starting.then(() => exec())
  }

  execute (context: string, method: string, args?: AnyJSON) {
    const exec = () => {
      const response = new Promise((resolve, reject) => {
        this.child.once('message', (payload) => {
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

  kill () {
    this.child.kill()
  }
}
