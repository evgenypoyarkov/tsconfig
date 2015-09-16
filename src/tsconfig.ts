import * as fs from 'fs'
import * as path from 'path'
import glob = require('globby')
import extend = require('xtend')
import stripBom = require('strip-bom')
import parseJson = require('parse-json')

export type TSConfig = any

export const DEFAULTS = {
  target: 'es5',
  module: 'commonjs',
  declaration: false,
  noImplicitAny: false,
  removeComments: true
}

const CONFIG_FILENAME = 'tsconfig.json'

/**
 * Resolve `tsconfig.json` from a directory.
 */
export function resolve (dir: string, cb: (err: Error, filename?: string) => any) {
  const configFile = path.resolve(dir, CONFIG_FILENAME)

  fileExists(configFile, function (err, exists) {
    if (err) {
      return cb(err)
    }

    if (exists) {
      return cb(null, configFile)
    }

    const parentDir = path.dirname(dir)

    if (dir === parentDir) {
      return cb(null, undefined)
    }

    return resolve(parentDir, cb)
  })
}

/**
 * Synchronous version of `resolve`.
 */
export function resolveSync (dir: string): string {
  const configFile = path.resolve(dir, CONFIG_FILENAME)

  if (fileExistsSync(configFile)) {
    return configFile
  }

  const parentDir = path.dirname(dir)

  if (dir === parentDir) {
    return
  }

  return resolveSync(parentDir)
}

/**
 * Load `tsconfig.json` from a start directory.
 */
export function load (dir: string, cb: (err: Error, config?: TSConfig) => any) {
  return resolve(dir, function (err, filename) {
    if (err) {
      return cb(err)
    }

    if (!filename) {
      return cb(new Error('No config file found'))
    }

    return readFile(filename, cb)
  })
}

/**
 * Synchronous version of `load`.
 */
export function loadSync (dir: string): TSConfig {
  const filename = resolveSync(dir)

  if (!filename) {
    throw new Error('No config file found')
  }

  return readFileSync(filename)
}

/**
 * Read `tsconfig.json` and parse/sanitize contents.
 */
export function readFile (filename: string, cb: (err: Error, config?: TSConfig) => any) {
  fs.readFile(filename, 'utf8', function (err, contents) {
    if (err) {
      return cb(err)
    }

    return parseFile(stripBom(contents), filename, cb)
  })
}

/**
 * Synchonrous version of `readFile`.
 */
export function readFileSync (filename: string): TSConfig {
  const contents = fs.readFileSync(filename, 'utf8')

  return parseFileSync(stripBom(contents), filename)
}

/**
 * Parse a configuration file and sanitize contents.
 */
export function parseFile (contents: string, filename: string, cb: (err: Error, config?: TSConfig) => any) {
  let data: TSConfig

  try {
    data = parseJson(contents, null, filename)
  } catch (err) {
    cb(err)
    return
  }

  resolveConfig(data, filename, cb)
}

/**
 * Synchronous version of `parseFile`.
 */
export function parseFileSync (contents: string, filename: string): TSConfig {
  const data = parseJson(contents, null, filename)

  return resolveConfigSync(data, filename)
}

/**
 * Sanitize a configuration object.
 */
export function resolveConfig (data: TSConfig, filename: string, cb: (err: Error, config?: TSConfig) => any) {
  let filesGlob = getGlob(data)

  if (filesGlob) {
    return glob(filesGlob, {
      cwd: path.dirname(filename)
    }, function (err, files) {
      if (err) {
        return cb(err)
      }

      return cb(null, sanitizeConfig(data, files, filename))
    })
  }

  process.nextTick(() => cb(null, sanitizeConfig(data, null, filename)))
}

/**
 * Synchronous version of `resolveConfig`.
 */
export function resolveConfigSync (data: TSConfig, filename: string): TSConfig {
  let filesGlob = getGlob(data)

  if (filesGlob) {
    return sanitizeConfig(data, glob.sync(filesGlob, { cwd: path.dirname(filename) }), filename)
  }

  return sanitizeConfig(data, null, filename)
}

/**
 * Get a glob from tsconfig.
 */
function getGlob (data: TSConfig): string[] {
  if (Array.isArray(data.filesGlob)) {
    return data.filesGlob
  }

  return Array.isArray(data.files) ? null : ['./**/*.ts']
}

/**
 * Sanitize tsconfig options.
 */
function sanitizeConfig (data: TSConfig, files: string[], filename: string): TSConfig {
  const config = {
    compilerOptions: extend(DEFAULTS, data.compilerOptions),
    files: Array.isArray(data.files) ? data.files.slice() : []
  }

  const dir = path.dirname(filename)

  // Sanitize files path relative to `tsconfig.json` and filter for duplicates.
  config.files = config.files
    .concat(files || [])
    .map((filename: string) => path.resolve(dir, filename))
    .filter((filename: string, index: number, arr: string[]) => arr.indexOf(filename) === index)

  return config
}

/**
 * Check if a file exists.
 */
function fileExists (filename: string, cb: (err: Error, result?: boolean) => any) {
  fs.stat(filename, function (err, stats) {
    if (err) {
      return cb(null, false)
    }

    return cb(null, stats.isFile() || stats.isFIFO())
  })
}

/**
 * Synchronously check if a file exists.
 */
function fileExistsSync (filename: string): boolean {
  try {
    const stats = fs.statSync(filename)

    return stats.isFile() || stats.isFIFO()
  } catch (e) {
    return false
  }
}
