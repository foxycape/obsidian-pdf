import type { ExtractImageOptions, IDisposable, ILogger, ImageDescriptor } from '@foxycape/core/kernal'
import { BrowserCapabilities } from '@foxycape/core/kernal'
import * as pdfjsLib from '@foxycape/core/pdfjs/legacy/build/pdf.mjs'
import { asAugmentedCanvasContext } from '../canvasContextHooks'
import { handleOnlyImages } from './pdfImageHandler'

export type PdfImagePageResolver = {
  get numberOfPages(): number
  getPage: (pageNumber: number) => Promise<pdfjsLib.PDFPageProxy | null>
  logger?: ILogger
}

/** Raw pixel buffer from pdf.js when OffscreenCanvas is unavailable. */
type PdfJsRawImageData = {
  width: number
  height: number
  kind: 1 | 2 | 3
  data: Uint8Array | Uint8ClampedArray
  bitmap?: ImageBitmap
}

/**
 * Modern pdf.js (OffscreenCanvas path) resolves images as bitmap wrappers:
 * `{ width, height, bitmap, data: null }` — often without `kind`.
 */
type PdfJsBitmapImageData = {
  width: number
  height: number
  bitmap: ImageBitmap
  data?: Uint8Array | Uint8ClampedArray | null
  kind?: number
}

type PdfJsImageObject = PdfJsRawImageData | PdfJsBitmapImageData | ImageBitmap

const isImageBitmap = (value: unknown): value is ImageBitmap =>
  typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap

const isPdfJsBitmapImageData = (value: unknown): value is PdfJsBitmapImageData => {
  if (typeof value !== 'object' || value == null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.width === 'number' &&
    typeof record.height === 'number' &&
    isImageBitmap(record.bitmap)
  )
}

const isPdfJsRawImageData = (value: unknown): value is PdfJsRawImageData => {
  if (typeof value !== 'object' || value == null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.width === 'number' &&
    typeof record.height === 'number' &&
    typeof record.kind === 'number' &&
    (record.data instanceof Uint8Array || record.data instanceof Uint8ClampedArray)
  )
}

const isPdfJsImageObject = (value: unknown): value is PdfJsImageObject => {
  return (
    isImageBitmap(value) || isPdfJsBitmapImageData(value) || isPdfJsRawImageData(value)
  )
}

const cloneDescriptors = (items: ImageDescriptor[]): ImageDescriptor[] =>
  items.map((item) => structuredClone(item))

export class PdfImageExtractor implements IDisposable {
  private images: ImageDescriptor[] | undefined
  private pageImageMap = new Map<number, ImageDescriptor[]>()

  constructor(private readonly resolver: PdfImagePageResolver) {}

  async getImages(
    options?: ExtractImageOptions,
    callback?: (url: string, images: ImageDescriptor[]) => void,
  ) {
    if (this.images) {
      return this.images
    }

    const currentImages: ImageDescriptor[] = []
    const minWidth = options?.minWidth ?? 0
    const minHeight = options?.minHeight ?? 0

    for (let pageNumber = 1; pageNumber <= this.resolver.numberOfPages; pageNumber++) {
      if (options?.aborted?.()) {
        break
      }

      let page: pdfjsLib.PDFPageProxy | null = null
      try {
        page = await this.resolver.getPage(pageNumber)
        if (!page) {
          continue
        }

        const currentPageImages = await this.getPageImages(page)
        if (currentPageImages.length > 0) {
          let filteredImages = cloneDescriptors(currentPageImages)
          if (minWidth > 0 || minHeight > 0) {
            filteredImages = filteredImages.filter(
              (x) => (x.width ?? 0) >= minWidth && (x.height ?? 0) >= minHeight,
            )
          }
          if (filteredImages.length > 0) {
            currentImages.push(...filteredImages)
            callback?.(pageNumber.toString(), filteredImages)
          }
        }
        await BrowserCapabilities.yieldToMain()
      } catch {
        // ignore per-page failures
      }
    }

    if (!options?.aborted?.()) {
      this.images = currentImages
    }
    return this.images ?? currentImages
  }

  async getPageImages(
    page: pdfjsLib.PDFPageProxy,
    imageMinWidth?: number,
    imageMinHeight?: number,
  ) {
    if (!page) {
      return []
    }

    const pageNumber = page.pageNumber
    const cached = this.pageImageMap.get(pageNumber)
    if (cached) {
      return cached
    }

    try {
      const pageWidth = page.view[2] ?? 0
      const pageHeight = page.view[3] ?? 0
      if (!pageWidth || !pageHeight) {
        return []
      }

      const widthHeightScale = pageWidth / pageHeight
      const renderSize = 1000
      const scale =
        widthHeightScale >= 1 ? renderSize / pageHeight : renderSize / pageWidth

      await this.renderPage(page, scale, imageMinWidth, imageMinHeight, (imageDescriptor) => {
        this.setPageImageDescriptor(pageNumber, imageDescriptor)
      })
      return this.pageImageMap.get(pageNumber) ?? []
    } catch {
      return []
    }
  }

