import type { ImageDescriptor } from '@foxycape/core/kernal'

export class PdfRenderHandleOptions {
  pageView?: unknown
  handleDrawImage?: boolean
  imageMinWidth?: number
  imageMinHeight?: number
  imageCallback?: (imageDescriptor: ImageDescriptor) => void
  handleFillText?: boolean
  handleStrokeText?: boolean
  handleFill?: boolean
  handleFillRect?: boolean
  handleStroke?: boolean
  handleStrokeRect?: boolean
}
