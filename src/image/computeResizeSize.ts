import type { ImageSize } from './IImage'

/**
 * Compute the output size for {@link IImage.resizeImage}.
 * Default is contain (fit inside the target box).
 * When `meetMinSide` is on, a short side is lifted to its target if the source
 * is large enough on that side; the other side may then exceed the target.
 */
export const computeResizeSize = (
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  meetMinSide?: boolean,
): ImageSize => {
  const destWidth = targetWidth || 250
  const destHeight = targetHeight || 250
  const widthScale = destWidth / sourceWidth
  const heightScale = destHeight / sourceHeight
  let scale = Math.min(widthScale, heightScale)

  if (meetMinSide) {
    const fittedWidth = sourceWidth * scale
    const fittedHeight = sourceHeight * scale
    if (fittedHeight < destHeight && sourceHeight >= destHeight) {
      scale = heightScale
    } else if (fittedWidth < destWidth && sourceWidth >= destWidth) {
      scale = widthScale
    }
  }

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}
