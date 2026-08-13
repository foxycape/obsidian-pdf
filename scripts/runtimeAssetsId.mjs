import { createHash } from 'node:crypto'
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

/**
 * Compatibility id for embedded worker + signer (zipped into main.js).
 * Tied to pdf.js + signer contents, not the plugin semver — plugin-only
 * upgrades should not force a re-extract.
 *
 * @param {string} pdfjsDir Absolute path to the pdfjs package root (has package.json)
 * @param {string} signerPath Absolute path to static/signer.js
 * @returns {string} e.g. `pdfjs-4.7.76+signer-a1b2c3d4`
 */
export const buildRuntimeAssetsId = (pdfjsDir, signerPath) => {
  const version = readPdfjsVersion(pdfjsDir)
  const signerHash = createHash('sha256')
    .update(readFileSync(signerPath))
    .digest('hex')
    .slice(0, 8)
  return `pdfjs-${version}+signer-${signerHash}`
}