  setPageImageDescriptor(pageNumber: number, imageDescriptor: ImageDescriptor) {
    const imageDescriptors = this.pageImageMap.get(pageNumber) ?? []
    if (imageDescriptors.findIndex((x) => x.imageUrl === imageDescriptor.imageUrl) < 0) {
      imageDescriptors.push(imageDescriptor)
    }
    this.pageImageMap.set(pageNumber, imageDescriptors)
  }

  private renderPage = async (
    page: pdfjsLib.PDFPageProxy,
    scale: number,
    imageMinWidth?: number,
    imageMinHeight?: number,
    imageCallback?: (imageDescriptor: ImageDescriptor) => void,
  ) => {
    const viewport = page.getViewport({ scale })
    const canvas = createEl('canvas')
    const context = canvas.getContext('2d')
    if (!context) {
      return context
    }

    const pageWidth = page.view[2] ?? 0
    const pageHeight = page.view[3] ?? 0
    if (!pageWidth || !pageHeight) {
      return context
    }

    const canvasContext = asAugmentedCanvasContext(context)
    canvasContext.page = page.pageNumber
    handleOnlyImages(
      canvasContext,
      pageWidth,
      pageHeight,
      {
        handleDrawImage: true,
        imageCallback,
        imageMinWidth,
        imageMinHeight,
      },
      true,
    )
    canvas.height = viewport.height
    canvas.width = viewport.width

    await page.render({
      canvasContext: context,
      viewport,
      annotationMode: 0,
    }).promise

    return context
  }

  async getImage(
    pageNumber: number,
    objId: string,
  ): Promise<ImageBitmap | HTMLCanvasElement | null> {
    const page = await this.resolver.getPage(pageNumber)
    if (!page) {
      return null
    }

    const imageData = await this.getObject(page, objId)
    if (!imageData) {
      return null
    }
    // Prefer bitmap (OffscreenCanvas path); copy to canvas so page objs cleanup
    // cannot close the ImageBitmap while the viewer is still encoding a blob.
    if (isImageBitmap(imageData)) {
      return this.createCanvasFromBitmap(imageData)
    }
    if (isPdfJsBitmapImageData(imageData)) {
      return this.createCanvasFromBitmap(imageData.bitmap)
    }
    if (isPdfJsRawImageData(imageData)) {
      if (imageData.bitmap) {
        return this.createCanvasFromBitmap(imageData.bitmap)
      }
      return this.createCanvasFromImageData(imageData)
    }
    return null
  }

