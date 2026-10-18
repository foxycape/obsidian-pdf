import { describe, expect, it } from 'vitest'
import { createHasher } from '@foxycape/core/kernal/crypto/hash'
import { restoreNativeWebAssembly } from '@/network/ApiClient'

describe('restoreNativeWebAssembly', () => {
  it('puts the native WebAssembly.compile back after signer initialization', () => {
    const nativeWebAssembly = WebAssembly
    const compile = nativeWebAssembly.compile
    const stub = {
      instantiate: () => undefined,
      Memory: function Memory() {},
      Module: function Module() {},
      Instance: function Instance() {},
      RuntimeError: Error,
    } as unknown as typeof WebAssembly
    ;(globalThis as { WebAssembly: typeof WebAssembly }).WebAssembly = stub
    try {
      expect(typeof WebAssembly.compile).not.toBe('function')
      restoreNativeWebAssembly(nativeWebAssembly)
      expect(WebAssembly).toBe(nativeWebAssembly)
      expect(WebAssembly.compile).toBe(compile)
      expect(typeof WebAssembly.compile).toBe('function')
    } finally {
      ;(globalThis as { WebAssembly: typeof WebAssembly }).WebAssembly = nativeWebAssembly
    }
  })

  it('still hashes when the saved WebAssembly has no compile', async () => {
    const nativeWebAssembly = WebAssembly
    const descriptor = Object.getOwnPropertyDescriptor(nativeWebAssembly, 'compile')
    const stub = {
      instantiate: () => undefined,
      Memory: function Memory() {},
      Module: function Module() {},
      Instance: function Instance() {},
      RuntimeError: Error,
    } as unknown as typeof WebAssembly
    Object.defineProperty(nativeWebAssembly, 'compile', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    ;(globalThis as { WebAssembly: typeof WebAssembly }).WebAssembly = stub
    try {
      restoreNativeWebAssembly(nativeWebAssembly)
      const hasher = await createHasher('MD5')
      hasher.update(new TextEncoder().encode('abc'))
      expect(hasher.digest()).toBe('900150983cd24fb0d6963f7d28e17f72')
    } finally {
      ;(globalThis as { WebAssembly: typeof WebAssembly }).WebAssembly = nativeWebAssembly
      if (descriptor) {
        Object.defineProperty(nativeWebAssembly, 'compile', descriptor)
      }
    }
  })
})
