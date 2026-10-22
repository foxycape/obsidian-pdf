import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { buildLocalesId } from './scripts/localesId.mjs'

/** Copy language JSON next to the plugin so local builds do not download locales.zip. */
export const copyLocalesPlugin = (packageDir: string, outDir: string): Plugin => ({
  name: 'foxycape-copy-locales',
  writeBundle() {
    const from = resolve(packageDir, 'src/i18n/locales')
    if (!existsSync(from)) {
      return
    }
    const target = resolve(outDir, 'locales')
    mkdirSync(target, { recursive: true })
    cpSync(from, target, { recursive: true })
    writeFileSync(resolve(target, '.foxycape-locales-version'), `${buildLocalesId(from)}\n`)
  },
})
