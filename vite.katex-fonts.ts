import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const FONT_SRC = /url\(fonts\/(KaTeX_[^)]+?\.woff2)\) format\("woff2"\),url\(fonts\/KaTeX_[^)]+?\.woff\) format\("woff"\),url\(fonts\/KaTeX_[^)]+?\.ttf\) format\("truetype"\)/g

type KatexFontsOptions = {
  packageDir: string
  outDir: string
}

/** Keep KaTeX layout rules and embed each woff2 as a data URI. */
export const embedKatexWoff2 = (
  css: string,
  readWoff2: (fileName: string) => Buffer,
): string => {
  let embedded = 0
  const next = css.replace(FONT_SRC, (_match, fileName: string) => {
    embedded += 1
    const base64 = readWoff2(fileName).toString('base64')
    return `url(data:font/woff2;base64,${base64}) format("woff2")`
  })
  if (
    embedded === 0 ||
    next.includes('url(fonts/') ||
    next.includes('format("woff")') ||
    next.includes('format("truetype")')
  ) {
    throw new Error('KaTeX woff2 fonts were not embedded')
  }
  return next
}

/**
 * Write `dist/katex/katex.css` with embedded woff2.
 * Bundled plugin CSS must not contain KaTeX: Obsidian injects styles.css as a style tag.
 */
export const katexFontsPlugin = (options: KatexFontsOptions): Plugin => {
  const fontsSrc = join(options.packageDir, 'node_modules', 'katex', 'dist', 'fonts')
  const cssSrc = join(options.packageDir, 'node_modules', 'katex', 'dist', 'katex.min.css')
  const katexOut = join(options.outDir, 'katex')
  const cssOut = join(katexOut, 'katex.css')

  const writeCss = () => {
    if (!existsSync(cssSrc) || !existsSync(fontsSrc)) {
      throw new Error(`KaTeX CSS not found at ${cssSrc}`)
    }
    const css = embedKatexWoff2(readFileSync(cssSrc, 'utf8'), (fileName) => {
      const fontPath = join(fontsSrc, fileName)
      if (!existsSync(fontPath)) {
        throw new Error(`KaTeX font not found at ${fontPath}`)
      }
      return readFileSync(fontPath)
    })
    rmSync(katexOut, { recursive: true, force: true })
    mkdirSync(katexOut, { recursive: true })
    writeFileSync(cssOut, css)
  }

  return {
    name: 'foxycape-katex-fonts',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.split('?')[0]?.replace(/\\/g, '/') ?? ''
      if (!normalized.endsWith('/katex/dist/katex.min.css')) {
        return null
      }
      if (code.includes('url(fonts/')) {
        return ''
      }
      return null
    },
    writeBundle() {
      writeCss()
    },
  }
}
