import { fork } from 'child_process'
import { File } from './file'
import { Deferred, createDeferred, Semaphore } from '@calebboyd/async'

export type IpcArgs =
  | { modulePath: string; contextName: string; options?: any }
  | { contextName: string; method: string; args: any[] }

type IpcMessage = { result: any; error: string; id: number }
export class WorkerThread {
  private lock: Semaphore
  private pending: { [key: number]: Deferred<File | { warning: string }> } = {}
  private child = fork(require.resolve('./worker-runtime'))
  constructor({ taskConccurency = 10 } = {}) {
    this.lock = new Semaphore(taskConccurency)
    this.child.on('message', (message: IpcMessage) => {
      this.lock.release()
      const waiter = this.pending[message.id]
      delete this.pending[message.id]
      if (message.error) {
        waiter.reject(new Error(message.error))
      } else {
        waiter.resolve(message.result)
      }
    })
  }

  sendMessage(message: IpcArgs): Promise<File | { warning: string }> {
    return this.lock.acquire().then((id: number) => {
      this.child.send({ id, ...message })
      return (this.pending[id] = createDeferred<File | { warning: string }>()).promise
    })
  }

  end(): void {
    this.child.kill()
  }
}
