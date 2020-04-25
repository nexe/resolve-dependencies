import * as path from 'path'
import { resolve } from './resolve'
import { FileMap, File } from './file'

const Tacks = require('tacks'),
  file = Tacks.File,
  dir = Tacks.Dir

describe('resolve-dependencies', () => {
  let fixture: any
  let referencedFiles: { [key: string]: string }
  let unreferencedFiles: { [key: string]: string }
  let noRefCount = 0
  let varRefCount = 0
  let cwd: string
  let files: FileMap
  let result: { entries: { [key: string]: File }; files: FileMap; warnings: string[] }

  describe('resolve - gathers all dependencies', () => {
    beforeAll(async () => {
      fixture = new Tacks(
        dir({
          'app.js': file(`require('package-a'); require('package-b'); require('package-d')`),
          node_modules: dir({
            'package-a': dir({
              'random-file.json': file({ a: 'b' }),
              'random-file.txt': file('asdf'),
              'package.json': file({
                version: '0.0.1',
                name: 'package-a',
                main: 'main.js',
              }),
              'main.js': file(`
                require('path')
                module.exports.foo = 'bar'
              `),
            }),
            'package-b': dir({
              'index.js': file(`require('package-c/a.json')`),
              'package.json': file({
                name: 'package-b',
                dependencies: { 'package-c': 'latest' },
              }),
            }),
            'package-c': dir({
              'a.json': file({ '1234': 'asdf' }),
              'package.json': file({ name: 'package-c' }),
            }),
            'package-d': dir({
              lib: dir({
                'index.js': file(
                  `module.exports = "wat"; require('missing'); require('./more-missing'); require('package-e')`
                ),
                'something.js': file('module.exports = 123'),
              }),
              'package.json': file({ name: 'package-c', main: 'lib/index.js' }),
            }),
            'package-e': dir({
              'b.js': file('console.log("wat")'),
              'a.js': file('var mod = "./b.js"; require(mod)'),
              'entry.js': file('require("./a.js")'),
              'package.json': file({ name: 'package-e', main: 'entry.js' }),
            }),
          }),
        })
      )
      cwd = path.resolve(__dirname, 'fixture-a')
      referencedFiles = {
        'app.js': path.resolve(cwd, 'app.js'),
        'a-main.js': path.resolve(cwd, 'node_modules/package-a/main.js'),
        'a-package.json': path.resolve(cwd, 'node_modules/package-a/package.json'),
        'd-lib-index.js': path.resolve(cwd, 'node_modules/package-d/lib/index.js'),
        'd-package.json': path.resolve(cwd, 'node_modules/package-d/package.json'),
        'b-index.js': path.resolve(cwd, 'node_modules/package-b/index.js'),
        'b-package.json': path.resolve(cwd, 'node_modules/package-b/package.json'),
        'c-a.json': path.resolve(cwd, 'node_modules/package-c/a.json'),
        'c-package.json': path.resolve(cwd, 'node_modules/package-c/package.json'),
        'e-entry.js': path.resolve(cwd, 'node_modules/package-e/entry.js'),
        'e-a.js': path.resolve(cwd, 'node_modules/package-e/a.js'),
        'e-package.json': path.resolve(cwd, 'node_modules/package-e/package.json'),
      }
      unreferencedFiles = {
        'e-variable-ref-b.js': path.resolve(cwd, 'node_modules/package-e/b.js'),
        'a-no-ref-random-file.txt': path.resolve(cwd, 'node_modules/package-a/random-file.txt'),
        'a-no-ref-random-file.json': path.resolve(cwd, 'node_modules/package-a/random-file.json'),
        'd-no-ref-something.js': path.resolve(cwd, 'node_modules/package-d/lib/something.js'),
      }
      varRefCount = 1
      noRefCount = 3
      fixture.create(cwd)
      result = await resolve('./app.js', { cwd })
      files = result.files
    })

    afterAll(() => {
      fixture.remove(cwd)
    })

    it('should resolve all files from an entry', async () => {
      const fileNames = Object.keys(referencedFiles)
      fileNames.forEach((x) => {
        expect(files[referencedFiles[x]]).not.toBeUndefined()
      })
      expect(Object.keys(files)).toHaveLength(fileNames.length)
    })

    it('should not resolve node builtins', async () => {
      const name = referencedFiles['a-main.js']
      expect(files[name]!.deps['path']).toEqual(null)
    })

    it('should resolve *all* package files when expand: all', async () => {
      result = await resolve('./app.js', { cwd, expand: 'all' })
      files = result.files

      const unreferencedFileNames = Object.keys(unreferencedFiles),
        referencedFileNames = Object.keys(referencedFiles)

      unreferencedFileNames.forEach((x) => {
        expect(files[unreferencedFiles[x]]).not.toBeUndefined()
      })
      referencedFileNames.forEach((x) => {
        expect(files[referencedFiles[x]]).not.toBeUndefined()
      })
      expect(Object.keys(files)).toHaveLength(unreferencedFileNames.length + referencedFileNames.length)
    })

    it('should resolve *most* package files when expand: variable', async () => {
      result = await resolve('./app.js', { cwd, expand: 'variable' })
      files = result.files

      const unreferencedFileNames = Object.keys(unreferencedFiles),
        referencedFileNames = Object.keys(referencedFiles)
      unreferencedFileNames
        .filter((key) => {
          key !== 'random-file.txt' && key !== 'random-file.json'
        })
        .forEach((x) => {
          expect(files[unreferencedFiles[x]]).not.toBeUndefined()
        })
      referencedFileNames.forEach((x) => {
        expect(files[referencedFiles[x]]).not.toBeUndefined()
      })
      expect(Object.keys(files)).toHaveLength(unreferencedFileNames.length + referencedFileNames.length - noRefCount)
    })

    it('should produce warnings for un-resolvable requests', () => {
      expect(result.warnings).toHaveLength(2)
    })
  })
})
