import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const PDF_BUNDLE_MARKER = '/* foxycape-pdf-bundle-css */'
const READER_BUNDLE_MARKER = '/* foxycape-reader-css */'

const appendMarkedCss = (styles: string, extraPath: string, marker: string): string => {
  const index = styles.indexOf(marker)
  const base = index >= 0 ? styles.slice(0, index).trimEnd() : styles.trimEnd()
  if (!existsSync(extraPath)) {
    return base
  }
  const extra = readFileSync(extraPath, 'utf8').trim()
  if (!extra) {
    return base
  }
  return `${base}\n${marker}\n${extra}\n`
}

/** Append reader and PDF.js styles onto styles.css. Safe to run from either build. */
export const mergePdfBundleCss = (outDir: string) => {
  const stylesPath = join(outDir, 'styles.css')
  if (!existsSync(stylesPath)) {
    return
  }
  let styles = readFileSync(stylesPath, 'utf8')
  styles = appendMarkedCss(styles, join(outDir, 'pdf-bundle.css'), PDF_BUNDLE_MARKER)
  styles = appendMarkedCss(styles, join(outDir, 'reader-bundle.css'), READER_BUNDLE_MARKER)
  writeFileSync(stylesPath, styles.endsWith('\n') ? styles : `${styles}\n`)
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
