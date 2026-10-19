import type { IApiClient } from '@/network'
import type { IStorage } from '@/storage'
import { clearLicenseAiSession } from './licenseSession'

export type PassageNoteKind = 'explain' | 'lookup' | 'translate'

export type PassageNoteWrite = {
  kind: PassageNoteKind
  markId: string
  text: string
  body: string
  pageNumber?: number
  simpleId: string
}

export type AiAccessMode = 'need-license' | 'quota'

export type AiChromeHooks = {
  openAccess: (mode: AiAccessMode) => void
}

export type AiRuntime = {
  apiClient: IApiClient
  storage: IStorage
  getLicense: () => string
  onNeedLicense: () => void
  onQuotaExhausted: () => void
  writePassageNote?: (input: PassageNoteWrite) => Promise<void>
  fetchImpl?: typeof fetch
  chrome?: AiChromeHooks | null
}

let runtime: AiRuntime | null = null

export const bindAiRuntime = (next: AiRuntime) => {
  runtime = next
  clearLicenseAiSession()
}

export const getAiRuntime = (): AiRuntime => {
  if (!runtime) {
    throw new Error('AI runtime is not ready')
  }
  return runtime
}

export const tryGetAiRuntime = (): AiRuntime | null => runtime

export const setAiChromeHooks = (hooks: AiChromeHooks | null) => {
  if (runtime) {
    runtime.chrome = hooks
  }
}
