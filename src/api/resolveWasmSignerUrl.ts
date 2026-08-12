import { normalizePath, type Plugin } from 'obsidian'
import { ensureRuntimeAssets } from '@/assets/ensureRuntimeAssets'

/** Kept for ApiSettings.wasmSignerFilePath compatibility (not used for disk IO). */
export const WASM_SIGNER_RELATIVE = 'static/signer.js'

let cachedSignerBlobUrl: string | null = null

/**
 * Load `static/signer.js` from the plugin directory as a Blob URL for
 * `injectExternalJS`. Downloads the runtime asset pack on first use if needed.
 */
export const resolveWasmSignerUrl = async (plugin: Plugin): Promise<string> => {
  if (cachedSignerBlobUrl) {
    return cachedSignerBlobUrl
  }

  await ensureRuntimeAssets(plugin)

  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
  }

  const path = normalizePath(`${pluginDir}/${WASM_SIGNER_RELATIVE}`)
  const signerSource = await plugin.app.vault.adapter.read(path)
  if (!signerSource) {
    throw new Error('WASM signer source is missing under the plugin directory.')
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
