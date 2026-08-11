import type { ExtractImageOptions, ImageDescriptor } from '@foxycape/core/kernal'

/**
 * Narrow image extraction API implemented by CustomPdfRenderer (not on IPdfRenderer).
 */
export type IPdfImageSource = {
  getImage(
    pageNumber: number,
    objId: string,
  ): Promise<ImageBitmap | HTMLCanvasElement | null>

  getImages?(
    options?: ExtractImageOptions,
    callback?: (url: string, images: ImageDescriptor[]) => void,
  ): Promise<ImageDescriptor[]>
}
