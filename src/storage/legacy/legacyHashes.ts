import type { DocumentHasher } from '@/workers/DocumentHasher'
import type { ByteRangeReader } from './ByteRangeReader'

/** Old workspace-core document id: MD5 of this prefix. */
export const LEGACY_HEAD_BYTES = 5 * 1024 * 1024

/** SHA-1 is updated one window at a time so the whole file is never retained. */
export const SHA1_CHUNK_BYTES = 1024 * 1024

export const computeHeadMd5 = async (
  source: ByteRangeReader,
  hasher: DocumentHasher,
): Promise<string> => {
  const end = Math.min(source.size, LEGACY_HEAD_BYTES)
  const parts: Uint8Array[] = []
  let offset = 0
  while (offset < end) {
    const next = Math.min(offset + SHA1_CHUNK_BYTES, end)
    const chunk = await source.read(offset, next)
    if (chunk.byteLength === 0) {
      throw new Error(`Failed to read file bytes at offset ${offset}`)
    }
    const copy = new Uint8Array(chunk.byteLength)
    copy.set(chunk)
    parts.push(copy)
    offset += chunk.byteLength
  }
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const bytes = new Uint8Array(total)
  let writeAt = 0
  for (const part of parts) {
    bytes.set(part, writeAt)
    writeAt += part.byteLength
  }
  return (await hasher.computeMd5(bytes)).toLowerCase()
}

export const computeChunkedSha1 = async (
  source: ByteRangeReader,
  hasher: DocumentHasher,
): Promise<string> =>
  hasher.exclusive(async () => {
    await hasher.beginSha1()
    let offset = 0
    while (offset < source.size) {
      const next = Math.min(offset + SHA1_CHUNK_BYTES, source.size)
      const chunk = await source.read(offset, next)
      if (chunk.byteLength === 0) {
        throw new Error(`Failed to read file bytes at offset ${offset}`)
      }
      const window = chunk.subarray(0, next - offset)
      const copy = new Uint8Array(window.byteLength)
      copy.set(window)
      await hasher.updateSha1(copy)
      offset += chunk.byteLength
    }
    return (await hasher.digestSha1()).toLowerCase()
  })
