import * as fs from 'fs'
import { sync as glob } from 'fast-glob'
import { join, dirname } from 'path'
import { gatherDependencies } from './gather-deps'
import {
  File,
  createFile,
  isNodeModule,
  ensureDottedRelative,
  JsLoaderOptions,
  nodeModuleGlobs,
  extraGlobs,
  isScript,
} from './file'
import { ResolverFactory, CachedInputFileSystem } from 'enhanced-resolve'

const { readFileSync, lstatSync, statSync, realpathSync } = fs
const supportedJsExtensions = ['.js', '.cjs', '.mjs']

interface Resolver {
  resolve: (context: any, path: string, request: string, resolveContext: any, callback: any) => void
}

const fileSystem = new CachedInputFileSystem(fs, 4000) as any,
  esmResolver = ResolverFactory.createResolver({
    extensions: ['.js', '.cjs', '.mjs', '.json', '.node'],
    conditionNames: ['node', 'import', 'require', 'default'],
    useSyncFileSystemCalls: true,
    symlinks: false,
    fileSystem,
  }) as Resolver,
  cjsResolver = ResolverFactory.createResolver({
    extensions: ['.js', '.cjs', '.mjs', '.json', '.node'],
    conditionNames: ['node', 'require', 'default'],
    useSyncFileSystemCalls: true,
    symlinks: false,
    fileSystem,
  }) as Resolver,
  defaultOptions: Partial<JsLoaderOptions> = {
    loadContent: true,
    expand: 'none',
    isEntry: false,
    type: 'commonjs',
  }

const ModulesDir = 'node_modules'

export type Resolved = { absPath: string; pkgPath: string; pkg: any; warning: string }

function stripControlCharacters(path: string) {
  return path && path.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
}

const emptyContext = {},
  emptyResolveContext = {}

export function resolveSync(from: string, request: string, resolver = cjsResolver): Resolved {
  const result = {
    absPath: '',
    pkgPath: '',
    pkg: null,
    warning: '',
  }
  resolver.resolve(
    emptyContext,
    from,
    request,
    emptyResolveContext,
    (err: Error | null, path: string, data: any) => {
      if (err) {
        result.warning = err.message
        return
      }
      result.absPath = stripControlCharacters(path)
      result.pkgPath = stripControlCharacters(data.descriptionFilePath)
      result.pkg = data.descriptionFileData
      return
    }
  )
  return result
}

async function expand(file: File, fileDir: string, baseDir: string, globs: string[] | string) {
  const files = glob(globs, {
    onlyFiles: true,
    cwd: baseDir,
    followSymbolicLinks: false,
  })
  files
    .sort() //glob search is width first and not deterministic
    .map((dep) => ensureDottedRelative(fileDir, join(baseDir, dep)))
    .filter((relDep) => file.absPath !== join(baseDir, relDep))
    .forEach((relDep) => {
      file.deps[relDep] = file.deps[relDep] || null
    })
  const currentDeps = Object.keys(file.deps)
  file.package &&
    file.package.dependencies &&
    Object.keys(file.package.dependencies || {}).forEach((dependency) => {
      if (!currentDeps.some((curDep) => curDep.startsWith(dependency))) {
        file.deps[dependency] = file.deps[dependency] || null
      }
    })
}

export function load(
  workingDirectory: string,
  request: string,
  options = defaultOptions
): File | { warning: string } {
  const resolver = options.type === 'module' ? esmResolver : cjsResolver,
    { absPath, pkg, pkgPath, warning } = resolveSync(workingDirectory, request, resolver)
  if (!absPath) {
    return { warning: warning }
  }

  const file = createFile(absPath),
    isJs = options.isEntry || supportedJsExtensions.some((x) => absPath.endsWith(x))

  file.absPath = absPath

  if (isJs || absPath.endsWith('json')) {
    file.contents = readFileSync(absPath, 'utf-8')
  }

  if (isJs) {
    try {
      const isModule = absPath.endsWith('.mjs') || !isScript(file.contents as string)
      const parseResult = gatherDependencies(file.contents, isModule)
      Object.assign(file.deps, parseResult.deps)
      file.moduleType = isModule ? 'module' : 'commonjs'
      file.variableImports = parseResult.variable
    } catch (e: any) {
      return { warning: `Error parsing file: "${file.absPath}"\n${e.stack}` }
    }
  }

  const fileDir = dirname(file.absPath),
    expandVariable = Boolean(options.expand === 'variable' && file.variableImports)

  if (isNodeModule(request) && pkg && pkgPath) {
    file.package = pkg
    file.deps[ensureDottedRelative(fileDir, pkgPath)] = null
    const pkgDir = (file.moduleRoot = dirname(pkgPath)),
      expandAll = options.expand === 'all'

    const pkgPathParts = pkgPath.split(ModulesDir)

    const [_, ...pkgRootPrefix] = pkgPathParts.slice().reverse()
    const rootPkgDir = pkgPathParts[pkgRootPrefix.length].split(/\\|\//).filter((x) => x)[0]
    const pkgRoot = join(pkgRootPrefix.join(ModulesDir), ModulesDir, rootPkgDir)

    if (expandVariable || expandAll) {
      expand(file, fileDir, pkgDir, nodeModuleGlobs(file))
      file.contextExpanded = true
    }

    expand(file, fileDir, pkgRoot, extraGlobs(file))
  } else if (expandVariable && options.context?.moduleRoot && !options.context.expanded) {
    expand(
      file,
      fileDir,
      options.context.moduleRoot,
      nodeModuleGlobs({ package: { files: options.context.globs } })
    )
    file.contextExpanded = true
  }

  if (!options.loadContent) {
    file.contents = null
  }
  const stats = lstatSync(file.absPath)
  if (stats.isSymbolicLink()) {
    const path = realpathSync(file.absPath)
    const absStat = statSync(file.absPath)
    file.realPath = path
    file.realSize = absStat.size
  }
  file.size = stats.size
  return file
}
