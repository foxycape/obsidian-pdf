export type OcrRegionKind = 'text' | 'equation' | 'table'

export type OcrTableMode = 'ocr-complex-table' | 'ocr-simple-table'

export type OcrReviewNote = {
  ok: boolean
  explanation: string
}

export type OcrSheetState = {
  kind: OcrRegionKind
  fileId: string
  pageNumber: number
  content: string
  reviewNote: OcrReviewNote | null
}

export type OcrReviewResult = {
  suggestedText: string
  verdict: string
  reason: string
  requiresUserConfirm: boolean
}
