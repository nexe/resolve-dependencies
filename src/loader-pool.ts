import { Pool } from './pool'
import { File, FileMap, isNodeModule, ensureDottedRelative } from './file'
import { resolve, dirname } from 'path'
import nodeResolve = require('resolve')
import { ResolveDepOptions } from './options'

export class Loader extends Pool {
  constructor(private options: ResolveDepOptions) {
    super(options)
  }

  public loadEntry(wd: string, request: string, files: FileMap = {}) {
    const mainFile = ensureDottedRelative(wd, resolve(wd, request))
    return this.load(wd, mainFile, files).then(
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

  private load(cwd: string, request: string, files: FileMap = {}): Promise<File | null> {
    return this.lock.acquire().then(async () => {
      const { worker, release } = this.aqcuire()
      let file: File
      let error: Error | null = null

      try {
        file = await worker.execute<File>('node-loader', 'load', [cwd, request, this.options])
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

      if (file.absPath in files) {
        return files[file.absPath]!
      } else {
        files[file.absPath] = file
      }

      const fileDir = dirname(file.absPath)

      return Promise.all(
        Object.keys(file.deps).map(req => {
          if (nodeResolve.isCore(req)) {
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
      ).then(() => file)
    })
  }
}
