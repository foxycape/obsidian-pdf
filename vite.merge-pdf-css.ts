import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const MARKER = '/* foxycape-pdf-bundle-css */'

/** Append Vue styles from pdf.js onto styles.css. Safe to run from either build. */
export const mergePdfBundleCss = (outDir: string) => {
  const stylesPath = join(outDir, 'styles.css')
  const extraPath = join(outDir, 'pdf-bundle.css')
  if (!existsSync(stylesPath) || !existsSync(extraPath)) {
    return
  }
  const extra = readFileSync(extraPath, 'utf8').trim()
  if (!extra) {
    return
  }
  let styles = readFileSync(stylesPath, 'utf8')
  const index = styles.indexOf(MARKER)
  if (index >= 0) {
    styles = styles.slice(0, index).trimEnd()
  }
  writeFileSync(stylesPath, `${styles}\n${MARKER}\n${extra}\n`)
}

export const mergePdfBundleCssPlugin = (outDir: string): Plugin => ({
  name: 'merge-pdf-bundle-css',
  writeBundle() {
    mergePdfBundleCss(outDir)
    // The other config may still be writing its CSS file.
    setTimeout(() => mergePdfBundleCss(outDir), 250)
    setTimeout(() => mergePdfBundleCss(outDir), 1000)
  },
})
