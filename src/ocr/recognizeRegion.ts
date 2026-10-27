import type { HttpClientOptions, IApiClient } from '@/network'
import { refreshLicenseAiQuota } from '@/ai/licenseSession'
import { readStringField, requireApiData, OcrRequestError } from './apiResult'
import type { OcrRegionKind, OcrReviewResult, OcrTableMode } from './types'

const ocrOptions = (accessToken: string): HttpClientOptions => ({
  requestBodyType: 'raw',
  headers: {
    X_Public_AccessToken: accessToken,
    Authorization: `Bearer ${accessToken}`,
  },
})

const postOcr = async (
  apiClient: IApiClient,
  path: string,
  body: Record<string, unknown>,
  accessToken: string,
): Promise<Record<string, unknown>> => {
  const raw = await apiClient.post(path, body, true, undefined, ocrOptions(accessToken))
  const data = requireApiData(raw)
  void refreshLicenseAiQuota(apiClient).catch(() => undefined)
  return data
}

const contentField = (kind: OcrRegionKind): string[] => {
  if (kind === 'equation') {
    return ['latex', 'Latex']
  }
  if (kind === 'table') {
    return ['html', 'Html']
  }
  return ['text', 'Text']
}

export const recognizeOcrRegion = async (input: {
  apiClient: IApiClient
  accessToken: string
  kind: OcrRegionKind
  fileId: string
  pageNumber: number
  pageUrl: string
  pageWidth: number
  pageHeight: number
  tableMode?: OcrTableMode
}): Promise<string> => {
  const body: Record<string, unknown> = {
    type: input.kind,
    fileId: input.fileId,
    pageNumber: input.pageNumber,
    pageUrl: input.pageUrl,
    pageWidth: input.pageWidth,
    pageHeight: input.pageHeight,
  }
  if (input.tableMode) {
    body.tableMode = input.tableMode
  }
  const data = await postOcr(
    input.apiClient,
    '/reader/pdf/ocr',
    body,
    input.accessToken,
  )
  return readStringField(data, ...contentField(input.kind))
}

const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value)

const readBoolField = (data: Record<string, unknown>, ...keys: string[]): boolean => {
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'boolean') {
      return value
    }
  }
  return false
}

export const reviewOcrRegion = async (input: {
  apiClient: IApiClient
  accessToken: string
  kind: OcrRegionKind
  fileId: string
  pageNumber: number
  content: string
  referenceText?: string
}): Promise<OcrReviewResult> => {
  const itemId = crypto.randomUUID()
  const referenceText = input.referenceText?.trim() ?? ''
  const item: Record<string, unknown> = {
    itemId,
    pageNumber: input.pageNumber,
    contentType: input.kind,
    ocrText: input.kind === 'table' ? '' : input.content,
    tableHtml: input.kind === 'table' ? input.content : '',
  }
  if (referenceText) {
    item.referenceText = referenceText
  }
  const data = await postOcr(
    input.apiClient,
    '/reader/pdf/review',
    {
      fileId: input.fileId,
      reviewType: input.kind,
      scope: 'item',
      mode: referenceText ? 'with_pdf_text' : 'ocr_only',
      items: [item],
    },
    input.accessToken,
  )
  const results = data.results ?? data.Results
  const first = isUnknownArray(results) ? results[0] : null
  if (!first || typeof first !== 'object') {
    throw new OcrRequestError('Proofreading did not return a result')
  }
  const resultItem = first as Record<string, unknown>
  return {
    suggestedText: readStringField(resultItem, 'suggestedText', 'SuggestedText'),
    verdict: readStringField(resultItem, 'verdict', 'Verdict'),
    reason: readStringField(resultItem, 'reason', 'Reason'),
    requiresUserConfirm: readBoolField(resultItem, 'requiresUserConfirm', 'RequiresUserConfirm'),
  }
}
