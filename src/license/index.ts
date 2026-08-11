export {
  API_ENDPOINT,
  DEVICE_REGIST_PATH,
  LICENSE_API_URL,
  LICENSE_INPUT_DEBOUNCE_MS,
  LICENSE_PURCHASE_URL,
  LICENSE_UNBIND_PATH,
  LICENSE_VERIFY_PATH,
  MS_PER_DAY,
  REVALIDATE_MS,
  TRIAL_DAYS,
} from './constants'
export { LicenseService } from './LicenseService'
export type {
  LicenseApiResult,
  LicenseData,
  LicenseUnbindOutcome,
  LicenseValidationOutcome,
} from './LicenseService'
export {
  getTrialDaysRemaining,
  getTrialRemainingMs,
  isEntitled,
  isTrialActive,
} from './trial'
