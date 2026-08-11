import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Copy WASM signer glue (`static/signer.js`) into dist/static for runtime inject.
 */
export const copySignerAssetsPlugin = (outDir: string, signerSrcFile: string): Plugin => {
  const staticOutDir = join(outDir, 'static')

  const copy = () => {
    if (!existsSync(signerSrcFile)) {
      throw new Error(`WASM signer not found at ${signerSrcFile}`)
    }

    rmSync(staticOutDir, { recursive: true, force: true })
    mkdirSync(staticOutDir, { recursive: true })
    cpSync(signerSrcFile, join(staticOutDir, 'signer.js'))
  }

  return {
    name: 'copy-signer-assets',
    writeBundle() {
      copy()
    },
  }
}
