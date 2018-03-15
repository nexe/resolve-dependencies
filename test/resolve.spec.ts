import * as path from 'path'
import { expect } from 'chai'
import { resolve } from '../lib/index'
import { FileMap } from '../lib/file'

const Tacks = require('tacks'),
  file = Tacks.File,
  dir = Tacks.Dir

describe('resolve-dependencies', () => {
  let fixture: any
  let strictFileNames: { [key: string]: string }
  let extraFileNames: { [key: string]: string }
  let cwd: string
  let files: FileMap

  describe('resolve - gathers all dependencies', () => {
    before(async () => {
      fixture = new Tacks(
        dir({
          'app.js': file(`require('package-a'); require('package-b')`),
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
              'package.json': file({ name: 'package-b', dependencies: { 'package-c': 'latest' } })
            }),
            'package-c': dir({
              'a.json': file({ '1234': 'asdf' }),
              'package.json': file({ name: 'package-c' })
            })
          })
        })
      )
      cwd = path.resolve(__dirname, 'fixture-a')
      strictFileNames = {
        'app.js': path.resolve(cwd, 'app.js'),
        'a-main.js': path.resolve(cwd, 'node_modules/package-a/main.js'),
        'b-index.js': path.resolve(cwd, 'node_modules/package-b/index.js'),
        'c-a.json': path.resolve(cwd, 'node_modules/package-c/a.json'),
        'a-package.json': path.resolve(cwd, 'node_modules/package-a/package.json'),
        'b-package.json': path.resolve(cwd, 'node_modules/package-b/package.json'),
        'c-package.json': path.resolve(cwd, 'node_modules/package-c/package.json')
      }
      extraFileNames = {
        'random-file.txt': path.resolve(cwd, 'node_modules/package-a/random-file.txt'),
        'random-file.json': path.resolve(cwd, 'node_modules/package-a/random-file.json')
      }
      fixture.create(cwd)
      files = (await resolve('./app.js', { cwd })).files
    })

    after(() => {
      fixture.remove(cwd)
    })

    it('should resolve all files from an entry', async () => {
      Object.keys(strictFileNames).forEach(x => {
        expect(files[strictFileNames[x]]).not.to.be.undefined
      })
      expect(Object.keys(files)).to.have.lengthOf(7)
    })

    it('should not resolve node builtins', async () => {
      expect(files[strictFileNames['a-main.js']].deps['path']).to.equal(null)
    })

    it('should resolve *all* package files when strict: false', async () => {
      files = (await resolve('./app.js', { cwd, strict: false })).files
      Object.keys(extraFileNames).forEach(x => {
        expect(files[extraFileNames[x]]).not.to.be.undefined
      })
      Object.keys(strictFileNames).forEach(x => {
        expect(files[strictFileNames[x]]).not.to.be.undefined
      })
      expect(Object.keys(files)).to.have.lengthOf(9)
    })
  })
})
