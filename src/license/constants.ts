/** Shared API gateway host (must match signing host checks in ApiClient). */
export const API_ENDPOINT = 'https://gw.tiefeiying.com'

/** Relative path for license verification. */
export const LICENSE_VERIFY_PATH = '/reader/license/verify'

/** Relative path for unbinding a license from the current device. */
export const LICENSE_UNBIND_PATH = '/reader/license/unbind'

/**
 * Exchange a bound license for the owner's user record and a fresh access token.
 * `tokenType=license`, `identityToken` is the license key.
 */
export const PASSPORT_GET_USER_PATH = '/reader/passport/getuser'

/** Official chat-completions base. OpenAI SDK appends `/chat/completions`. */
export const OFFICIAL_AI_GENERATE_PATH = '/reader/ai/generate'

export const OFFICIAL_AI_TOKEN_INFO_PATH = '/reader/ai/tokeninfo'

/** Daily AI usage. `mode=aggregation` sums by day on the server. */
export const OFFICIAL_AI_TOKEN_STATISTICS_PATH = '/reader/ai/TokenStatistics'

/** Public catalog. `goodsType=6` is an AI traffic pack. */
export const VIP_SEARCH_PATH = '/reader/vip/search'

/** Absolute license validation URL (debug / docs). */
export const LICENSE_API_URL = `${API_ENDPOINT}${LICENSE_VERIFY_PATH}`

/** Relative path for device registration. */
export const DEVICE_REGIST_PATH = '/reader/device/regist'

/** Public purchase / license info page. */
export const LICENSE_PURCHASE_URL = 'https://www.foxycape.com/obsidian/pricing'

/** AI traffic packs are sold on the same page until a dedicated URL exists. */
export const AI_TRAFFIC_PURCHASE_URL = LICENSE_PURCHASE_URL

/** Re-validate an applied license while the plugin stays loaded. */
export const REVALIDATE_MS = 2 * 24 * 60 * 60 * 1000

/** Debounce for license input → server validation. */
export const LICENSE_INPUT_DEBOUNCE_MS = 500
