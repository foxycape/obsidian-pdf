import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const readPdfjsVersion = (pdfjsDir) => {
  const { version } = JSON.parse(readFileSync(join(pdfjsDir, 'package.json'), 'utf8'))
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`pdf.js package.json at ${pdfjsDir} is missing version`)
  }
  return version
}

/**
 * pdf.js-only id for the remote cmaps / standard_fonts pack.
 *
 * @param {string} pdfjsDir Absolute path to the pdfjs package root (has package.json)
 * @returns {string} e.g. `pdfjs-4.7.76`
 */
export const buildPdfjsCmapsId = (pdfjsDir) => `pdfjs-${readPdfjsVersion(pdfjsDir)}`

