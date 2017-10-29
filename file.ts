import * as babel from 'babel-core'
import * as fs from 'fs'

interface FileOptions {
  fs: typeof fs,
  encoding: string
}

//SOMEDAY use maintained regex https://github.com/systemjs/systemjs/issues/1733
const esmRegEx = /(^\s*|[}\);\n]\s*)(import\s*(['"]|(\*\s+as\s+)?(?!type)([^"'\(\)\n; ]+)\s*from\s*['"]|\{)|export\s+\*\s+from\s+["']|export\s*(\{|default|function|class|var|const|let|async\s+function))/;  

export class File {
  contents: string | Buffer
  variableImports: boolean 
  dependencies = new Map<string, File>()  
  requests = new Set<string>()
  map: any
  private fs: typeof fs
  static empty = new File('')
  constructor (public filepath: string) {}

  static load(filepath: string, options: FileOptions = { fs: fs, encoding: 'utf-8' }) {
    const file = new File(filepath)
    const fileBuffer = options.fs.readFileSync(filepath)
    if (options.encoding) {
      file.contents = fileBuffer.toString(options.encoding)
    } else {
      file.contents = fileBuffer
    }
    file.transform()
    return file
  }

  private captureDeps (nodePath: any) {
    const callee = nodePath.get('callee')
    if (callee.isIdentifier() && callee.equals('name', 'require')) {
      const arg = nodePath.get('arguments')[0]
      if (arg && arg.isStringLiteral()) {
        return this.dependencies.set(arg.node.value, File.empty)
      }
      if (arg && arg.isTemplateLiteral() && arg.node.quasis.length === 1) {
        //console.log(prepackFromAst(arg, '...').code)
        return this.dependencies.set(arg.node.quasis[0].value.cooked, File.empty)
      }
      this.variableImports = true
    }
  }

  private transform(plugins: any[] = []) {
    if (Buffer.isBuffer(this.contents)) {
      return
    }   
    const result = babel.transform(this.contents, {
      sourceType: this.contents.match(esmRegEx) ? 'module' : 'script',
      plugins: [
        'babel-plugin-transform-es2015-modules-commonjs',
        'babel-plugin-dynamic-import-node',
        {
          visitor: {
            CallExpression: {
              enter: (nodePath: any) => {
                this.captureDeps(nodePath)
              }
            }
          },
        },
        ...plugins
      ]
    })
    this.contents = result.code || ''
    this.map = result.map
  }
}
