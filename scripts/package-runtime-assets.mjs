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

/** Remote pack: cmaps + standard_fonts + wasm + iccs. pdf-lib and the worker ship in pdfjs.zip. KaTeX woff2 ships in reader-bundle.zip. */
const INCLUDE_ROOTS = [
  join('pdfjs', 'cmaps'),
  join('pdfjs', 'standard_fonts'),
  join('pdfjs', 'wasm'),
  join('pdfjs', 'iccs'),
]
const KATEX_FONTS = join('katex', 'fonts')

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

  const pdfLib = join(distDir, 'pdf-lib.js')
  const workerFrom = join(distDir, 'pdfjs', 'pdf.worker.min.mjs')
  for (const file of [pdfLib, workerFrom]) {
    if (!existsSync(file)) {
      throw new Error(`Missing ${file}. Run the pdf.js vite build before packaging assets.`)
    }
  }
  /** @type {Record<string, Uint8Array>} */
  const pdfjsEntries = {
    'pdf-lib.js': new Uint8Array(readFileSync(pdfLib)),
    'pdfjs/pdf.worker.min.mjs': new Uint8Array(readFileSync(workerFrom)),
  }
  const pdfjsZipPath = resolve(distDir, 'pdfjs.zip')
  const pdfjsZipped = zipSync(pdfjsEntries)
  writeFileSync(pdfjsZipPath, pdfjsZipped)
  const pdfjsMb = (pdfjsZipped.byteLength / (1024 * 1024)).toFixed(2)
  console.log(`Wrote ${pdfjsZipPath} (${Object.keys(pdfjsEntries).length} files, ${pdfjsMb} MB)`)

  const localesDir = resolve(packageDir, 'src/i18n/locales')
  const localeNames = readdirSync(localesDir).filter((name) => name.endsWith('.json'))
  if (!localeNames.includes('en.json')) {
    throw new Error('Missing src/i18n/locales/en.json.')
  }
  /** @type {Record<string, Uint8Array>} */
  const localeEntries = {}
  for (const name of localeNames) {
    localeEntries[`locales/${name}`] = new Uint8Array(readFileSync(join(localesDir, name)))
  }
  const localesZipPath = resolve(distDir, 'locales.zip')
  const localesZipped = zipSync(localeEntries)
  writeFileSync(localesZipPath, localesZipped)
  const localesMb = (localesZipped.byteLength / (1024 * 1024)).toFixed(2)
  console.log(`Wrote ${localesZipPath} (${Object.keys(localeEntries).length} files, ${localesMb} MB)`)

  const markdownLib = join(distDir, 'markdown-lib.js')
  const markdownIdPath = join(distDir, '.foxycape-markdown-id')
  const markdownMarker = join(distDir, 'markdown', '.foxycape-markdown-version')
  for (const file of [markdownLib, markdownIdPath, markdownMarker]) {
    if (!existsSync(file)) {
      throw new Error(`Missing ${file}. Run the markdown vite build before packaging assets.`)
    }
  }
  const markdownId = readFileSync(markdownIdPath, 'utf8').trim()
  if (!markdownId.startsWith('markdown-')) {
    throw new Error(`Unexpected markdown id: ${markdownId}`)
  }
  console.log(`markdown-lib.js ready (${markdownId})`)

  const readerBundle = join(distDir, 'reader-bundle.js')
  const readerVersion = join(distDir, '.foxycape-reader-version')
  const katexFonts = join(distDir, KATEX_FONTS)
  for (const file of [readerBundle, readerVersion, katexFonts]) {
    if (!existsSync(file)) {
      throw new Error(`Missing ${file}. Run the reader vite build before packaging assets.`)
    }
  }
  /** @type {Record<string, Uint8Array>} */
  const readerEntries = {
    'reader-bundle.js': new Uint8Array(readFileSync(readerBundle)),
  }
  for (const file of walkFiles(katexFonts)) {
    if (!file.endsWith('.woff2')) {
      continue
    }
    readerEntries[toZipKey(file)] = new Uint8Array(readFileSync(file))
  }
  if (Object.keys(readerEntries).length < 2) {
    throw new Error(`No KaTeX woff2 files found in ${katexFonts}.`)
  }
  const readerZipPath = resolve(distDir, 'reader-bundle.zip')
  const readerZipped = zipSync(readerEntries)
  writeFileSync(readerZipPath, readerZipped)
  const readerMb = (readerZipped.byteLength / (1024 * 1024)).toFixed(2)
  console.log(
    `Wrote ${readerZipPath} (${Object.keys(readerEntries).length} files, ${readerMb} MB, ${readFileSync(readerVersion, 'utf8').trim()})`,
  )
}

main()
