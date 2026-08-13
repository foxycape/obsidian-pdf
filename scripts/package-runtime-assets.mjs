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
const zipPath = resolve(distDir, 'foxycape-pdf-assets.zip')

/** Folders / files included in the runtime asset pack (not inlined into main.js). */
const INCLUDE_ROOTS = [
  join('pdfjs', 'cmaps'),
  join('pdfjs', 'standard_fonts'),
]
const INCLUDE_FILES = [
  join('pdfjs', 'pdf.worker.min.mjs'),
  join('static', 'signer.js'),
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
  for (const file of INCLUDE_FILES) {
    const abs = join(distDir, file)
    if (!existsSync(abs)) {
      throw new Error(
        `Missing ${file} under dist/. Run vite build (copy plugins) before packaging assets.`,
      )
    }
  }

  /** @type {Record<string, Uint8Array>} */
  const entries = {}
  for (const root of INCLUDE_ROOTS) {
    const absRoot = join(distDir, root)
    for (const file of walkFiles(absRoot)) {
      entries[toZipKey(file)] = new Uint8Array(readFileSync(file))
    }
  }
  for (const file of INCLUDE_FILES) {
    const abs = join(distDir, file)
    entries[toZipKey(abs)] = new Uint8Array(readFileSync(abs))
  }

  // Marker is written by copy-pdfjs from pdf.js + signer id (not plugin semver)
  // so `npm run link` / full dist installs skip the download. Zip it as-is.
  const markerKey = 'pdfjs/.foxycape-assets-version'
  const markerPath = join(distDir, 'pdfjs', '.foxycape-assets-version')
  if (!existsSync(markerPath)) {
    throw new Error(
      `Missing ${markerKey} under dist/. Run vite build (copy plugins) before packaging assets.`,
    )
  }
  const assetsId = readFileSync(markerPath, 'utf8').trim()
  if (!assetsId.startsWith('pdfjs-')) {
    throw new Error(
      `Unexpected assets id in ${markerPath}: ${assetsId}. Expected pdfjs-{version}+signer-{hash}.`,
    )
  }
  entries[markerKey] = new Uint8Array(Buffer.from(`${assetsId}\n`, 'utf8'))

  const zipped = zipSync(entries, { level: 6 })
  writeFileSync(zipPath, zipped)
  const mb = (zipped.byteLength / (1024 * 1024)).toFixed(2)
  console.log(`Wrote ${zipPath} (${Object.keys(entries).length} files, ${mb} MB)`)
}

main()
