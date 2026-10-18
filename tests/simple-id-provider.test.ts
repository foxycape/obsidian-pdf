import { computeMd5 } from '@foxycape/core/kernal/crypto/MD5'
import { MemoryByteSource } from '@foxycape/core/kernal/io/MemoryByteSource'
import type { IFileUrlParser } from '@foxycape/core/kernal/services/fileUrlParser/IFileUrlParser'
import { describe, expect, it } from 'vitest'
import { SimpleIdProvider } from '@/reader/SimpleIdProvider'

const MB = 1024 * 1024

const fill = (size: number) => {
  const bytes = new Uint8Array(size)
  for (let index = 0; index < size; index += 1) {
    bytes[index] = index % 251
  }
  return bytes
}

const providerFor = (bytes: Uint8Array) =>
  new SimpleIdProvider(
    async () =>
      ({
        parse: async () => ({ byteSource: new MemoryByteSource(bytes) }),
      }) as unknown as IFileUrlParser,
    (data) => computeMd5(data),
  )

describe('SimpleIdProvider', () => {
  it('hashes the whole file when it is at most 3MB', async () => {
    const bytes = fill(100)
    const id = await providerFor(bytes).getSimpleId(bytes)
    expect(id).toBe(await computeMd5(bytes))
  })

  it('hashes the head, middle, tail, and decimal size when the file is larger than 3MB', async () => {
    const bytes = fill(3 * MB + 50)
    const sample = 1 * MB
    const middleStart = Math.floor((bytes.byteLength - sample) / 2)
    const parts = [
      bytes.slice(0, sample),
      bytes.slice(middleStart, middleStart + sample),
      bytes.slice(bytes.byteLength - sample),
      new TextEncoder().encode(String(bytes.byteLength)),
    ]
    const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0))
    let offset = 0
    for (const part of parts) {
      joined.set(part, offset)
      offset += part.byteLength
    }
    const expected = await computeMd5(joined)
    const full = await computeMd5(bytes)

    expect(await providerFor(bytes).getSimpleId(bytes)).toBe(expected)
    expect(expected).not.toBe(full)
  })
})
