import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pngPath = resolve(packageDir, 'assets/logo-160x160.png')
const outPath = resolve(packageDir, 'src/ui/foxycapeLogoData.ts')

mkdirSync(dirname(outPath), { recursive: true })

const b64 = readFileSync(pngPath).toString('base64')
const source = [
  '/** Auto-derived from assets/logo-160x160.png — do not edit by hand. */',
  'export const FOXYCAPE_LOGO_DATA_URL =',
  `  'data:image/png;base64,${b64}'`,
  '',
].join('\n')

writeFileSync(outPath, source)
console.log(`Wrote ${outPath} (${b64.length} base64 chars)`)
