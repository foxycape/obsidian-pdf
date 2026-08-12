import signerSource from '../../static/signer.js?raw'

/** Kept for ApiSettings.wasmSignerFilePath compatibility (not used for disk IO). */
export const WASM_SIGNER_RELATIVE = 'static/signer.js'

let cachedSignerBlobUrl: string | null = null

/**
 * Inlined signer glue as a Blob URL for `injectExternalJS`.
 */
export const resolveWasmSignerUrl = async (): Promise<string> => {
  if (cachedSignerBlobUrl) {
    return cachedSignerBlobUrl
  }
  if (!signerSource) {
    throw new Error('WASM signer source is not bundled into main.js.')
  }
  const blob = new Blob([signerSource], { type: 'text/javascript' })
  cachedSignerBlobUrl = URL.createObjectURL(blob)
  return cachedSignerBlobUrl
}

export const getWasmSignerSource = (): string => signerSource
