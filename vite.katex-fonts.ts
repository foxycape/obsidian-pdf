import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const FONT_URL = /url\(fonts\/(KaTeX_[^)]+?\.woff2)\) format\("woff2"\),url\(fonts\/KaTeX_[^)]+?\.woff\) format\("woff"\),url\(fonts\/KaTeX_[^)]+?\.ttf\) format\("truetype"\)/g
const PLACEHOLDER = /url\(data:application\/x-foxycape-katex,([^)]+)\)/g

type KatexFontsOptions = {
  packageDir: string
  outDir: string
}

/**
 * Keep KaTeX woff2 beside pdfjs (`dist/katex/fonts`) and point styles.css at
 * those files. Library mode would otherwise inline woff2, woff, and ttf.
 */
export const katexFontsPlugin = (options: KatexFontsOptions): Plugin => {
  const fontsSrc = join(options.packageDir, 'node_modules', 'katex', 'dist', 'fonts')
  const fontsOut = join(options.outDir, 'katex', 'fonts')

  const copyFonts = () => {
    if (!existsSync(fontsSrc)) {
      throw new Error(`KaTeX fonts not found at ${fontsSrc}`)
    }
    rmSync(join(options.outDir, 'katex'), { recursive: true, force: true })
    mkdirSync(fontsOut, { recursive: true })
    for (const name of readdirSync(fontsSrc)) {
      if (!name.endsWith('.woff2')) {
        continue
      }
      cpSync(join(fontsSrc, name), join(fontsOut, name))
    }
  }

  return {
    name: 'foxycape-katex-fonts',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.split('?')[0]?.replace(/\\/g, '/') ?? ''
      if (!normalized.endsWith('/katex/dist/katex.min.css')) {
        return null
      }
      return code.replace(
        FONT_URL,
        'url(data:application/x-foxycape-katex,$1)',
      )
    },
    writeBundle() {
      copyFonts()
      const cssNames = ['pdf-bundle.css', 'styles.css']
      let rewritten = false
      for (const name of cssNames) {
        const cssPath = join(options.outDir, name)
        if (!existsSync(cssPath)) {
          continue
        }
        const css = readFileSync(cssPath, 'utf8')
        if (!css.includes('data:application/x-foxycape-katex')) {
          continue
        }
        const next = css.replace(PLACEHOLDER, 'url(katex/fonts/$1)')
        if (next.includes('data:application/x-foxycape-katex')) {
          throw new Error(`KaTeX font urls were not rewritten in ${name}`)
        }
        if (next.includes('data:font')) {
          throw new Error(`${name} still inlines font data`)
        }
        writeFileSync(cssPath, next)
        rewritten = true
      }
      if (!rewritten) {
        throw new Error('KaTeX font urls were not rewritten')
      }
    },
  }
}
