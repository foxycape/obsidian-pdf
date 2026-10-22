import { describe, expect, it } from 'vitest'
import { digestStream } from '@/crypto/hash'

describe('digestStream', () => {
  it('matches known MD5 and SHA-1 vectors', async () => {
    expect(await digestStream('', 'MD5')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(await digestStream('abc', 'MD5')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(await digestStream('', 'SHA-1')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709')
    expect(await digestStream('abc', 'SHA-1')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
    expect(await digestStream('abc', 'SHA-256')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('hashes a Uint8Array view without the surrounding buffer', async () => {
    const backing = new Uint8Array([1, 2, 3, 4, 5])
    const view = backing.subarray(1, 4)
    const viewHash = await digestStream(view, 'MD5')
    expect(viewHash).toBe(await digestStream(new Uint8Array([2, 3, 4]), 'MD5'))
    expect(viewHash).not.toBe(await digestStream(backing, 'MD5'))
  })
})
