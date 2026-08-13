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

/** Remote pack: cmaps + standard_fonts. Worker/signer are zipped into main.js. */
const INCLUDE_ROOTS = [
  join('pdfjs', 'cmaps'),
  join('pdfjs', 'standard_fonts'),
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
}

main()
