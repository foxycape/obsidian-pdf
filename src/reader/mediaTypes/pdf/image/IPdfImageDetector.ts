import type { IDisposable, ImageDescriptor } from '@core/kernal'
import type { IPdfDocument } from '@core/mediaTypes/pdf/renderer/IPdfDocument'

export type PdfImageDetectResult = {
  doc: IPdfDocument | null
  found: boolean
  offsetX?: number
  offsetY?: number
}

export type IPdfImageDetector = IDisposable & {
  detect: (e: MouseEvent | TouchEvent, doc?: IPdfDocument) => Promise<PdfImageDetectResult>
  findImageDescriptor: (
    offsetX: number,
    offsetY: number,
    doc: IPdfDocument,
  ) => Promise<ImageDescriptor | null>
}
