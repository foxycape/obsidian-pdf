import { MS_PER_DAY, TRIAL_DAYS } from './constants'

export type TrialClock = () => number

const defaultNow: TrialClock = () => Date.now()

/** Remaining trial time in ms; negative when expired. */
export const getTrialRemainingMs = (
  trialStartedAt: number,
  now: TrialClock = defaultNow,
): number => {
  if (!trialStartedAt || trialStartedAt <= 0) {
    return TRIAL_DAYS * MS_PER_DAY
  }
  return trialStartedAt + TRIAL_DAYS * MS_PER_DAY - now()
}

/** Whole days left for UI (ceil); 0 when trial ended. */
export const getTrialDaysRemaining = (
  trialStartedAt: number,
  now: TrialClock = defaultNow,
): number => {
  const remainingMs = getTrialRemainingMs(trialStartedAt, now)
  if (remainingMs <= 0) {
    return 0
  }
  return Math.ceil(remainingMs / MS_PER_DAY)
}

export const isTrialActive = (
  trialStartedAt: number,
  now: TrialClock = defaultNow,
): boolean => getTrialRemainingMs(trialStartedAt, now) > 0

/** Licensed or still in trial. */
export const isEntitled = (
  licenseValid: boolean,
  trialStartedAt: number,
  now: TrialClock = defaultNow,
): boolean => licenseValid || isTrialActive(trialStartedAt, now)
