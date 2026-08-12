import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const WORKER_RELATIVE = 'legacy/build/pdf.worker.min.mjs'

type CopyPdfjsAssetsOptions = {
  outDir: string
  corePdfjsDir: string
  /** package.json version written to pdfjs/.foxycape-assets-version */
  version: string
}

/**
 * Copy pdf.js runtime assets into dist/pdfjs:
 * - cmaps / standard_fonts (served by disk factories)
 * - pdf.worker.min.mjs (read at runtime → Blob URL; not inlined into main.js)
 */
export const copyPdfjsAssetsPlugin = (options: CopyPdfjsAssetsOptions): Plugin => {
  const { outDir, corePdfjsDir, version } = options
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
    writeFileSync(join(pdfjsOutDir, '.foxycape-assets-version'), `${version}\n`)
  }

  return {
    name: 'copy-pdfjs-assets',
    writeBundle() {
      copy()
    },
  }
}
