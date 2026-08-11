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

/** Whether an embedded image spans the full page viewport (within tolerance). */
export const isFullPageInternalImage = (
  imageDescriptor: ImageDescriptor,
  pageWidth: number,
  pageHeight: number,
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

  const dpr = window.devicePixelRatio ?? 1
  const imageWidth = imageDescriptor.scaledWidth / dpr
  const imageHeight = imageDescriptor.scaledHeight / dpr

  return (
    (withinTolerance(imageWidth, pageWidth, tolerance) &&
      withinTolerance(imageHeight, pageHeight, tolerance)) ||
    (withinTolerance(imageHeight, pageWidth, tolerance) &&
      withinTolerance(imageWidth, pageHeight, tolerance))
  )
}
