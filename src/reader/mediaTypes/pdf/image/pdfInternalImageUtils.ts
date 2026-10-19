import type { ImageDescriptor, SimpleMatrix } from '@foxycape/core/kernal'

export const FULL_PAGE_IMAGE_SIZE_TOLERANCE_PX = 5

/** Axis-aligned flip-only CTM (mirror), excluding 90° rotations. */
export const getFlipOnlyMatrix = (
  matrix?: SimpleMatrix,
): SimpleMatrix | undefined => {
  if (!matrix) return undefined
  if (
    Math.abs(matrix.b) !== 0 ||
    Math.abs(matrix.c) !== 0 ||
    Math.abs(Math.abs(matrix.a) - 1) > 1e-6 ||
    Math.abs(Math.abs(matrix.d) - 1) > 1e-6
  ) {
    return undefined
  }
  if (matrix.a === 1 && matrix.d === 1) {
    return undefined
  }
  return matrix
}

const withinTolerance = (a: number, b: number, tolerance: number) =>
  Math.abs(a - b) <= tolerance

/** pdf.js detail canvas (`PDFPageDetailView`) uses a local viewport, not page coordinates. */
export const isPdfDetailPageView = (pageView: { renderingId?: string }) =>
  pageView.renderingId?.startsWith('detail') === true

/** Canvas backing-store pixels per CSS pixel. Capped canvases are not `devicePixelRatio`. */
export const canvasCssScale = (canvas: {
  width: number
  height: number
  getBoundingClientRect: () => { width: number; height: number }
}) => {
  const bounds = canvas.getBoundingClientRect()
  const scaleX = bounds.width > 0 ? canvas.width / bounds.width : 1
  const scaleY = bounds.height > 0 ? canvas.height / bounds.height : 1
  return {
    scaleX: scaleX > 0 ? scaleX : 1,
    scaleY: scaleY > 0 ? scaleY : 1,
  }
}

export const toCssImageBox = (
  rawX: number,
  rawY: number,
  rawWidth: number,
  rawHeight: number,
  scaleX: number,
  scaleY: number,
) => ({
  x: rawX / scaleX,
  y: rawY / scaleY,
  width: rawWidth / scaleX,
  height: rawHeight / scaleY,
})

/** Whether an embedded image spans the full page viewport (within tolerance). */
export const isFullPageInternalImage = (
  imageDescriptor: ImageDescriptor,
  pageWidth: number,
  pageHeight: number,
  scale: { scaleX: number; scaleY: number },
  tolerance = FULL_PAGE_IMAGE_SIZE_TOLERANCE_PX,
): boolean => {
  if (
    !imageDescriptor.scaledWidth ||
    !imageDescriptor.scaledHeight ||
    pageWidth <= 0 ||
    pageHeight <= 0
  ) {
    return false
  }

  const imageWidth = imageDescriptor.scaledWidth / scale.scaleX
  const imageHeight = imageDescriptor.scaledHeight / scale.scaleY

  return (
    (withinTolerance(imageWidth, pageWidth, tolerance) &&
      withinTolerance(imageHeight, pageHeight, tolerance)) ||
    (withinTolerance(imageHeight, pageWidth, tolerance) &&
      withinTolerance(imageWidth, pageHeight, tolerance))
  )
}
