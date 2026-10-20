import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await Promise.all([
  build({
    configFile: resolve(packageDir, 'vite.config.ts'),
    build: { watch: {} },
  }),
  build({
    configFile: resolve(packageDir, 'vite.pdf.config.ts'),
    build: { watch: {} },
  }),
])
