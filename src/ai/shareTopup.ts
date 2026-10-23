import { SHARE_TOPUP_PATH } from '@/license/constants'
import type { HttpClientOptions, IApiClient } from '@/network'
import { getLicenseAiUser } from './licenseSession'

type ShareTopupResult = {
  success?: boolean
  description?: string
  message?: string
}

const isRecord = (value: unknown): value is ShareTopupResult =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const resultText = (result: ShareTopupResult) => result.description || result.message || ''

/** True when the server still allows a share reward for this user. */
export const isShareTopupEligible = (raw: unknown): boolean => {
  if (!isRecord(raw) || raw.success !== true) {
    return false
  }
  return !resultText(raw).toLowerCase().includes('already shared')
}

const bearerOptions = (accessToken: string): HttpClientOptions => ({
  headers: { Authorization: `Bearer ${accessToken}` },
})

/**
 * Exchange the stored license for a user token, then ask whether a share
 * reward is still available. Network and auth failures hide the button.
 */
export const loadShareTopupEligible = async (
  apiClient: IApiClient,
  license: string,
): Promise<boolean> => {
  const trimmed = license.trim()
  if (!trimmed) {
    return false
  }
  try {
    const user = await getLicenseAiUser(apiClient, trimmed)
    if (!user?.accessToken) {
      return false
    }
    const raw = await apiClient.post(
      SHARE_TOPUP_PATH,
      { check: true },
      true,
      undefined,
      bearerOptions(user.accessToken),
    )
    return isShareTopupEligible(raw)
  } catch {
    return false
  }
}
