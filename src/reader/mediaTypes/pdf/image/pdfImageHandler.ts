import { ImageDescriptor, SimpleMatrix } from '@foxycape/core/kernal'
import * as pdfjsLib from '@foxycape/core/pdfjs/legacy/build/pdf.mjs'
import {
  asAugmentedCanvasContext,
  callOriginalDrawImage,
  markCanvasContextHandled,
  storeBoundOriginal,
  type DrawImageArgs,
  type PdfAugmentedCanvasContext,
} from '../canvasContextHooks'
import { PdfRenderHandleOptions } from './PdfRenderHandleOptions'

export { markCanvasContextHandled } from '../canvasContextHooks'

export const buildPdfImageDest = (
  imageDescriptor: ImageDescriptor,
  canvasWidth: number,
  canvasHeight: number,
  pageOriginWidth: number,
  pageOriginHeight: number,
) => {
  if (!imageDescriptor.imageRefId) {
    return
  }
  const imageIdArray = imageDescriptor.imageRefId.split('R')
  const ref = parseInt(imageIdArray[0], 10)
  if (isNaN(ref)) {
    return
  }
  let gen = 0
  if (imageIdArray.length >= 2 && imageIdArray[1] != '') {
    gen = parseInt(imageIdArray[1], 10)
  }
  if (isNaN(gen)) {
    gen = 0
  }
  const widthScale = pageOriginWidth / canvasWidth
  const heightScale = pageOriginHeight / canvasHeight
  const x = (imageDescriptor.x ?? 0) * widthScale
  const y = pageOriginHeight - (imageDescriptor.y ?? 0) * heightScale
  imageDescriptor.pdfDest =
    '[{"num":' + ref + ',"gen":' + gen + '},{"name":"XYZ"},' + x + ',' + y + ',0]'
}

export const buildImageDescriptors = (
  canvasContext: CanvasRenderingContext2D,
  pageOriginWidth: number,
  pageOriginHeight: number,
  handleOptions: PdfRenderHandleOptions,
  ...args: DrawImageArgs
) => {
  const ctx = asAugmentedCanvasContext(canvasContext)
  const objId = ctx.objId
  if (!objId) {
    return
  }
  const objeIdArray = objId.split('_')
  const imageId = objeIdArray?.[objeIdArray.length - 1]
  if (!imageId) {
    return
  }

  const transform = canvasContext.getTransform()
  const sourceImage = args[0]
  let width: number | undefined
  let height: number | undefined

  if (sourceImage instanceof HTMLCanvasElement) {
    width = sourceImage.width
    height = sourceImage.height
  } else if (typeof OffscreenCanvas !== 'undefined' && sourceImage instanceof OffscreenCanvas) {
    width = sourceImage.width
    height = sourceImage.height
  } else if (typeof ImageBitmap !== 'undefined' && sourceImage instanceof ImageBitmap) {
    width = sourceImage.width
    height = sourceImage.height
  }

  const imageMinWidth = handleOptions.imageMinWidth ?? 200
  const imageMinHeight = handleOptions.imageMinHeight ?? 200
  const originalWidth = ctx.originalWidth ?? width
  const originalHeight = ctx.originalHeight ?? height
  if (
    !(
      originalWidth != null &&
      originalHeight != null &&
      originalWidth >= imageMinWidth &&
      originalHeight >= imageMinHeight
    )
  ) {
    return
  }

  let x = 0
  let y = 0
  let destWidth: number = width ?? 0
  let destHeight: number = height ?? 0
  if (args.length == 5) {
    x = Number(args[1])
    y = Number(args[2])
    destWidth = Number(args[3])
    destHeight = Number(args[4])
  } else if (args.length == 9) {
    x = Number(args[5])
    y = Number(args[6])
    destWidth = Number(args[7])
    destHeight = Number(args[8])
  }

  let destX = x
  let destY = y
  let destW = destWidth
  let destH = destHeight
  if (destW < 0) {
    destX += destW
    destW = -destW
  }
  if (destH < 0) {
    destY += destH
    destH = -destH
  }

  const canvasWidth = canvasContext.canvas.width
  const canvasHeight = canvasContext.canvas.height
  let imageDescriptors = ctx.imageDescriptors
  if (!imageDescriptors) {
    imageDescriptors = []
  }

  const { a, b, c, d, e, f } = transform
  const rect = pdfjsLib.Util.getAxialAlignedBoundingBox(
    [destX, destY, destX + destW, destY + destH],
    [a, b, c, d, e, f],
  )
  const minX = rect[0] ?? 0
  const minY = rect[1] ?? 0
  const maxX = rect[2] ?? minX
  const maxY = rect[3] ?? minY
  const scaledWidth = maxX - minX
  const scaledHeight = maxY - minY

  const page = ctx.page
  const imageDescriptor = new ImageDescriptor(objId, String(page ?? '') + '.pdf')
  imageDescriptor.imageRefId = imageId
  imageDescriptor.x = minX
  imageDescriptor.y = minY
  imageDescriptor.width = originalWidth
  imageDescriptor.height = originalHeight
  imageDescriptor.scaledWidth = scaledWidth
  imageDescriptor.scaledHeight = scaledHeight
  buildPdfImageDest(imageDescriptor, canvasWidth, canvasHeight, pageOriginWidth, pageOriginHeight)
  imageDescriptor.matrix = new SimpleMatrix(a, b, c, d, 0, 0)
  imageDescriptors.push(imageDescriptor)
  ctx.imageDescriptors = imageDescriptors
  handleOptions?.imageCallback?.(imageDescriptor)
}

/** Hook drawImage only; optionally no-op other paint instructions. */
export const handleOnlyImages = (
  canvasContext: CanvasRenderingContext2D,
  pageOriginWidth: number,
  pageOriginHeight: number,
  handleOptions?: PdfRenderHandleOptions,
  disableOtherInstructions?: boolean,
) => {
  if (markCanvasContextHandled(canvasContext)) {
    return
  }
  const ctx = asAugmentedCanvasContext(canvasContext)
  const opts = Object.assign(new PdfRenderHandleOptions(), handleOptions)
  if (disableOtherInstructions) {
    storeBoundOriginal(ctx, 'originalFillText', canvasContext.fillText)
    canvasContext.fillText = () => {}
    storeBoundOriginal(ctx, 'originalStrokeText', canvasContext.strokeText)
    canvasContext.strokeText = () => {}
    storeBoundOriginal(ctx, 'originalFill', canvasContext.fill)
    canvasContext.fill = () => {}
    storeBoundOriginal(ctx, 'originalFillRect', canvasContext.fillRect)
    canvasContext.fillRect = () => {}
    storeBoundOriginal(ctx, 'originalStroke', canvasContext.stroke)
    canvasContext.stroke = () => {}
    storeBoundOriginal(ctx, 'originalStrokeRect', canvasContext.strokeRect)
    canvasContext.strokeRect = () => {}
  }
  storeBoundOriginal(ctx, 'originalDrawImage', canvasContext.drawImage)
  canvasContext.drawImage = (...args: DrawImageArgs) => {
    buildImageDescriptors(canvasContext, pageOriginWidth, pageOriginHeight, opts, ...args)
    callOriginalDrawImage(ctx, args)
  }
}

export type { PdfAugmentedCanvasContext }
