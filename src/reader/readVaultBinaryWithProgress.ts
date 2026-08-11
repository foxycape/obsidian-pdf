import type { App, TFile } from 'obsidian'

export type VaultReadProgress = {
  contentLength: number
  receivedLength: number
  done: boolean
}

export type VaultReadProgressCallback = (
  progress: VaultReadProgress,
) => void | Promise<void>

const abortError = () =>
  new DOMException('The operation was aborted.', 'AbortError')

/**
 * Read a vault binary file with progress callbacks via `vault.readBinary`.
 * Reports start (0) then complete; avoids `fetch` for Obsidian review compliance.
 */
export const readVaultBinaryWithProgress = async (
  app: App,
  file: TFile,
  onProgress?: VaultReadProgressCallback,
  signal?: AbortSignal,
): Promise<ArrayBuffer> => {
  const report = async (
    contentLength: number,
    receivedLength: number,
    done: boolean,
  ) => {
    if (!onProgress) {
      return
    }
    await onProgress({ contentLength, receivedLength, done })
  }

  if (signal?.aborted) {
    throw abortError()
  }

  const knownSize = Math.max(0, file.stat?.size ?? 0)
  await report(knownSize, 0, false)

  if (signal?.aborted) {
    throw abortError()
  }

  const data = await app.vault.readBinary(file)

  if (signal?.aborted) {
    throw abortError()
  }

  await report(data.byteLength, data.byteLength, true)
  return data
}
