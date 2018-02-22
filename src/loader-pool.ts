import { Pool } from './pool'
import { File, FileMap, isNodeModule } from './file'
import { dirname } from 'path'
import builtins from './node-builtins'

export class Loader extends Pool {
  constructor(private options: any) {
    super(options)
  }

  public loadEntry(wd: string, request: string, files: FileMap = {}) {
    return this.load(wd, request, true, files).then(
      entry => {
        this.end()
        return { entry, files }
      },
      e => {
        this.end()
        throw e
      }
    )
  }

  private load(
    cwd: string,
    request: string,
    parse = true,
    files: FileMap = {}
  ): Promise<File | null> {
    return this.lock.acquire().then(async () => {
      const { worker, release } = this.aqcuire()
      let file: File
      let error: Error | null = null

      try {
        file = await worker.execute<File>('node-loader', 'load', [cwd, request, { parse }])
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
          let parseDep = true
          if (!this.options.strict && file.moduleRoot && !isNodeModule(req)) {
            parseDep = false
          }
          return this.load(fileDir, req, parseDep, files).then(dep => {
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
