export type PdfUsagePoint = {
  duration: string
  inputTokenCount: number
  outputTokenCount: number
  cacheTokenCount: number
}

export type PdfBundleRuntime = {
  apiClient: unknown
  storage?: unknown
  getLicense: () => string
  onNeedLicense: () => void
  onQuotaExhausted: () => void
  chrome?: { openAccess: (mode: 'need-license' | 'quota') => void } | null
}
