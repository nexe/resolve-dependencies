import * as path from 'path'
import { expect } from 'chai'
import { resolve } from '../lib/index'
import { FileMap } from '../lib/file'

const Tacks = require('tacks'),
  file = Tacks.File,
  dir = Tacks.Dir

describe('resolve-dependencies', () => {
  let fixture: any
  let fileNames: string[]
  let cwd: string
  let files: FileMap

  describe('resolve - gathers all dependencies', () => {
    before(async () => {
      fixture = new Tacks(
        dir({
          'app.js': file(`require('package-a')`),
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
            })
          })
        })
      )
      cwd = path.resolve(__dirname, 'fixture-a')
      fileNames = [
        path.resolve(cwd, 'app.js'),
        path.resolve(cwd, 'node_modules/package-a/package.json'),
        path.resolve(cwd, 'node_modules/package-a/main.js')
      ]
      fixture.create(cwd)
      files = (await resolve('./app.js', { cwd })).files
    })

    after(() => {
      fixture.remove(cwd)
    })

    it('should resolve all files from an entry', async () => {
      expect(files[fileNames[0]].deps['package-a']).to.equal(files[fileNames[2]])
      expect(files[fileNames[2]].package.name).to.equal('package-a')
      expect(Object.keys(files)).to.have.lengthOf(3)
    })

    it('should not resolve node builtins', async () => {
      expect(files[fileNames[2]].deps['path']).to.equal(null)
    })

    it('should resolve all package files when strict: false', async () => {
      files = (await resolve('./app.js', { cwd, strict: false })).files
      const randomFile = files[path.join(cwd, 'node_modules', 'package-a', 'random-file.txt')]
      const randomJson = files[path.join(cwd, 'node_modules', 'package-a', 'random-file.json')]
      expect(Object.keys(files)).to.have.lengthOf(5)
      expect(randomFile.contents).to.equal('')
      expect(randomJson.contents).to.equal('{"a":"b"}')
    })
  })
})
