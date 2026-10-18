export const convertToBlob = (
  canvas: OffscreenCanvas,
  options?: ImageEncodeOptions,
): Promise<Blob> => canvas.convertToBlob(options)

export const bitmapToOffscreenCanvas = (bitmap: ImageBitmap) => {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Failed to get canvas context')
  }
  context.drawImage(bitmap, 0, 0)
  return canvas
}
