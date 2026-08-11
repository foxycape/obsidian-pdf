import type { ImageDescriptor } from '@core/kernal'

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
