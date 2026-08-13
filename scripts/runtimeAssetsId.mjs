import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Compatibility id for the sidecar zip (worker / cmaps / fonts / signer).
 * Tied to pdf.js + signer contents, not the plugin semver — plugin-only
 * upgrades should not force a re-download.
 *
 * @param {string} pdfjsDir Absolute path to the pdfjs package root (has package.json)
 * @param {string} signerPath Absolute path to static/signer.js
 * @returns {string} e.g. `pdfjs-4.7.76+signer-a1b2c3d4`
 */
export const buildRuntimeAssetsId = (pdfjsDir, signerPath) => {
  const { version } = JSON.parse(readFileSync(join(pdfjsDir, 'package.json'), 'utf8'))
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`pdf.js package.json at ${pdfjsDir} is missing version`)
  }
  const signerHash = createHash('sha256')
    .update(readFileSync(signerPath))
    .digest('hex')
    .slice(0, 8)
  return `pdfjs-${version}+signer-${signerHash}`
}
