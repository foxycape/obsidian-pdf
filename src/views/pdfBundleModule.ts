import type { PdfReaderSession, PdfReaderSurface } from '@/views/PdfReaderSurface'

export type PdfUsagePoint = {
  duration: string
  inputTokenCount: number
  outputTokenCount: number
  cacheTokenCount: number
}

export type PdfLicenseUser = {
  accessToken?: string
  availableAITokenCount?: number
} | null

export type PdfBundleRuntime = {
  apiClient: unknown
  storage?: unknown
  getLicense: () => string
  onNeedLicense: () => void
  onQuotaExhausted: () => void
  chrome?: { openAccess: (mode: 'need-license' | 'quota') => void } | null
}

export type PdfBundleModule = {
  attachPdfReader: (surface: PdfReaderSurface) => PdfReaderSession
  formatTokenAmount: (count: number) => string
  getLicenseAiUser: (apiClient: unknown, license: string) => Promise<PdfLicenseUser>
  loadLicenseAiUsage: (
    apiClient: unknown,
    accessToken: string,
  ) => Promise<PdfUsagePoint[] | null | undefined>
  bindAiRuntime: (runtime: PdfBundleRuntime) => void
  disposePdfRuntime: () => Promise<void>
  tryGetAiRuntime: () => PdfBundleRuntime | null
}
