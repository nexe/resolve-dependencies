import * as path from 'path'
import { resolve } from './resolve'
import { FileMap, File } from './file'
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals'

const Tacks = require('tacks'),
  file = Tacks.File,
  dir = Tacks.Dir,
  symlink = Tacks.Symlink

describe('resolve-dependencies', () => {
  let fixture: any
  let referencedFiles: { [key: string]: string }
  let unreferencedFiles: { [key: string]: string }
  let cwd: string
  let files: FileMap
  let result: { entries: { [key: string]: File }; files: FileMap; warnings: string[] }

  describe('resolve - gathers all dependencies', () => {
    beforeAll(async () => {
      fixture = new Tacks(
        dir({
          'app.js': file(`require('package-a'); require('package-b'); require('package-d'); require('./.dot/file')`),
          '.dot': dir({
            'file.js': file('module.exports = require("./fileTwo"); /*require("./sym")*/'),
            'fileTwo.js': file('module.exports = "hello world"'),
            // 'sym.js': symlink('./fileTwo.js'),
          }),
          node_modules: dir({
            'package-a': dir({
              'x.js': file('module.exports = "1234"'),
              'pkg-ref.js': file('require("./x")'),
              'random-file.json': file({ a: 'b' }),
              'random-file.txt': file('asdf'),
              'not-strict.js': file(`function static(foo, values) {
                with (foo) {
                  console.log(values);
                }
              }`),
              'package.json': file({
                pkg: {
                  scripts: ['./pkg-ref.js'],
                },
                version: '0.0.1',
                name: 'package-a',
                main: 'main.js',
              }),
              'main.js': file(`
                require('path')
                require('./not-strict')
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
                  `module.exports = "wat"; 
                  require('missing');         //generate warning
                  require('./more-missing');  //generate warning
                  require('package-e')`
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
        '.dot-file.js': path.resolve(cwd, './.dot/file.js'),
        '.dot-fileTwo.js': path.resolve(cwd, './.dot/fileTwo.js'),
        // '.dot-sym.js': path.resolve(cwd, './.dot/sym.js'),
        'a-main.js': path.resolve(cwd, 'node_modules/package-a/main.js'),
        'a-pkg-ref.js': path.resolve(cwd, 'node_modules/package-a/pkg-ref.js'),
        'a-x.js': path.resolve(cwd, 'node_modules/package-a/x.js'),
        'not-strict.js': path.resolve(cwd, 'node_modules/package-a/not-strict.js'),
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
        expect(files[referencedFiles[x]]).toBeDefined()
      })
      expect(Object.keys(files).sort()).toEqual(Object.values(referencedFiles).sort())
    })

    it('should not resolve node builtins', async () => {
      const name = referencedFiles['a-main.js']
      expect(files[name]).toHaveProperty(`deps.path`, null)
    })

    it('should not resolve node builtins', async () => {
      const name = referencedFiles['a-main.js']
      expect(files[name]).toHaveProperty(`deps.path`, null)
    })

    it('should resolve *all* package files when expand: all', async () => {
      result = await resolve('./app.js', { cwd, expand: 'all' })
      const allFiles = Object.values({ ...unreferencedFiles, ...referencedFiles }).sort()
      expect(Object.keys(result.files).sort()).toEqual(allFiles)
    })

    it('should resolve *most* package files when expand: variable', async () => {
      result = await resolve('./app.js', { cwd, expand: 'variable' })
      files = result.files
      const {
        'a-no-ref-random-file.txt': _,
        'a-no-ref-random-file.json': __,
        'd-no-ref-something.js': ___,
        ...notReferenced
      } = unreferencedFiles
      expect(Object.keys(files).sort()).toEqual(Object.values({ ...referencedFiles, ...notReferenced }).sort())
    })

    // it('should identify symlinks', () => {
    //   expect(files[referencedFiles['.dot-sym.js']]).toHaveProperty('symlink', true)
    // })

    it('should produce warnings for un-resolvable requests', () => {
      expect(result.warnings).toHaveLength(2)
    })

    it('should yield an object with the same order on sequential runs', async () => {
      let runs = 10
      const first = await resolve('./app.js', { cwd, expand: 'all' })
      const keys = Object.keys(first.files)
      while (runs--) {
        const run = await resolve('./app.js', { cwd, expand: 'all' })
        expect(Object.keys(run.files)).toEqual(keys)
      }
    }, 1e4)

    it('dot file entry', async () => {
      const entry = './.dot/file.js'
      result = await resolve(entry, { cwd, expand: 'all' })
      expect(result.entries[entry]).not.toBeNull()
    })
  })
})
