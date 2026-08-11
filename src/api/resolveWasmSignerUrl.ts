import { normalizePath, type Plugin } from 'obsidian'

/** Relative to plugin dist root (copied by vite.copy-signer). */
export const WASM_SIGNER_RELATIVE = 'static/signer.js'

/**
 * Resolve a loadable URL for `injectExternalJS` / ApiClient WASM signing.
 * Uses vault adapter resource path (same pattern as pdf.js static assets).
 */
export const resolveWasmSignerUrl = async (plugin: Plugin): Promise<string> => {
  const pluginDir = plugin.manifest.dir
  if (!pluginDir) {
    throw new Error('Plugin directory is unavailable (manifest.dir is empty).')
  }

  const adapter = plugin.app.vault.adapter
  const signerPath = normalizePath(`${pluginDir}/${WASM_SIGNER_RELATIVE}`)
  if (!(await adapter.exists(signerPath))) {
    throw new Error(
      `WASM signer missing at ${signerPath}. Rebuild the plugin so dist/static/signer.js is copied.`,
    )
  }

  return adapter.getResourcePath(signerPath)
}
