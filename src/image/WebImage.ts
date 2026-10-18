import { computeResizeSize } from './computeResizeSize'
import type { IImage, ImageBinary, ImageSize, ImageSource, ResizeImageOptions } from './IImage'

type WebImageBitmapSource = ImageBitmap | Blob | ImageData | OffscreenCanvas | string

/**
 * Web implementation of {@link IImage}.
 * Intended to run inside the global worker (OffscreenCanvas).
 */
export class WebImage implements IImage {
  resizeImage = async (
    image: ImageSource,
    targetWidth: number,
    targetHeight: number,
    options?: ResizeImageOptions,
  ): Promise<Blob> => {
    const source = await this.toBlobOrUrl(image)
    let bitmap: ImageBitmap | undefined
    try {
      bitmap = await this.getImageBitmap(source)
      const { width, height } = computeResizeSize(
        bitmap.width,
        bitmap.height,
        targetWidth,
        targetHeight,
        options?.meetMinSide,
      )
      const outputType = options?.mimetype ?? 'image/jpeg'
      const outputQuality = options?.quality ?? 0.9
      const offscreenCanvas = new OffscreenCanvas(width, height)
      const context = offscreenCanvas.getContext('2d')
      if (!context) {
        throw new Error('Failed to get canvas context')
      }
      context.drawImage(bitmap, 0, 0, width, height)
      return await this.canvasToBlob(offscreenCanvas, { type: outputType, quality: outputQuality })
    } finally {
      bitmap?.close()
    }
  }

  getImageSize = async (image: ImageSource): Promise<ImageSize> => {
    const source = await this.toBlobOrUrl(image)
    let bitmap: ImageBitmap | undefined
    try {
      bitmap = await this.getImageBitmap(source)
      return { width: bitmap.width, height: bitmap.height }
    } finally {
      bitmap?.close()
    }
  }

  private getImageBitmap = async (image: WebImageBitmapSource): Promise<ImageBitmap> => {
    if (typeof image === 'string') {
      throw new Error('Pass image bytes to the worker. URL loading is not available here.')
    }
    return createImageBitmap(image)
  }

  private canvasToBlob = async (
    canvas: OffscreenCanvas,
    options?: ImageEncodeOptions,
  ): Promise<Blob> => canvas.convertToBlob(options)

  private toBlobOrUrl = async (image: ImageSource): Promise<Blob | string> => {
    if (typeof image === 'string') {
      return image
    }
    return this.toBlob(image)
  }

  private toBlob = async (data: ImageBinary): Promise<Blob> => {
    if (data instanceof Blob) {
      return data
    }
    return new Blob([await this.toArrayBuffer(data)])
  }

  private toArrayBuffer = async (data: ImageBinary): Promise<ArrayBuffer> => {
    if (data instanceof ArrayBuffer) {
      return data
    }
    if (data instanceof Uint8Array) {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    }
    return data.arrayBuffer()
  }
}
