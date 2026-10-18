import type { HashAlgorithm } from '@foxycape/core/kernal/crypto/ICrypto'
import { digestMany, digestStream, SIMPLE_ID_BYTE_LENGTH } from '@foxycape/core/kernal/crypto/hash'
import { bitmapToOffscreenCanvas, convertToBlob } from '../image/canvas'
import type { ImageSource, ResizeImageOptions } from '../image/IImage'
import { WebImage } from '../image/WebImage'
import type { ComputeIdsResult, HashJob } from './IGlobalWorker'
import { createHashSession } from './hashSession'

type WorkerScope = {
  postMessage: (message: unknown, transfer?: Transferable[]) => void
  addEventListener: (type: 'message', listener: (e: MessageEvent) => void) => void
}

const workerSelf = self as unknown as WorkerScope
const image = new WebImage()
const sha1 = createHashSession()

const sha1Actions = new Set(['beginSha1', 'updateSha1', 'digestSha1'])

const postBlobTransfer = async (
  eventId: string,
  action: string,
  blob: Blob,
  fallbackMimetype?: string,
) => {
  const resultBuffer = await blob.arrayBuffer()
  workerSelf.postMessage(
    {
      eventId,
      action,
      state: 'SUCCESS',
      buffer: resultBuffer,
      mimetype: blob.type || fallbackMimetype || 'application/octet-stream',
    },
    [resultBuffer],
  )
}

const resolveHashData = (data: Record<string, unknown>): Blob | Uint8Array | ArrayBuffer => {
  const payload = data.data ?? data.buffer
  if (
    payload instanceof Blob ||
    payload instanceof Uint8Array ||
    payload instanceof ArrayBuffer
  ) {
    return payload
  }
  throw new Error('Unsupported hash data type')
}

const toUint8Array = async (data: Blob | Uint8Array | ArrayBuffer): Promise<Uint8Array> => {
  if (data instanceof Uint8Array) {
    return data
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }
  return new Uint8Array(await data.arrayBuffer())
}

/**
 * Compute simpleId (MD5 of the first 5MB) and resourceId (SHA-1 of the full content)
 * in one scan.
 */
export const computeIds = async (
  data: Blob | Uint8Array | ArrayBuffer,
): Promise<ComputeIdsResult> => {
  const [simpleId, resourceId] = await digestMany(data, [
    { algorithm: 'MD5', maxBytes: SIMPLE_ID_BYTE_LENGTH },
    { algorithm: 'SHA-1' },
  ])
  return { simpleId: simpleId.toLowerCase(), resourceId: resourceId.toLowerCase() }
}

const resolveImageSource = (data: Record<string, unknown>): ImageSource => {
  if (data.sourceType === 'buffer') {
    return new Blob([data.buffer as ArrayBuffer], {
      type: (data.imageMimetype as string) || 'application/octet-stream',
    })
  }
  if (data.sourceType === 'url') {
    return data.imageSource as string
  }
  return data.imageSource as ImageSource
}

/**
 * Entry point for handling messages received by the global worker.
 */
const readEventId = (value: unknown) => (typeof value === 'string' ? value : '')

const readEncodeOptions = (value: unknown): ImageEncodeOptions | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const record = value as Record<string, unknown>
  return {
    type: typeof record.type === 'string' ? record.type : undefined,
    quality: typeof record.quality === 'number' ? record.quality : undefined,
  }
}

export const handleWorkerMessage = async (data: Record<string, unknown>) => {
  const eventId = readEventId(data.eventId)
  const action = data.action
  try {
    if (action === 'resizeImage') {
      const options = data.options as ResizeImageOptions | undefined
      const blob = await image.resizeImage(
        resolveImageSource(data),
        data.targetWidth as number,
        data.targetHeight as number,
        options,
      )
      return postBlobTransfer(eventId, 'resizeImage', blob, options?.mimetype)
    }
    if (action === 'getImageSize') {
      const size = await image.getImageSize(resolveImageSource(data))
      return workerSelf.postMessage({
        eventId,
        action,
        state: 'SUCCESS',
        size,
      })
    }
    if (action === 'computeMd5') {
      const md5 = (await digestStream(resolveHashData(data), 'MD5')).toLowerCase()
      return workerSelf.postMessage({
        eventId,
        action,
        state: 'SUCCESS',
        md5,
      })
    }
    if (action === 'computeFileHash') {
      // Preserve the reader default (SHA-1); WebCrypto.digest defaults to SHA-256.
      const algorithm = (data.algorithm as HashAlgorithm | undefined) ?? 'SHA-1'
      const hash = (await digestStream(resolveHashData(data), algorithm)).toLowerCase()
      return workerSelf.postMessage({
        eventId,
        action,
        state: 'SUCCESS',
        fileHash: hash,
      })
    }
    if (action === 'computeIds') {
      const { simpleId, resourceId } = await computeIds(resolveHashData(data))
      return workerSelf.postMessage({
        eventId,
        action,
        state: 'SUCCESS',
        simpleId,
        resourceId,
      })
    }
    if (action === 'computeHashes') {
      const specs = Array.isArray(data.specs) ? (data.specs as HashJob[]) : []
      const hashes = (await digestMany(resolveHashData(data), specs)).map((hash) =>
        hash.toLowerCase(),
      )
      return workerSelf.postMessage({
        eventId,
        action,
        state: 'SUCCESS',
        hashes,
      })
    }
    if (action === 'canvasToBlob') {
      const source = data.canvas
      const isBitmap = typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap
      const canvas = isBitmap ? bitmapToOffscreenCanvas(source) : (source as OffscreenCanvas)
      if (isBitmap) {
        source.close()
      }
      const encodeOptions = readEncodeOptions(data.options)
      const blob = await convertToBlob(canvas, encodeOptions)
      return postBlobTransfer(eventId, 'canvasToBlob', blob, encodeOptions?.type)
    }
    if (action === 'beginSha1') {
      await sha1.begin()
      return workerSelf.postMessage({
        eventId,
        action,
        state: 'SUCCESS',
      })
    }
    if (action === 'updateSha1') {
      sha1.update(await toUint8Array(resolveHashData(data)))
      return workerSelf.postMessage({
        eventId,
        action,
        state: 'SUCCESS',
      })
    }
    if (action === 'digestSha1') {
      return workerSelf.postMessage({
        eventId,
        action,
        state: 'SUCCESS',
        hash: sha1.digest(),
      })
    }
    return workerSelf.postMessage({ eventId, action, state: 'FAIL', error: 'Unknown worker action' })
  } catch (err) {
    if (typeof action === 'string' && sha1Actions.has(action)) {
      sha1.reset()
    }
    return workerSelf.postMessage({
      eventId,
      state: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
