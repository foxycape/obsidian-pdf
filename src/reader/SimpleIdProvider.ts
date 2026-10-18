import type { IByteSource } from '@foxycape/core/kernal/io/IByteSource'
import type { IFileUrlParser } from '@foxycape/core/kernal/services/fileUrlParser/IFileUrlParser'
import type { ISimpleIdProvider } from '@foxycape/core/kernal/services/identity/ISimpleIdProvider'

const MB = 1024 * 1024
/** Files at or below this size are hashed in full. */
const FULL_MD5_LIMIT = 3 * MB
const SAMPLE_BYTES = 1 * MB

/**
 * Same sampled MD5 as the reader app.
 * Reads only the head, middle, and tail ranges. It does not keep the whole file.
 */
export class SimpleIdProvider implements ISimpleIdProvider {
  constructor(
    private readonly getFileUrlParser: () => Promise<IFileUrlParser>,
    private readonly computeMd5: (bytes: Uint8Array) => Promise<string>,
  ) {}

  getSimpleId = async (url: unknown): Promise<string> => {
    const parser = await this.getFileUrlParser()
    const parsed = await parser.parse(url)
    const source = parsed.byteSource
    if (!source) {
      throw new Error('Unable to read file bytes')
    }
    try {
      const parts: Uint8Array[] = []
      if (source.size <= FULL_MD5_LIMIT) {
        await collectRange(source, parts, 0, source.size)
      } else {
        const middleStart = Math.floor((source.size - SAMPLE_BYTES) / 2)
        await collectRange(source, parts, 0, SAMPLE_BYTES)
        await collectRange(source, parts, middleStart, middleStart + SAMPLE_BYTES)
        await collectRange(source, parts, source.size - SAMPLE_BYTES, source.size)
        parts.push(new TextEncoder().encode(String(source.size)))
      }
      return await this.computeMd5(concatBytes(parts))
    } finally {
      await source.close()
    }
  }
}

const concatBytes = (parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }
  return output
}

const collectRange = async (
  source: IByteSource,
  parts: Uint8Array[],
  start: number,
  end: number,
) => {
  let offset = start
  while (offset < end) {
    const next = Math.min(offset + SAMPLE_BYTES, end)
    const chunk = await source.read(offset, next)
    if (chunk.byteLength === 0) {
      throw new Error(`Failed to read file bytes at offset ${offset}`)
    }
    const copy = new Uint8Array(chunk.byteLength)
    copy.set(chunk)
    parts.push(copy)
    offset += chunk.byteLength
  }
}
