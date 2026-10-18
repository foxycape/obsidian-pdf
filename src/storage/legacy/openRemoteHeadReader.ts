import type { IHttpClient } from '@foxycape/core/kernal/network/IHttpClient'
import type { ByteRangeReader } from './ByteRangeReader'
import { LEGACY_HEAD_BYTES } from './legacyHashes'

/**
 * Remote prefix reader. If the host ignores range requests, returns undefined
 * instead of downloading the file.
 */
export const openRemoteHeadReader = async (
  httpClient: IHttpClient,
  url: string,
): Promise<ByteRangeReader | undefined> => {
  const probe = await httpClient.getRange(url, { start: 0, end: 1 })
  if (!probe.partial || probe.totalSize == null || probe.totalSize <= 0) {
    return undefined
  }
  const size = probe.totalSize
  const readable = Math.min(size, LEGACY_HEAD_BYTES)
  return {
    size: readable,
    read: async (start, end) => {
      const clampedEnd = Math.min(end, readable)
      if (start >= clampedEnd) {
        return new Uint8Array(0)
      }
      const result = await httpClient.getRange(url, { start, end: clampedEnd })
      if (!result.partial) {
        throw new Error('HTTP range request was ignored')
      }
      return new Uint8Array(result.data)
    },
    close: async () => {},
  }
}
