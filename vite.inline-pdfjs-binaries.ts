import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const CMAPS_ID = '\0virtual:pdfjs-cmaps'
const FONTS_ID = '\0virtual:pdfjs-standard-fonts'

const listBinaryFiles = (dir: string, extensions: string[]) => {
  return readdirSync(dir)
    .filter((name) => extensions.some((ext) => name.toLowerCase().endsWith(ext)))
    .sort()
}

const buildBase64RecordModule = (dir: string, files: string[]) => {
  const entries = files.map((name) => {
    const b64 = readFileSync(join(dir, name)).toString('base64')
    return `  ${JSON.stringify(name)}: ${JSON.stringify(b64)},`
  })
  return `export default {\n${entries.join('\n')}\n}\n`
}

/**
 * Embed pdf.js cmaps / standard_fonts as base64 maps so the Obsidian plugin
 * can ship as main.js + styles.css + manifest.json with no sidecar dirs.
 */
export const inlinePdfjsBinariesPlugin = (pdfjsDir: string): Plugin => {
  const cmapsDir = join(pdfjsDir, 'cmaps')
  const fontsDir = join(pdfjsDir, 'standard_fonts')

  return {
    name: 'inline-pdfjs-binaries',
    resolveId(id) {
      if (id === 'virtual:pdfjs-cmaps') {
        return CMAPS_ID
      }
      if (id === 'virtual:pdfjs-standard-fonts') {
        return FONTS_ID
      }
      return null
    },
    load(id) {
      if (id === CMAPS_ID) {
        const files = listBinaryFiles(cmapsDir, ['.bcmap'])
        return buildBase64RecordModule(cmapsDir, files)
      }
      if (id === FONTS_ID) {
        const files = listBinaryFiles(fontsDir, ['.pfb', '.ttf'])
        return buildBase64RecordModule(fontsDir, files)
      }
      return null
    },
  }
}
