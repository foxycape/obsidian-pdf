import { normalizePath, type Plugin } from 'obsidian'
import { hasEmbeddedRuntimeAssets } from '@/assets/ensureRuntimeAssets'

/** Kept for ApiSettings.wasmSignerFilePath compatibility (not used for disk IO). */
export const WASM_SIGNER_RELATIVE = 'static/signer.js'

let cachedSignerBlobUrl: string | null = null

/**
 * Load `static/signer.js` from the plugin directory as a Blob URL for
 * `injectExternalJS`. Does **not** download remote fonts — callers that need
 * signer (license / API) must `ensureEmbeddedRuntimeAssets` first.
 */
export const resolveWasmSignerUrl = async (plugin: Plugin): Promise<string> => {
  if (cachedSignerBlobUrl) {
    return cachedSignerBlobUrl
  }

  if (!(await hasEmbeddedRuntimeAssets(plugin))) {
    throw new Error(
      'Embedded runtime assets are not installed yet (worker/signer missing).',
    )
  }

  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
  }

  const path = normalizePath(`${pluginDir}/${WASM_SIGNER_RELATIVE}`)
  if (!(await plugin.app.vault.adapter.exists(path))) {
    throw new Error(`WASM signer missing at ${path}.`)
  }

  const signerSource = await plugin.app.vault.adapter.read(path)
  if (!signerSource) {
    throw new Error('WASM signer source is empty.')
  }

  const blob = new Blob([signerSource], { type: 'text/javascript' })
  cachedSignerBlobUrl = URL.createObjectURL(blob)
  return cachedSignerBlobUrl
}

export const disposeWasmSignerBlobUrl = () => {
  if (!cachedSignerBlobUrl) {
    return
  }
  URL.revokeObjectURL(cachedSignerBlobUrl)
  cachedSignerBlobUrl = null
}
