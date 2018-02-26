import * as path from 'path'
import { expect } from 'chai'
import { resolve } from '../lib/index'
import { FileMap } from '../lib/file'

const Tacks = require('tacks'),
  file = Tacks.File,
  dir = Tacks.Dir

describe('resolve-dependencies#resolve', () => {
  let fixture: any
  let fileNames: string[]
  let cwd: string
  let files: FileMap
  before(async () => {
    fixture = new Tacks(
      dir({
        'app.js': file(`require('package-a')`),
        node_modules: dir({
          'package-a': dir({
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
})
