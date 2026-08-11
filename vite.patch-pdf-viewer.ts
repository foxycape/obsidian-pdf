import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Plugin } from 'vite'
import { renamePdfjsGlobalsInCode } from './vite.rename-pdfjs-globals'

const VIRTUAL_ID = '\0foxycape-patched-pdf-viewer'

/**
 * pdf_viewer.mjs historically does `} = globalThis.pdfjsLib` at module init.
 * Bind Foxycape's pdf.mjs via ESM import instead, then rename any remaining
 * host globals (e.g. pdfjsViewer) to Foxycape-private names.
 */
export const patchPdfViewerImportPlugin = (corePdfjsDir: string): Plugin => {
  const viewerPath = join(corePdfjsDir, 'legacy/web/pdf_viewer.mjs')

  return {
    name: 'patch-pdf-viewer-import',
    enforce: 'pre',
    resolveId(id, importer) {
      const normalized = id.replace(/\\/g, '/')
      if (
        importer &&
        importer.replace(/\\/g, '/').includes('/foxycapePdfViewer.ts') &&
        (normalized.includes('../core/pdfjs/legacy/web/pdf_viewer.mjs') ||
          normalized.endsWith('/legacy/web/pdf_viewer.mjs') ||
          normalized === viewerPath.replace(/\\/g, '/'))
      ) {
        return VIRTUAL_ID
      }
      return null
    },
    load(id) {
      if (id !== VIRTUAL_ID) {
        return null
      }

      const code = readFileSync(viewerPath, 'utf8')
      const needle = '} = globalThis.pdfjsLib;'
      if (!code.includes(needle)) {
        this.error(`[foxycape-pdf] expected binding not found in ${viewerPath}`)
      }

      const pdfApiPath = join(dirname(viewerPath), '../build/pdf.mjs').replace(
        /\\/g,
        '/',
      )

      // 1) Bind API from our module (not host globalThis.pdfjsLib)
      // 2) Rename leftover host globals (pdfjsViewer, etc.) to private names
      const withModuleApi =
        `import * as __foxycapePdfjsLib from '${pdfApiPath}';\n` +
        code.replace(needle, '} = __foxycapePdfjsLib;')

      return renamePdfjsGlobalsInCode(withModuleApi)
    },
  }
}
