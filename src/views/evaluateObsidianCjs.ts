import * as obsidian from 'obsidian'

const nodeRequire = (id: string, label: string): unknown => {
  const requireFn = (window as Window & { require?: (moduleId: string) => unknown }).require
  if (typeof requireFn !== 'function') {
    throw new Error(`Cannot require("${id}") from ${label}`)
  }
  return requireFn(id)
}

const createObsidianRequire = (label: string) => (id: string): unknown => {
  if (id === 'obsidian') {
    return obsidian
  }
  if (id === 'electron' || id === '@codemirror/state' || id === '@codemirror/view') {
    return nodeRequire(id, label)
  }
  throw new Error(`Cannot require("${id}") from ${label}`)
}

/** Execute a CJS bundle built for Obsidian. Returns `module.exports`. */
export const evaluateObsidianCjs = (source: string, label: string): unknown => {
  const moduleRef: { exports: unknown } = { exports: {} }
  const run = new Function(
    'exports',
    'require',
    'module',
    source,
  ) as (
    exports: unknown,
    require: (id: string) => unknown,
    module: { exports: unknown },
  ) => void
  run(moduleRef.exports, createObsidianRequire(label), moduleRef)
  return moduleRef.exports
}
