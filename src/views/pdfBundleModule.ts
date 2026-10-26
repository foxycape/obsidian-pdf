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
  onNeedLicense: (prompt?: { officialOnly?: boolean }) => void
  onQuotaExhausted: (prompt?: { officialOnly?: boolean }) => void
  chrome?: {
    openAccess: (mode: 'need-license' | 'quota', prompt?: { officialOnly?: boolean }) => void
  } | null
}
