import { createHasher, type StreamingHasher } from '@foxycape/core/kernal/crypto/hash'

/**
 * One SHA-1 stream at a time. The main-thread client serializes begin/update/digest
 * through {@link DocumentHasher.exclusive}, so a second stream cannot overlap.
 */
export const createHashSession = () => {
  let sha1: StreamingHasher | undefined

  const requireSha1 = () => {
    if (!sha1) {
      throw new Error('SHA-1 hasher is not initialized')
    }
    return sha1
  }

  return {
    begin: async () => {
      sha1 = await createHasher('SHA-1')
    },
    update: (chunk: Uint8Array) => {
      requireSha1().update(chunk)
    },
    digest: () => {
      const hash = requireSha1().digest().toLowerCase()
      sha1 = undefined
      return hash
    },
    reset: () => {
      sha1 = undefined
    },
  }
}
