import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const markdownConfig = resolve(packageDir, 'vite.markdown.config.ts')
const readerConfig = resolve(packageDir, 'vite.reader.config.ts')
const mainConfig = resolve(packageDir, 'vite.config.ts')
const pdfConfig = resolve(packageDir, 'vite.pdf.config.ts')

await build({ configFile: markdownConfig })
await build({ configFile: readerConfig })

await Promise.all([
  build({
    configFile: mainConfig,
    build: { watch: {} },
  }),
  build({
    configFile: pdfConfig,
    build: { watch: {} },
  }),
  build({
    configFile: readerConfig,
    build: { watch: {} },
  }),
  build({
    configFile: markdownConfig,
    build: { watch: {} },
  }),
])
