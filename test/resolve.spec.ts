import * as path from 'path'
import { expect } from 'chai'
import { resolve } from '../lib/index'
import { FileMap, File } from '../lib/file'

const Tacks = require('tacks'),
  file = Tacks.File,
  dir = Tacks.Dir

describe('resolve-dependencies', () => {
  let fixture: any
  let strictFileNames: { [key: string]: string }
  let extraFileNames: { [key: string]: string }
  let cwd: string
  let files: FileMap
  let result: { entries: { [key: string]: File }; files: FileMap; warnings: string[] }

  describe('resolve - gathers all dependencies', () => {
    before(async () => {
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
                main: 'main.js'
              }),
              'main.js': file(`
                require('path')
                module.exports.foo = 'bar'
              `)
            }),
            'package-b': dir({
              'index.js': file(`require('package-c/a.json')`),
              'package.json': file({
                name: 'package-b',
                dependencies: { 'package-c': 'latest' }
              })
            }),
            'package-c': dir({
              'a.json': file({ '1234': 'asdf' }),
              'package.json': file({ name: 'package-c' })
            }),
            'package-d': dir({
              lib: dir({
                'index.js': file(
                  `module.exports = "wat"; require('missing'); require('./more-missing');`
                ),
                'something.js': file('module.exports = 123')
              }),
              'package.json': file({ name: 'package-c', main: 'lib/index.js' })
            })
          })
        })
      )
      cwd = path.resolve(__dirname, 'fixture-a')
      strictFileNames = {
        'app.js': path.resolve(cwd, 'app.js'),
        'b-index.js': path.resolve(cwd, 'node_modules/package-b/index.js'),
        'a-main.js': path.resolve(cwd, 'node_modules/package-a/main.js'),
        'c-a.json': path.resolve(cwd, 'node_modules/package-c/a.json'),
        'd-lib-index.js': path.resolve(cwd, 'node_modules/package-d/lib/index.js'),
        'a-package.json': path.resolve(cwd, 'node_modules/package-a/package.json'),
        'b-package.json': path.resolve(cwd, 'node_modules/package-b/package.json'),
        'c-package.json': path.resolve(cwd, 'node_modules/package-c/package.json'),
        'd-package.json': path.resolve(cwd, 'node_modules/package-d/package.json')
      }
      extraFileNames = {
        'random-file.txt': path.resolve(cwd, 'node_modules/package-a/random-file.txt'),
        'random-file.json': path.resolve(cwd, 'node_modules/package-a/random-file.json'),
        'd-lib-something.js': path.resolve(cwd, 'node_modules/package-d/lib/something.js')
      }
      fixture.create(cwd)
      result = await resolve('./app.js', { cwd })
      files = result.files
    })

    after(() => {
      fixture.remove(cwd)
    })

    it('should resolve all files from an entry', async () => {
      Object.keys(strictFileNames).forEach(x => {
        expect(files[strictFileNames[x]], x).not.to.be.undefined
      })
      expect(Object.keys(files)).to.have.lengthOf(9)
    })

    it('should not resolve node builtins', async () => {
      const name = strictFileNames['a-main.js']
      expect(files[name]!.deps['path']).to.equal(null)
    })

    it('should resolve *all* package files when expand: true', async () => {
      result = await resolve('./app.js', { cwd, expand: true })
      files = result.files
      Object.keys(extraFileNames).forEach(x => {
        expect(files[extraFileNames[x]], x).not.to.be.undefined
      })
      Object.keys(strictFileNames).forEach(x => {
        expect(files[strictFileNames[x]], x).not.to.be.undefined
      })
      expect(Object.keys(files)).to.have.lengthOf(12)
    })

    it('should produce warnings for un-resolvable requests', () => {
      expect(result.warnings).to.have.lengthOf(2)
    })
  })
})
