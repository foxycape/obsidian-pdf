import {
  OFFICIAL_AI_TOKEN_INFO_PATH,
  OFFICIAL_AI_TOKEN_STATISTICS_PATH,
  PASSPORT_GET_USER_PATH,
} from '@/license/constants'
import type { HttpClientOptions, IApiClient } from '@/network'

export type LicenseAiUser = {
  accessToken: string
  accessTokenExpirationTime: number
  availableAITokenCount?: number
}

export type AiUsagePoint = {
  duration: string
  inputTokenCount: number
  outputTokenCount: number
  cacheTokenCount: number
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

const readBody = (raw: unknown): Record<string, unknown> | null => {
  if (isRecord(raw) && isRecord(raw.data)) {
    return raw.data
  }
  return isRecord(raw) ? raw : null
}

const readUser = (raw: unknown): LicenseAiUser | null => {
  const body = readBody(raw)
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

const readCount = (raw: unknown): number | undefined => {
  const body = readBody(raw)
  const count = body?.availableAITokenCount
  return typeof count === 'number' ? count : undefined
}

const bearerOptions = (accessToken: string): HttpClientOptions => ({
  headers: { Authorization: `Bearer ${accessToken}` },
})

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
  const raw = await apiClient.post(PASSPORT_GET_USER_PATH, {
    identityToken: trimmed,
    tokenType: 'license',
  })
  const user = readUser(raw)
  if (!user) {
    cache = null
    return null
  }
  cache = { license: trimmed, user }
  return user
}

export const refreshLicenseAiQuota = async (apiClient: IApiClient): Promise<void> => {
  if (!cache?.user.accessToken) {
    return
  }
  try {
    const raw = await apiClient.get(
      OFFICIAL_AI_TOKEN_INFO_PATH,
      {},
      true,
      bearerOptions(cache.user.accessToken),
    )
    const count = readCount(raw)
    if (typeof count === 'number' && cache) {
      cache = {
        license: cache.license,
        user: {
          ...cache.user,
          availableAITokenCount: count,
        },
      }
    }
  } catch {
    // Quota refresh is best-effort; the generate call already succeeded.
  }
}

const readUsagePoint = (value: unknown): AiUsagePoint | null => {
  if (!isRecord(value)) {
    return null
  }
  const duration = typeof value.duration === 'string' ? value.duration : ''
  if (!duration) {
    return null
  }
  const count = (key: string) => {
    const raw = value[key]
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
  }
  return {
    duration,
    inputTokenCount: count('inputTokenCount'),
    outputTokenCount: count('outputTokenCount'),
    cacheTokenCount: count('cacheTokenCount'),
  }
}

/** Last 7 days, already summed by the server. Null when the request fails. */
export const loadLicenseAiUsage = async (
  apiClient: IApiClient,
  accessToken: string,
): Promise<AiUsagePoint[] | null> => {
  try {
    const raw = await apiClient.get(
      OFFICIAL_AI_TOKEN_STATISTICS_PATH,
      { mode: 'aggregation', type: 'day', days: 7 },
      true,
      bearerOptions(accessToken),
    )
    const body = readBody(raw)
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(body)
        ? body
        : isRecord(raw) && Array.isArray(raw.data)
          ? raw.data
          : []
    return list.map(readUsagePoint).filter((point): point is AiUsagePoint => point !== null)
  } catch {
    return null
  }
}
