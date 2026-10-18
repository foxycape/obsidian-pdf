import type { IDisposable } from '@foxycape/core/kernal'
import type { HashAlgorithm } from '@foxycape/core/kernal/crypto/ICrypto'
import type { ImageSize, ImageSource, ResizeImageOptions } from '../image/IImage'
import type { DocumentHasher } from './DocumentHasher'

export type ComputeIdsResult = {
  simpleId: string
  resourceId: string
}

export type HashJob = {
  algorithm: HashAlgorithm
  /** When set, only the first N bytes are included in this digest. */
  maxBytes?: number
}

/**
 * Main-thread surface of the global worker.
 * HTML search, image compression, ZIP packing, and BGRA-to-PNG stay out until a caller needs them.
 * Chunked SHA-1 stays, because vault files are hashed one window at a time.
 * `computeMd5` accepts a Blob as well as bytes; {@link DocumentHasher} only needs `Uint8Array`.
 */
export type IGlobalWorker = IDisposable &
  Omit<DocumentHasher, 'computeMd5'> & {
    /**
     * Compute the MD5 hash of the given file content.
     * A Blob is posted by reference and hashed in chunks inside the worker.
     */
    computeMd5: (file: Blob | Uint8Array | ArrayBuffer) => Promise<string>

    /**
     * Compute a cryptographic hash of the given file content.
     * A Blob is posted by reference and hashed in chunks inside the worker.
     * @param file File content as Blob, Uint8Array, or ArrayBuffer.
     * @param algorithm Optional hash algorithm. Defaults to SHA-1.
     */
    computeFileHash: (
      file: Blob | Uint8Array | ArrayBuffer,
      algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-512',
    ) => Promise<string>

    /**
     * Compute simpleId (MD5 of the first 5MB) and resourceId (SHA-1 of the full content).
     * Blob inputs are streamed inside the worker.
     */
    computeIds: (data: Blob | Uint8Array | ArrayBuffer) => Promise<ComputeIdsResult>

    /**
     * Compute several digests of the same file in one worker pass.
     * @param specs Algorithms to compute, in result order.
     */
    computeHashes: (
      file: Blob | Uint8Array | ArrayBuffer,
      specs: readonly HashJob[],
    ) => Promise<string[]>

    /**
     * Convert an OffscreenCanvas or ImageBitmap to a Blob.
     * ImageBitmap is preferred after a 2D render: a used OffscreenCanvas
     * often cannot be transferred to a worker.
     */
    canvasToBlob: (
      source: OffscreenCanvas | ImageBitmap,
      options?: { type?: string; quality?: number },
    ) => Promise<Blob>

    resizeImage: (
      image: ImageSource,
      targetWidth: number,
      targetHeight: number,
      options?: ResizeImageOptions,
    ) => Promise<Blob>

    getImageSize: (image: ImageSource) => Promise<ImageSize>
  }
