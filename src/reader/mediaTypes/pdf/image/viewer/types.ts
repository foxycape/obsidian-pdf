import type { ImageDescriptor } from '@foxycape/core/kernal'
import type { PdfImageLinkSource } from '@/obsidian/pdfImageRef'

export type PdfImageViewerTexts = {
  copy: string
  copyReference: string
  download: string
  rotate: string
  close: string
  loading: string
  copied: string
  referenceCopied: string
  downloaded: string
  /** Supports `{message}` placeholder for action name. */
  error: string
}

export type PdfImageViewerCallbacks = {
  texts: PdfImageViewerTexts
  downloadFile: (fileName: string, blob: Blob) => Promise<void>
  getLinkSource?: () => PdfImageLinkSource | null
  /** `foxycape-rect=` / `rect=` param for image deep-link highlight. */
  resolveImageRect?: (
    descriptor: ImageDescriptor,
    pageNumber: number,
  ) => string | undefined
  onCopySuccess?: () => void
  onCopyReferenceSuccess?: () => void
  onDownloadSuccess?: () => void
  onError?: (message: string) => void
}

export type PdfImageViewerHistoryTarget = {
  closed?: boolean
  layer?: string
}

export type PdfImageViewerHistoryBridge = {
  shouldTrack: () => boolean
  pushState: (target: PdfImageViewerHistoryTarget, close: () => void) => void
  back: (target: PdfImageViewerHistoryTarget) => void
}

export type PdfImageViewerOptions = {
  zIndex?: number
  closeOnBgClick?: boolean
  clickToCloseNonZoomable?: boolean
  closeOnVerticalDrag?: boolean
  fullscreen?: boolean
  historyBridge?: PdfImageViewerHistoryBridge
}
