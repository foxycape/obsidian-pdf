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
 * Read a vault binary file with byte-level progress via
 * `adapter.getResourcePath` + `fetch` streaming.
 * Falls back to `vault.readBinary` when streaming is unavailable.
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
  const resourceUrl = app.vault.adapter.getResourcePath(file.path)

  let response: Response
  try {
    response = await fetch(resourceUrl, { signal })
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw abortError()
    }
    const data = await app.vault.readBinary(file)
    await report(data.byteLength, data.byteLength, true)
    return data
  }

  if (!response.ok) {
    throw new Error(
      `Failed to read vault file "${file.path}" (${response.status})`,
    )
  }

  const headerLength = Number(response.headers.get('Content-Length') || 0)
  const contentLength =
    knownSize > 0
      ? knownSize
      : Number.isFinite(headerLength) && headerLength > 0
        ? headerLength
        : 0

  if (!response.body) {
    const buffer = await response.arrayBuffer()
    if (signal?.aborted) {
      throw abortError()
    }
    await report(buffer.byteLength || contentLength, buffer.byteLength, true)
    return buffer
  }

  return readStream(response.body, contentLength, report, signal)
}

const readStream = async (
  body: ReadableStream<Uint8Array>,
  contentLength: number,
  report: (
    contentLength: number,
    receivedLength: number,
    done: boolean,
  ) => Promise<void>,
  signal?: AbortSignal,
): Promise<ArrayBuffer> => {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let receivedLength = 0

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => undefined)
        throw abortError()
      }

      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (!value?.byteLength) {
        continue
      }

      chunks.push(value)
      receivedLength += value.byteLength
      await report(
        contentLength > 0 ? contentLength : receivedLength,
        receivedLength,
        false,
      )
    }
  } finally {
    reader.releaseLock()
  }

  const result = new Uint8Array(receivedLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }

  const total = contentLength > 0 ? contentLength : receivedLength
  await report(total, receivedLength, true)
  return result.buffer
}
