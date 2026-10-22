import { digestStream } from '@/crypto/hash'
import { describe, expect, it } from 'vitest'
import { createHashSession } from '@/workers/hashSession'

describe('hash session', () => {
  it('hashes abc as MD5', async () => {
    expect(await digestStream('abc', 'MD5')).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  it('matches a one-shot SHA-1 when the input arrives in chunks', async () => {
    const encoded = new TextEncoder().encode('abc')
    const expected = await digestStream('abc', 'SHA-1')
    const session = createHashSession()
    await session.begin()
    session.update(encoded.slice(0, 1))
    session.update(encoded.slice(1))
    const digested = session.digest()
    expect(digested).toBe(expected)
    expect(digested).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })

  it('reports an error when SHA-1 is updated before init', () => {
    const session = createHashSession()
    expect(() => session.update(new TextEncoder().encode('a'))).toThrow(
      'SHA-1 hasher is not initialized',
    )
  })
})
