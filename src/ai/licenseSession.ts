import {
  LICENSE_AI_SESSION_PATH,
  OFFICIAL_AI_TOKEN_INFO_PATH,
} from '@/license/constants'
import type { IApiClient } from '@/network'

export type LicenseAiUser = {
  accessToken: string
  accessTokenExpirationTime: number
  availableAITokenCount?: number
}

type CacheEntry = {
  license: string
  user: LicenseAiUser
}

let cache: CacheEntry | null = null

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const readExpiration = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return Date.now() + 30 * 60 * 1000
}

const readUser = (raw: unknown): LicenseAiUser | null => {
  const body = isRecord(raw) && isRecord(raw.data) ? raw.data : isRecord(raw) ? raw : null
  if (!body) {
    return null
  }
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : ''
  if (!accessToken) {
    return null
  }
  const count = body.availableAITokenCount
  return {
    accessToken,
    accessTokenExpirationTime: readExpiration(
      body.accessTokenExpirationTime ?? body.accessTokenExpiry,
    ),
    availableAITokenCount: typeof count === 'number' ? count : undefined,
  }
}

export const clearLicenseAiSession = () => {
  cache = null
}

export const getLicenseAiUser = async (
  apiClient: IApiClient,
  license: string,
): Promise<LicenseAiUser | null> => {
  const trimmed = license.trim()
  if (!trimmed) {
    return null
  }
  if (
    cache &&
    cache.license === trimmed &&
    cache.user.accessTokenExpirationTime > Date.now() + 30_000
  ) {
    return cache.user
  }
  const raw = await apiClient.post(LICENSE_AI_SESSION_PATH, { license: trimmed })
  const user = readUser(raw)
  if (!user) {
    cache = null
    return null
  }
  cache = { license: trimmed, user }
  return user
}

export const refreshLicenseAiQuota = async (apiClient: IApiClient): Promise<void> => {
  if (!cache) {
    return
  }
  try {
    const raw = await apiClient.get(OFFICIAL_AI_TOKEN_INFO_PATH, {}, true)
    const user = readUser(raw)
    if (user && cache) {
      cache = {
        license: cache.license,
        user: {
          ...cache.user,
          availableAITokenCount: user.availableAITokenCount ?? cache.user.availableAITokenCount,
          accessToken: user.accessToken || cache.user.accessToken,
        },
      }
    }
  } catch {
    // Quota refresh is best-effort; the generate call already succeeded.
  }
}
