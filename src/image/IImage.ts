/** Cross-platform image binary input (no Web-only canvas / bitmap types). */
export type ImageBinary = Blob | ArrayBuffer | Uint8Array

/**
 * Image binary, or a URL string.
 * The worker accepts bytes only. Load a URL on the caller side before posting it.
 */
export type ImageSource = ImageBinary | string

export type ImageSize = {
  width: number
  height: number
}

export type ResizeImageOptions = {
  /** Output quality in the range 0.1–1. */
  quality?: number
  /** Output MIME type, e.g. image/jpeg or image/png. */
  mimetype?: string
  /**
   * When true, after fitting into the target box, if one side is shorter than
   * its target and the source is large enough on that side, rescale so that
   * side meets the target. The other side may exceed the target.
   */
  meetMinSide?: boolean
}

/**
 * Thumbnail image surface used by the global worker.
 * Compression, ZIP packing, and BGRA encoding stay out until a caller needs them.
 */
export type IImage = {
  /**
   * Resize an image to fit within the given dimensions (keeps aspect ratio).
   * @param image Image binary or URL string.
   * @param targetWidth Target max width in pixels.
   * @param targetHeight Target max height in pixels.
   * @param options Output quality, MIME type, and optional min-side fitting.
   */
  resizeImage: (
    image: ImageSource,
    targetWidth: number,
    targetHeight: number,
    options?: ResizeImageOptions,
  ) => Promise<Blob>

  /**
   * Get the pixel size of an image.
   * @param image Image binary or URL string.
   */
  getImageSize: (image: ImageSource) => Promise<ImageSize>
}
