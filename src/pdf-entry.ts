import '@/reader/foxycapePdfViewer'
import '@/reader/pdfRuntimeHost'
import { formatTokenAmount } from '@/ai/formatTokenAmount'
import { getLicenseAiUser, loadLicenseAiUsage } from '@/ai/licenseSession'
import { bindAiRuntime as bindAiRuntimeWithStorage, tryGetAiRuntime, type AiRuntime } from '@/ai/runtime'
import { disposePdfRuntime, getPdfStorage } from '@/reader/pdfRuntime'
import { attachPdfReader } from '@/views/PdfReaderView'
import type { PdfBundleRuntime } from '@/views/pdfBundleModule'

const bindAiRuntime = (runtime: Omit<PdfBundleRuntime, 'storage'>) => {
  bindAiRuntimeWithStorage({
    ...(runtime as Omit<AiRuntime, 'storage'>),
    storage: getPdfStorage(),
  })
}

export default {
  attachPdfReader,
  formatTokenAmount,
  getLicenseAiUser,
  loadLicenseAiUsage,
  bindAiRuntime,
  disposePdfRuntime,
  tryGetAiRuntime,
}
