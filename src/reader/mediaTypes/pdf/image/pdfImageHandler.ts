import { ImageDescriptor, SimpleMatrix } from '@foxycape/core/kernal'
import * as pdfjsLib from '@foxycape/core/pdfjs/legacy/build/pdf.mjs'
import { PdfRenderHandleOptions } from './PdfRenderHandleOptions'

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
  const x = imageDescriptor.x! * widthScale
  const y = pageOriginHeight - imageDescriptor.y! * heightScale
  imageDescriptor.pdfDest =
    '[{"num":' + ref + ',"gen":' + gen + '},{"name":"XYZ"},' + x + ',' + y + ',0]'
}

export const buildImageDescriptors = (
  canvasContext: CanvasRenderingContext2D,
  pageOriginWidth: number,
  pageOriginHeight: number,
  handleOptions: PdfRenderHandleOptions,
  ...args: any[]
) => {
  const objId = (canvasContext as any)['objId'] as string | undefined
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
  const originalWidth = (canvasContext as any)['originalWidth'] ?? width
  const originalHeight = (canvasContext as any)['originalHeight'] ?? height
  if (!(originalWidth >= imageMinWidth && originalHeight >= imageMinHeight)) {
    return
  }

  let x = 0
  let y = 0
  let destWidth: number = width!
  let destHeight: number = height!
  if (args.length == 5) {
    x = parseFloat(args[1])
    y = parseFloat(args[2])
    destWidth = parseFloat(args[3])
    destHeight = parseFloat(args[4])
  } else if (args.length == 9) {
    x = parseFloat(args[5])
    y = parseFloat(args[6])
    destWidth = parseFloat(args[7])
    destHeight = parseFloat(args[8])
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
  let imageDescriptors = (canvasContext as any)['imageDescriptors'] as ImageDescriptor[]
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

  const page = (canvasContext as any)['page']
  const imageDescriptor = new ImageDescriptor(objId, page?.toString() + '.pdf')
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
  ;(canvasContext as any)['imageDescriptors'] = imageDescriptors
  handleOptions?.imageCallback?.(imageDescriptor)
}

const CANVAS_CONTEXT_HANDLED_KEY = 'handled'

export const markCanvasContextHandled = (canvasContext: CanvasRenderingContext2D): boolean => {
  if ((canvasContext as any)[CANVAS_CONTEXT_HANDLED_KEY]) {
    return true
  }
  ;(canvasContext as any)[CANVAS_CONTEXT_HANDLED_KEY] = 1
  return false
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
  handleOptions = Object.assign(new PdfRenderHandleOptions(), handleOptions)
  if (disableOtherInstructions) {
    ;(canvasContext as any)['originalFillText'] = canvasContext.fillText
    canvasContext.fillText = () => {}
    ;(canvasContext as any)['originalStrokeText'] = canvasContext.strokeText
    canvasContext.strokeText = () => {}
    ;(canvasContext as any)['originalFill'] = canvasContext.fill
    canvasContext.fill = (() => {}) as typeof canvasContext.fill
    ;(canvasContext as any)['originalFillRect'] = canvasContext.fillRect
    canvasContext.fillRect = () => {}
    ;(canvasContext as any)['originalStroke'] = canvasContext.stroke
    canvasContext.stroke = (() => {}) as typeof canvasContext.stroke
    ;(canvasContext as any)['originalStrokeRect'] = canvasContext.strokeRect
    canvasContext.strokeRect = () => {}
  }
  ;(canvasContext as any)['originalDrawImage'] = canvasContext.drawImage
  canvasContext.drawImage = (...args: any[]) => {
    buildImageDescriptors(canvasContext, pageOriginWidth, pageOriginHeight, handleOptions!, ...args)
    ;(canvasContext as any)['originalDrawImage'](...args)
  }
}
