import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { zipSync } from 'fflate'
import type { Plugin } from 'vite'

export const VIRTUAL_EMBEDDED_ASSETS_ID = 'virtual:foxycape-embedded-assets'

const WORKER_RELATIVE = 'legacy/build/pdf.worker.min.mjs'

type EmbedRuntimeAssetsOptions = {
  corePdfjsDir: string
  signerPath: string
}

const toBase64Module = (base64: string): string =>
  `export const EMBEDDED_RUNTIME_ASSETS_BASE64 = ${JSON.stringify(base64)}\n`

/**
 * Zip pdf.worker + signer at build time and expose them as a Base64 virtual
 * module so community installs (main.js only) can extract without a download.
 */
export const embedRuntimeAssetsPlugin = (
  options: EmbedRuntimeAssetsOptions,
): Plugin => {
  const workerPath = join(options.corePdfjsDir, WORKER_RELATIVE)

  return {
    name: 'embed-foxycape-runtime-assets',
    enforce: 'pre',
    resolveId(id) {
      if (id === VIRTUAL_EMBEDDED_ASSETS_ID) {
        return id
      }
      return null
    },
    load(id) {
      if (id !== VIRTUAL_EMBEDDED_ASSETS_ID) {
        return null
      }
      if (!existsSync(workerPath)) {
        throw new Error(`pdf.js worker not found at ${workerPath}`)
      }
      if (!existsSync(options.signerPath)) {
        throw new Error(`WASM signer not found at ${options.signerPath}`)
      }

      this.addWatchFile(workerPath)
      this.addWatchFile(options.signerPath)

      const zipped = zipSync(
        {
          'pdfjs/pdf.worker.min.mjs': new Uint8Array(readFileSync(workerPath)),
          'static/signer.js': new Uint8Array(readFileSync(options.signerPath)),
        },
        { level: 6 },
      )
      const base64 = Buffer.from(zipped).toString('base64')
      const zipKb = (zipped.byteLength / 1024).toFixed(0)
      const b64Kb = (base64.length / 1024).toFixed(0)
      console.log(
        `[foxycape-pdf] embedded worker+signer zip ${zipKb} KB (base64 ${b64Kb} KB)`,
      )
      return toBase64Module(base64)
    },
  }
}

/** Empty payload for unit tests that should not pull the real worker zip. */
export const stubEmbeddedRuntimeAssetsPlugin = (base64 = ''): Plugin => ({
  name: 'stub-foxycape-embedded-assets',
  resolveId(id) {
    if (id === VIRTUAL_EMBEDDED_ASSETS_ID) {
      return id
    }
    return null
  },
  load(id) {
    if (id !== VIRTUAL_EMBEDDED_ASSETS_ID) {
      return null
    }
    return toBase64Module(base64)
  },
})
