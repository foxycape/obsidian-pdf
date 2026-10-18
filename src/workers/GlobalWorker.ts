import { getUuid } from '@foxycape/core/kernal/common/uuid'
import type { ImageBinary, ImageSize, ImageSource, ResizeImageOptions } from '../image/IImage'
import type { ComputeIdsResult, HashJob, IGlobalWorker } from './IGlobalWorker'

type BlobTransferResponse = { buffer: ArrayBuffer; mimetype: string }

type PendingCallback = {
  resolve: (value: Record<string, unknown>) => void
  reject: (reason?: unknown) => void
}

const blobFromTransfer = (response: BlobTransferResponse) =>
  new Blob([response.buffer], { type: response.mimetype })

const workerError = (data: Record<string, unknown>) => {
  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error
  }
  return 'Worker request failed'
}

const readString = (value: unknown, field: string) => {
  if (typeof value === 'string') {
    return value
  }
  throw new Error(`Worker response is missing ${field}`)
}

/**
 * Blob/File stays a reference so the worker can slice it.
 * An ArrayBuffer or a Uint8Array that owns its buffer is transferred, so the
 * bytes are not copied onto both threads. A view is copied first, because
 * transferring would detach the rest of the underlying buffer.
 */
const toHashMessage = (
  file: Blob | Uint8Array | ArrayBuffer,
): { data: Blob | Uint8Array | ArrayBuffer; transfer?: Transferable[] } => {
  if (file instanceof Blob) {
    return { data: file }
  }
  if (file instanceof Uint8Array) {
    const ownsBuffer = file.byteOffset === 0 && file.byteLength === file.buffer.byteLength
    const bytes = ownsBuffer ? file : file.slice()
    return { data: bytes, transfer: [bytes.buffer] }
  }
  return { data: file, transfer: [file] }
}

/**
 * Main-thread proxy for the global Web Worker.
 */
export class GlobalWorker implements IGlobalWorker {
  private readonly worker: Worker
  private callbacks = new Map<string, PendingCallback>()
  private sha1Chain: Promise<void> = Promise.resolve()
  private isDisposed = false

  constructor(worker: Worker) {
    this.worker = worker
    this.worker.addEventListener('message', this.onMessage)
    this.worker.onerror = (event) => {
      console.error(this.constructor.name, 'worker onerror', event)
    }
    this.worker.onmessageerror = (event) => {
      console.error(this.constructor.name, 'worker onmessageerror', event)
    }
  }

  dispose = async (): Promise<void> => {
    if (this.isDisposed) {
      return
    }
    this.isDisposed = true
    this.callbacks.clear()
    this.worker.removeEventListener('message', this.onMessage)
    this.worker.terminate()
  }

  exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    if (this.isDisposed) {
      return Promise.reject(new Error('GlobalWorker has been disposed'))
    }
    const run: Promise<T> = this.sha1Chain.then(
      () => task(),
      () => task(),
    )
    this.sha1Chain = (async () => {
      try {
        await run
      } catch {
        // A failed SHA-1 stream must not block the next one.
      }
    })()
    return run
  }

  resizeImage = async (
    image: ImageSource,
    targetWidth: number,
    targetHeight: number,
    options?: ResizeImageOptions,
  ): Promise<Blob> => {
    this.checkDisposed()
    const eventId = getUuid(true)
    const payload: Record<string, unknown> = {
      eventId,
      action: 'resizeImage',
      targetWidth,
      targetHeight,
      options,
    }
    const transfer: Transferable[] = []
    await this.assignImageSource(payload, transfer, image, options?.mimetype)
    return this.requestBlob(eventId, payload, transfer)
  }

  getImageSize = async (image: ImageSource): Promise<ImageSize> => {
    this.checkDisposed()
    const eventId = getUuid(true)
    const payload: Record<string, unknown> = {
      eventId,
      action: 'getImageSize',
    }
    const transfer: Transferable[] = []
    await this.assignImageSource(payload, transfer, image)
    return this.request(eventId, payload, transfer, (data) => data.size as ImageSize)
  }

  computeMd5 = async (file: Blob | Uint8Array | ArrayBuffer) => {
    this.checkDisposed()
    const eventId = getUuid(true)
    const { data, transfer } = toHashMessage(file)
    return this.request(eventId, { eventId, action: 'computeMd5', data }, transfer, (response) =>
      readString(response.md5, 'md5'),
    )
  }

  computeFileHash = async (
    file: Blob | Uint8Array | ArrayBuffer,
    algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-512',
  ) => {
    this.checkDisposed()
    const eventId = getUuid(true)
    const { data, transfer } = toHashMessage(file)
    return this.request(
      eventId,
      { eventId, action: 'computeFileHash', data, algorithm },
      transfer,
      (response) => readString(response.fileHash, 'fileHash'),
    )
  }

  computeIds = async (data: Blob | Uint8Array | ArrayBuffer): Promise<ComputeIdsResult> => {
    this.checkDisposed()
    const eventId = getUuid(true)
    const { data: payload, transfer } = toHashMessage(data)
    return this.request(
      eventId,
      { eventId, action: 'computeIds', data: payload },
      transfer,
      (response) => ({
        simpleId: readString(response.simpleId, 'simpleId'),
        resourceId: readString(response.resourceId, 'resourceId'),
      }),
    )
  }

  computeHashes = async (file: Blob | Uint8Array | ArrayBuffer, specs: readonly HashJob[]) => {
    this.checkDisposed()
    const eventId = getUuid(true)
    const { data, transfer } = toHashMessage(file)
    return this.request(
      eventId,
      { eventId, action: 'computeHashes', data, specs },
      transfer,
      (response) =>
        Array.isArray(response.hashes)
          ? response.hashes.map((hash) => readString(hash, 'hashes'))
          : [],
    )
  }

  canvasToBlob = async (
    source: OffscreenCanvas | ImageBitmap,
    options?: { type?: string; quality?: number },
  ) => {
    this.checkDisposed()
    const eventId = getUuid(true)
    return this.requestBlob(
      eventId,
      { eventId, action: 'canvasToBlob', canvas: source, options },
      [source],
    )
  }

  beginSha1 = async (): Promise<void> => {
    this.checkDisposed()
    const eventId = getUuid(true)
    await this.request(eventId, { eventId, action: 'beginSha1' }, undefined, () => undefined)
  }

  updateSha1 = async (chunk: Uint8Array): Promise<void> => {
    this.checkDisposed()
    const eventId = getUuid(true)
    const { data, transfer } = toHashMessage(chunk)
    await this.request(eventId, { eventId, action: 'updateSha1', data }, transfer, () => undefined)
  }

  digestSha1 = async (): Promise<string> => {
    this.checkDisposed()
    const eventId = getUuid(true)
    return this.request(eventId, { eventId, action: 'digestSha1' }, undefined, (response) =>
      readString(response.hash, 'hash'),
    )
  }

  private requestBlob = (
    eventId: string,
    payload: Record<string, unknown>,
    transfer?: Transferable[],
  ): Promise<Blob> =>
    this.request(eventId, payload, transfer, (data) =>
      blobFromTransfer(data as unknown as BlobTransferResponse),
    )

  private request = <T>(
    eventId: string,
    payload: Record<string, unknown>,
    transfer: Transferable[] | undefined,
    map: (data: Record<string, unknown>) => T,
  ): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      this.callbacks.set(eventId, {
        resolve: (data) => resolve(map(data)),
        reject,
      })
      this.worker.postMessage(payload, transfer?.length ? transfer : undefined)
    })

  private assignImageSource = async (
    payload: Record<string, unknown>,
    transfer: Transferable[],
    image: ImageSource,
    fallbackMimetype?: string,
  ) => {
    if (typeof image === 'string') {
      payload.imageSource = image
      payload.sourceType = 'url'
      return
    }
    const { buffer, mime } = await this.toTransferableBinary(image, fallbackMimetype)
    payload.buffer = buffer
    payload.imageMimetype = mime
    payload.sourceType = 'buffer'
    transfer.push(buffer)
  }

  private toTransferableBinary = async (
    data: ImageBinary,
    fallbackMimetype?: string,
  ): Promise<{ buffer: ArrayBuffer; mime: string }> => {
    if (data instanceof Blob) {
      return {
        buffer: await data.arrayBuffer(),
        mime: data.type || fallbackMimetype || 'application/octet-stream',
      }
    }
    if (data instanceof Uint8Array) {
      const buffer =
        data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
          ? data.buffer.slice(0)
          : data.slice().buffer
      return {
        buffer,
        mime: fallbackMimetype || 'application/octet-stream',
      }
    }
    return {
      buffer: data.slice(0),
      mime: fallbackMimetype || 'application/octet-stream',
    }
  }

  private onMessage = (event: MessageEvent<Record<string, unknown>>) => {
    const data = event.data
    const eventId = data?.eventId
    if (typeof eventId !== 'string' || !this.callbacks.has(eventId)) {
      return
    }
    const callback = this.callbacks.get(eventId)
    this.callbacks.delete(eventId)
    if (!callback) {
      return
    }
    if (data.state === 'SUCCESS') {
      callback.resolve(data)
    } else {
      callback.reject(new Error(workerError(data)))
    }
  }

  private checkDisposed = () => {
    if (this.isDisposed) {
      throw new Error('GlobalWorker has been disposed')
    }
  }
}
