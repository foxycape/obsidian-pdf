import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

const packageDir = fileURLToPath(new URL('..', import.meta.url))
const distDir = resolve(packageDir, 'dist')
const zipPath = resolve(distDir, 'pdfjs-assets.zip')

/** Remote pack: cmaps + standard_fonts + wasm + iccs + KaTeX woff2. Reader, worker, and signer ship in pdfjs.zip. */
const INCLUDE_ROOTS = [
  join('pdfjs', 'cmaps'),
  join('pdfjs', 'standard_fonts'),
  join('pdfjs', 'wasm'),
  join('pdfjs', 'iccs'),
  join('katex', 'fonts'),
]

const walkFiles = (dir, files = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      walkFiles(full, files)
    } else {
      files.push(full)
    }
  }
  return files
}

const toZipKey = (absolutePath) => relative(distDir, absolutePath).split('\\').join('/')

const main = () => {
  for (const root of INCLUDE_ROOTS) {
    const abs = join(distDir, root)
    if (!existsSync(abs)) {
      throw new Error(
        `Missing ${root} under dist/. Run vite build (copy plugins) before packaging assets.`,
      )
    }
  }

  const cmapsMarkerPath = join(distDir, 'pdfjs', '.foxycape-cmaps-version')
  if (!existsSync(cmapsMarkerPath)) {
    throw new Error(
      `Missing pdfjs/.foxycape-cmaps-version under dist/. Run vite build before packaging assets.`,
    )
  }
  const cmapsId = readFileSync(cmapsMarkerPath, 'utf8').trim()
  if (!cmapsId.startsWith('pdfjs-') || cmapsId.includes('+')) {
    throw new Error(
      `Unexpected cmaps id in ${cmapsMarkerPath}: ${cmapsId}. Expected pdfjs-{version}.`,
    )
  }

  /** @type {Record<string, Uint8Array>} */
  const entries = {}
  for (const root of INCLUDE_ROOTS) {
    const absRoot = join(distDir, root)
    for (const file of walkFiles(absRoot)) {
      entries[toZipKey(file)] = new Uint8Array(readFileSync(file))
    }
  }

  const zipped = zipSync(entries, { level: 6 })
  writeFileSync(zipPath, zipped)
  const mb = (zipped.byteLength / (1024 * 1024)).toFixed(2)
  console.log(`Wrote ${zipPath} (${Object.keys(entries).length} files, ${mb} MB, ${cmapsId})`)

  const pdfBundle = join(distDir, 'pdf.js')
  const workerFrom = join(distDir, 'pdfjs', 'pdf.worker.min.mjs')
  const signerFile = join(distDir, 'static', 'signer.js')
  for (const file of [pdfBundle, workerFrom, signerFile]) {
    if (!existsSync(file)) {
      throw new Error(`Missing ${file}. Run the pdf.js vite build before packaging assets.`)
    }
  }
  const localesDir = resolve(packageDir, 'src/i18n/locales')
  /** @type {Record<string, Uint8Array>} */
  const pdfjsEntries = {
    'pdf.js': new Uint8Array(readFileSync(pdfBundle)),
    'pdfjs/pdf.worker.min.mjs': new Uint8Array(readFileSync(workerFrom)),
    'static/signer.js': new Uint8Array(readFileSync(signerFile)),
  }
  const localeNames = readdirSync(localesDir).filter((name) => name.endsWith('.json'))
  if (!localeNames.includes('en.json')) {
    throw new Error(`Missing src/i18n/locales/en.json.`)
  }
  for (const name of localeNames) {
    pdfjsEntries[`locales/${name}`] = new Uint8Array(readFileSync(join(localesDir, name)))
  }
  const pdfjsZipPath = resolve(distDir, 'pdfjs.zip')
  const pdfjsZipped = zipSync(pdfjsEntries)
  writeFileSync(pdfjsZipPath, pdfjsZipped)
  const pdfjsMb = (pdfjsZipped.byteLength / (1024 * 1024)).toFixed(2)
  console.log(`Wrote ${pdfjsZipPath} (${Object.keys(pdfjsEntries).length} files, ${pdfjsMb} MB)`)
}

main()
