import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

/** Must stay in sync with src/reader/pdfjsGlobalNames.ts */
const RENAMES: ReadonlyArray<readonly [from: string, to: string]> = [
  ['globalThis.pdfjsLib', 'globalThis.__foxycapePdfjsLib'],
  ['globalThis.pdfjsWorker', 'globalThis.__foxycapePdfjsWorker'],
  ['globalThis.pdfjsViewer', 'globalThis.__foxycapePdfjsViewer'],
]

export const renamePdfjsGlobalsInCode = (code: string): string => {
  let next = code
  for (const [from, to] of RENAMES) {
    next = next.split(from).join(to)
  }
  return next
}

const isBundledPdfjsSource = (id: string) => {
  const normalized = id.split('?')[0].replace(/\\/g, '/')
  if (normalized.includes('\0')) {
    return false
  }
  return (
    normalized.includes('/pdfjs/') &&
    (normalized.endsWith('/legacy/build/pdf.mjs') ||
      normalized.endsWith('/legacy/build/pdf.min.mjs') ||
      normalized.endsWith('/legacy/build/pdf.worker.min.mjs') ||
      normalized.endsWith('/legacy/build/pdf.worker.min.js') ||
      normalized.endsWith('/legacy/web/pdf_viewer.mjs'))
  )
}

/**
 * Rewrite pdf.js host globals to Foxycape-private names so we never touch
 * Obsidian / third-party `pdfjsLib` | `pdfjsWorker` | `pdfjsViewer`.
 */
export const renamePdfjsGlobalsPlugin = (): Plugin => ({
  name: 'rename-pdfjs-globals',
  enforce: 'pre',
  transform(code, id) {
    if (!isBundledPdfjsSource(id)) {
      return null
    }
    const patched = renamePdfjsGlobalsInCode(code)
    if (patched === code) {
      return null
    }
    return { code: patched, map: null }
  },
})

/**
 * Fail the build if main.js still assigns the shared host global names.
 */
export const assertNoHostPdfjsGlobalsPlugin = (mainJsPath: string): Plugin => ({
  name: 'assert-no-host-pdfjs-globals',
  writeBundle() {
    const code = readFileSync(mainJsPath, 'utf8')
    const forbidden = [
      /globalThis\.pdfjsLib\s*=/,
      /globalThis\.pdfjsWorker\s*=/,
      /globalThis\.pdfjsViewer\s*=/,
    ]
    for (const re of forbidden) {
      if (re.test(code)) {
        throw new Error(
          `[foxycape-pdf] ${mainJsPath} still writes host pdf.js global (${re}). ` +
            'Rename plugin failed — Foxycape must not touch Obsidian/third-party globals.',
        )
      }
    }
  },
})
