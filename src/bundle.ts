import { LoaderPool, cpus } from './loader-pool'
import { File } from './file'
class Bundle {
  public fileCache: Map<string, File> = new Map()
  private loader: LoaderPool<File>
  private entries: string[]
  private cwd: string
  private resolver: any

  constructor ({ entries = [], cwd = process.cwd() }: { 
    entries?: string[], 
    cwd?: string } = {}
  ) {
    this.loader = new LoaderPool<File>(cpus - 1, {
      unsafeCache: true,
      extensions: ['.js','.mjs','.json','.node']
    })
    this.cwd = cwd
    this.entries = entries
  }

  resolve (from: string, request: string) {
    return this.loader.resolve(from, request)
  }

  async evaluate () {
    const res = await Promise.all(this.entries.map(entry => 
      this.loader.load(cwd, entry, this.fileCache)
    ))
    console.log(res[0])
    this.loader.kill()
  }
}

;(async () => {
  const bundle = new Bundle({ entries: ['./test-entry.js'], cwd: process.cwd() })
  await bundle.evaluate()
})()

