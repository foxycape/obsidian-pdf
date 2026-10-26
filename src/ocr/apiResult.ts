import { ResponseCode } from '@/network/ApiConstants'
import { AiAccessError } from '@/ai/errors'

export class OcrRequestError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message)
    this.name = 'OcrRequestError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export const readStringField = (data: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return ''
}

/** Read a successful API envelope, mapping quota and login failures. */
export const requireApiData = (raw: unknown): Record<string, unknown> => {
  if (!isRecord(raw)) {
    throw new OcrRequestError('OCR request failed')
  }
  const code = typeof raw.code === 'number' ? raw.code : undefined
  if (code === ResponseCode.OutofAvailableAITokenCount) {
    throw new AiAccessError('no-ai-token', 'Official AI quota used up')
  }
  if (
    code === ResponseCode.NotLogin ||
    code === ResponseCode.InvalidAccessToken ||
    code === ResponseCode.AccessTokenExpired
  ) {
    throw new AiAccessError('license-required', 'A license is required for OCR')
  }
  const description = typeof raw.description === 'string' ? raw.description.trim() : ''
  if (raw.success !== true || !isRecord(raw.data)) {
    throw new OcrRequestError(description || 'OCR request failed', code)
  }
  return raw.data
}
