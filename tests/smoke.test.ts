import { describe, expect, it } from 'vitest'
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
