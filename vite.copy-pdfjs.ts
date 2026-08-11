import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const WORKER_RELATIVE = 'legacy/build/pdf.worker.min.mjs'

/**
 * Copy pdf.js runtime assets into dist/pdfjs:
 * - cmaps / standard_fonts (fetched by pdf.js)
 * - pdf.worker.min.mjs (read at runtime → Blob URL; not inlined into main.js)
 */
export const copyPdfjsAssetsPlugin = (outDir: string, corePdfjsDir: string): Plugin => {
  const pdfjsOutDir = join(outDir, 'pdfjs')

  const copy = () => {
    if (!existsSync(corePdfjsDir)) {
      throw new Error(`pdfjs not found at ${corePdfjsDir}`)
    }

    const workerFrom = join(corePdfjsDir, WORKER_RELATIVE)
    if (!existsSync(workerFrom)) {
      throw new Error(`pdf.js worker not found at ${workerFrom}`)
    }

    rmSync(pdfjsOutDir, { recursive: true, force: true })
    mkdirSync(pdfjsOutDir, { recursive: true })

    cpSync(join(corePdfjsDir, 'cmaps'), join(pdfjsOutDir, 'cmaps'), { recursive: true })
    cpSync(join(corePdfjsDir, 'standard_fonts'), join(pdfjsOutDir, 'standard_fonts'), {
      recursive: true,
    })
    cpSync(workerFrom, join(pdfjsOutDir, 'pdf.worker.min.mjs'))
  }

  return {
    name: 'copy-pdfjs-assets',
    writeBundle() {
      copy()
    },
  }
}
