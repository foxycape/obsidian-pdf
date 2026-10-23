import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import {
  FOXYCAPE_PDFJS_LIB_GLOBAL,
  FOXYCAPE_PDFJS_VIEWER_GLOBAL,
} from './src/reader/pdfjsGlobalNames'

const LIB_ID = '\0foxycape-pdfjs-lib-shim'
const VIEWER_ID = '\0foxycape-pdfjs-viewer-shim'

const normalize = (id: string) => id.split('?')[0]?.replace(/\\/g, '/') ?? ''

const isPdfApi = (id: string) => normalize(id).endsWith('/legacy/build/pdf.mjs')

const isPdfViewer = (id: string) => normalize(id).endsWith('/legacy/web/pdf_viewer.mjs')

const parseExportNames = (source: string, filePath: string): string[] => {
  const match = source.match(/^export \{([^}]+)\};/m)
  if (!match?.[1]) {
    throw new Error(`[foxycape-pdf] export list not found in ${filePath}`)
  }
  return match[1]
    .split(',')
    .map((part) => {
      const bits = part.trim().split(/\s+as\s+/)
      return (bits[1] ?? bits[0] ?? '').trim()
    })
    .filter((name) => name.length > 0)
}

/**
 * Runtime injected into bundles. `newTarget` must be forwarded so
 * `class Child extends PDFViewer` keeps Child.prototype after `super()`.
 * A direct `new PDFViewer()` still constructs the real class, not this Proxy.
 */
export const pdfjsBindRuntime = `const bind = (name) => {
  const forward = function (...args) {
    const real = read()[name]
    if (typeof real === 'function') {
      return real.apply(this, args)
    }
    return real
  }
  const proxy = new Proxy(forward, {
    construct(_target, args, newTarget) {
      const real = read()[name]
      return Reflect.construct(real, args, newTarget === proxy ? real : newTarget)
    },
    get(_target, prop) {
      const real = read()[name]
      if (real == null) {
        return undefined
      }
      if (prop === 'prototype') {
        return real.prototype
      }
      const value = real[prop]
      return typeof value === 'function' ? value.bind(real) : value
    },
    apply(_target, thisArg, args) {
      return Reflect.apply(read()[name], thisArg, args)
    },
  })
  return proxy
}`

const shimSource = (
  globalName: typeof FOXYCAPE_PDFJS_LIB_GLOBAL | typeof FOXYCAPE_PDFJS_VIEWER_GLOBAL,
  names: string[],
) => {
  const exports = names
    .map((name) => `export const ${name} = bind(${JSON.stringify(name)})`)
    .join('\n')
  return `const read = () => {
  const lib = globalThis.${globalName}
  if (!lib) {
    throw new Error('Foxycape pdf.js runtime is not loaded')
  }
  return lib
}
${pdfjsBindRuntime}
${exports}
`
}

/**
 * Main bundle reads PDF.js from the globals installed by pdf-lib.js.
 * The library itself stays out of main.js.
 */
export const pdfjsShimPlugin = (pdfApiPath: string, pdfViewerPath: string): Plugin => {
  const libNames = parseExportNames(readFileSync(pdfApiPath, 'utf8'), pdfApiPath)
  const viewerNames = parseExportNames(readFileSync(pdfViewerPath, 'utf8'), pdfViewerPath)

  return {
    name: 'foxycape-pdfjs-shim',
    enforce: 'pre',
    resolveId(id) {
      if (isPdfApi(id)) {
        return LIB_ID
      }
      if (isPdfViewer(id)) {
        return VIEWER_ID
      }
      return null
    },
    load(id) {
      if (id === LIB_ID) {
        return shimSource(FOXYCAPE_PDFJS_LIB_GLOBAL, libNames)
      }
      if (id === VIEWER_ID) {
        return shimSource(FOXYCAPE_PDFJS_VIEWER_GLOBAL, viewerNames)
      }
      return null
    },
  }
}
