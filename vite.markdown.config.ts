import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { createObsidianPluginConfig } from './scripts/vite/createObsidianPluginConfig'
import { buildMarkdownId } from './scripts/markdownId.mjs'

const packageDir = fileURLToPath(new URL('.', import.meta.url))
const outDir = resolve(packageDir, 'dist')
const markdownLibPath = resolve(outDir, 'markdown-lib.js')

const writeMarkdownIdPlugin = (): Plugin => ({
  name: 'write-markdown-id',
  writeBundle() {
    const source = readFileSync(markdownLibPath)
    const id = buildMarkdownId(source)
    writeFileSync(join(outDir, '.foxycape-markdown-id'), `${id}\n`)
    mkdirSync(join(outDir, 'markdown'), { recursive: true })
    writeFileSync(join(outDir, 'markdown', '.foxycape-markdown-version'), `${id}\n`)
  },
})

const base = createObsidianPluginConfig({
  packageDir,
  outDirName: 'dist',
  entry: resolve(packageDir, 'src/markdown-entry.ts'),
  fileName: 'markdown-lib.js',
  cssFileName: 'markdown-lib.css',
  tailwind: false,
})

export default {
  ...base,
  plugins: [...(base.plugins ?? []), writeMarkdownIdPlugin()],
}
