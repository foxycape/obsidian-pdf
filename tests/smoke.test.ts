import { describe, expect, it } from 'vitest'
import {
  getTrialDaysRemaining,
  getTrialRemainingMs,
  isEntitled,
  isTrialActive,
  MS_PER_DAY,
  TRIAL_DAYS,
} from '@/license'
import { DEFAULT_SETTINGS } from '@/settings/types'

describe('foxycape-pdf settings', () => {
  it('defaults to not replacing the built-in PDF viewer', () => {
    expect(DEFAULT_SETTINGS.useAsDefaultPdfViewer).toBe(false)
  })

  it('defaults license fields to unset / invalid', () => {
    expect(DEFAULT_SETTINGS.license).toBe('')
    expect(DEFAULT_SETTINGS.trialStartedAt).toBe(0)
    expect(DEFAULT_SETTINGS.licenseValid).toBe(false)
    expect(DEFAULT_SETTINGS.licenseLifetime).toBe(false)
    expect(DEFAULT_SETTINGS.lastLicenseCheckAt).toBe(0)
  })
})

describe('foxycape-pdf trial entitlement', () => {
  const startedAt = 1_700_000_000_000

  it('reports full trial days at start', () => {
    expect(getTrialDaysRemaining(startedAt, () => startedAt)).toBe(TRIAL_DAYS)
    expect(isTrialActive(startedAt, () => startedAt)).toBe(true)
  })

  it('uses ceil for partial remaining days', () => {
    const almostOneDayLeft = startedAt + (TRIAL_DAYS - 0.5) * MS_PER_DAY
    expect(getTrialDaysRemaining(startedAt, () => almostOneDayLeft)).toBe(1)
    expect(isTrialActive(startedAt, () => almostOneDayLeft)).toBe(true)
  })

  it('expires after 7 days', () => {
    const afterTrial = startedAt + TRIAL_DAYS * MS_PER_DAY
    expect(getTrialRemainingMs(startedAt, () => afterTrial)).toBe(0)
    expect(getTrialDaysRemaining(startedAt, () => afterTrial)).toBe(0)
    expect(isTrialActive(startedAt, () => afterTrial)).toBe(false)
    expect(isEntitled(false, startedAt, () => afterTrial)).toBe(false)
  })

  it('valid license overrides expired trial', () => {
    const afterTrial = startedAt + (TRIAL_DAYS + 1) * MS_PER_DAY
    expect(isEntitled(true, startedAt, () => afterTrial)).toBe(true)
  })

  it('treats unset trialStartedAt as full trial remaining for display helpers', () => {
    expect(getTrialDaysRemaining(0, () => startedAt)).toBe(TRIAL_DAYS)
  })
})