  private async getObject(
    page: pdfjsLib.PDFPageProxy,
    objId: string,
  ): Promise<PdfJsImageObject | null> {
    if (typeof objId !== 'string') {
      return null
    }

    const objeIdArray = objId.split('_')
    const imageId = objeIdArray[objeIdArray.length - 1]
    if (!imageId) {
      return null
    }

    const operators = await page.getOperatorList()
    let fixedObjId: string | undefined
    for (let i = 0; i < operators.fnArray.length; i++) {
      if (operators.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
        const currentImageArray: unknown = operators.argsArray[i]
        const objName =
          Array.isArray(currentImageArray) && typeof currentImageArray[0] === 'string'
            ? currentImageArray[0]
            : undefined
        if (objName !== undefined && objName.endsWith(imageId)) {
          fixedObjId = objName
          break
        }
      }
    }
    if (!fixedObjId) {
      return null
    }

    try {
      const objPool = fixedObjId.startsWith('g_') ? page.commonObjs : page.objs
      if (objPool.has(fixedObjId)) {
        const data: unknown = objPool.get(fixedObjId)
        return isPdfJsImageObject(data) ? data : null
      }
    } catch (error) {
      this.resolver.logger?.warn?.('get object error', error)
    }

    return new Promise<PdfJsImageObject | null>((resolve, reject) => {
      try {
        const objPool = fixedObjId.startsWith('g_') ? page.commonObjs : page.objs
        objPool.get(fixedObjId, (data: unknown) => {
          resolve(isPdfJsImageObject(data) ? data : null)
        })
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  async dispose(): Promise<void> {
    this.images?.splice(0)
    this.images = undefined
    this.pageImageMap.clear()
  }

  private readonly FULL_CHUNK_HEIGHT = 16

  private createCanvasFromBitmap(bitmap: ImageBitmap) {
    const canvas = createEl('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(bitmap, 0, 0)
    return canvas
  }

  createCanvasFromImageData(imgData: PdfJsRawImageData) {
    const canvas = createEl('canvas')
    canvas.width = imgData.width
    canvas.height = imgData.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return canvas
    }

    if (typeof ImageData !== 'undefined' && imgData instanceof ImageData) {
      ctx.putImageData(imgData, 0, 0)
      return canvas
    }

    const height = imgData.height
    const width = imgData.width
    const partialChunkHeight = height % this.FULL_CHUNK_HEIGHT
    const fullChunks = (height - partialChunkHeight) / this.FULL_CHUNK_HEIGHT
    const totalChunks = partialChunkHeight === 0 ? fullChunks : fullChunks + 1

    const chunkImgData = ctx.createImageData(width, this.FULL_CHUNK_HEIGHT)
    let srcPos = 0
    let destPos = 0
    const src = imgData.data
    const dest = chunkImgData.data
    let i: number
    let j: number
    let thisChunkHeight: number
    let elemsInThisChunk: number

    if (imgData.kind === 1) {
      const srcLength = src.byteLength
      const dest32 = new Uint32Array(dest.buffer, 0, dest.byteLength >> 2)
      const dest32DataLength = dest32.length
      const fullSrcDiff = (width + 7) >> 3
      const white = 0xffffffff
      const black = pdfjsLib.FeatureTest?.isLittleEndian ? 0xff000000 : 0x000000ff

      for (i = 0; i < totalChunks; i++) {
        thisChunkHeight = i < fullChunks ? this.FULL_CHUNK_HEIGHT : partialChunkHeight
        destPos = 0
        for (j = 0; j < thisChunkHeight; j++) {
          const srcDiff = srcLength - srcPos
          let k = 0
          const kEnd = srcDiff > fullSrcDiff ? width : srcDiff * 8 - 7
          const kEndUnrolled = kEnd & ~7
          let mask = 0
          let srcByte = 0
          for (; k < kEndUnrolled; k += 8) {
            srcByte = src[srcPos++]
            dest32[destPos++] = srcByte & 128 ? white : black
            dest32[destPos++] = srcByte & 64 ? white : black
            dest32[destPos++] = srcByte & 32 ? white : black
            dest32[destPos++] = srcByte & 16 ? white : black
            dest32[destPos++] = srcByte & 8 ? white : black
            dest32[destPos++] = srcByte & 4 ? white : black
            dest32[destPos++] = srcByte & 2 ? white : black
            dest32[destPos++] = srcByte & 1 ? white : black
          }
          for (; k < kEnd; k++) {
            if (mask === 0) {
              srcByte = src[srcPos++]
              mask = 128
            }
            dest32[destPos++] = srcByte & mask ? white : black
            mask >>= 1
          }
        }
        while (destPos < dest32DataLength) {
          dest32[destPos++] = 0
        }
        ctx.putImageData(chunkImgData, 0, i * this.FULL_CHUNK_HEIGHT)
      }
      return canvas
    }

    if (imgData.kind === 3) {
      j = 0
      elemsInThisChunk = width * this.FULL_CHUNK_HEIGHT * 4
      for (i = 0; i < fullChunks; i++) {
        dest.set(src.subarray(srcPos, srcPos + elemsInThisChunk))
        srcPos += elemsInThisChunk
        ctx.putImageData(chunkImgData, 0, j)
        j += this.FULL_CHUNK_HEIGHT
      }
      if (i < totalChunks) {
        elemsInThisChunk = width * partialChunkHeight * 4
        dest.set(src.subarray(srcPos, srcPos + elemsInThisChunk))
        ctx.putImageData(chunkImgData, 0, j)
      }
      return canvas
    }

    if (imgData.kind === 2) {
      thisChunkHeight = this.FULL_CHUNK_HEIGHT
      elemsInThisChunk = width * thisChunkHeight
      for (i = 0; i < totalChunks; i++) {
        if (i >= fullChunks) {
          thisChunkHeight = partialChunkHeight
          elemsInThisChunk = width * thisChunkHeight
        }
        destPos = 0
        for (j = elemsInThisChunk; j--; ) {
          dest[destPos++] = src[srcPos++]
          dest[destPos++] = src[srcPos++]
          dest[destPos++] = src[srcPos++]
          dest[destPos++] = 255
        }
        ctx.putImageData(chunkImgData, 0, i * this.FULL_CHUNK_HEIGHT)
      }
      return canvas
    }

    throw new Error(`bad image kind: ${imgData.kind}`)
  }
}
