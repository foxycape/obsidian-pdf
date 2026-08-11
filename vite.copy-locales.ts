import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Copy locale JSON files into dist/locales so they stay out of main.js
 * and are loaded on demand at runtime (same pattern as pdf.worker.min.mjs).
 */
export const copyLocaleAssetsPlugin = (outDir: string, localesSrcDir: string): Plugin => {
  const localesOutDir = join(outDir, 'locales')

  const copy = () => {
    if (!existsSync(localesSrcDir)) {
      throw new Error(`Locale source directory not found at ${localesSrcDir}`)
    }

    rmSync(localesOutDir, { recursive: true, force: true })
    mkdirSync(localesOutDir, { recursive: true })
    cpSync(localesSrcDir, localesOutDir, { recursive: true })
  }

  return {
    name: 'copy-locale-assets',
    writeBundle() {
      copy()
    },
  }
}
