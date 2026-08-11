/** Shared API gateway host (must match signing host checks in ApiClient). */
export const API_ENDPOINT = 'https://gw.tiefeiying.com'

/** Relative path for license verification. */
export const LICENSE_VERIFY_PATH = '/reader/license/verify'

/** Relative path for unbinding a license from the current device. */
export const LICENSE_UNBIND_PATH = '/reader/license/unbind'

/** Absolute license validation URL (debug / docs). */
export const LICENSE_API_URL = `${API_ENDPOINT}${LICENSE_VERIFY_PATH}`

/** Relative path for device registration. */
export const DEVICE_REGIST_PATH = '/reader/device/regist'

/** Public purchase / license info page. */
export const LICENSE_PURCHASE_URL = 'https://www.foxycape.com/obsidian/pricing'

/** Trial length from first plugin start. */
export const TRIAL_DAYS = 7

/** Re-validate an applied license while the plugin stays loaded. */
export const REVALIDATE_MS = 2 * 24 * 60 * 60 * 1000

/** Debounce for license input → server validation. */
export const LICENSE_INPUT_DEBOUNCE_MS = 500

export const MS_PER_DAY = 24 * 60 * 60 * 1000
