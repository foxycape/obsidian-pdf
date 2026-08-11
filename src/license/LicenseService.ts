import type { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'
import { LICENSE_UNBIND_PATH, LICENSE_VERIFY_PATH, REVALIDATE_MS } from './constants'
import { getTrialDaysRemaining, isEntitled, isTrialActive } from './trial'

export type LicenseData = {
  valid: boolean
  lifetime: boolean
}

/** Mirrors `Result<T>` from the license API. */
export type LicenseApiResult = {
  success?: boolean
  code?: number
  description?: string
  data?: LicenseData | null
}

export type LicenseValidationOutcome =
  | { kind: 'empty' }
  | { kind: 'valid'; lifetime: boolean }
  | { kind: 'invalid'; message: string }
  | { kind: 'network_error'; message?: string }

export type LicenseUnbindOutcome =
  | { kind: 'empty' }
  | { kind: 'success' }
  | { kind: 'failed'; message: string }
  | { kind: 'network_error'; message?: string }

export class LicenseService {
  private periodicRegistered = false

  constructor(private readonly plugin: FoxycapePdfPlugin) {}

  ensureTrialStarted = async (): Promise<void> => {
    if (this.plugin.settings.trialStartedAt > 0) {
      return
    }
    this.plugin.settings.trialStartedAt = Date.now()
    await this.plugin.saveSettings()
  }

  getTrialDaysRemaining = (): number =>
    getTrialDaysRemaining(this.plugin.settings.trialStartedAt)

  isTrialActive = (): boolean => isTrialActive(this.plugin.settings.trialStartedAt)

  isEntitled = (): boolean =>
    isEntitled(this.plugin.settings.licenseValid, this.plugin.settings.trialStartedAt)

  /**
   * Persist license text and validate with the server when non-empty.
   * Empty input clears the applied state (keeps trial).
   */
  setLicense = async (license: string): Promise<LicenseValidationOutcome> => {
    const trimmed = license.trim()
    this.plugin.settings.license = trimmed
    if (!trimmed) {
      this.plugin.settings.licenseValid = false
      this.plugin.settings.licenseLifetime = false
      await this.plugin.saveSettings()
      return { kind: 'empty' }
    }
    return this.validateLicense(trimmed)
  }

  /**
   * POST license only. Device token is supplied via ApiClient system parameters
   * (`X_Public_DeviceToken`). On network failure, keep the previous cache (grace).
   * On definitive invalid response, clear licenseValid but keep the license string.
   */
  validateLicense = async (
    license: string = this.plugin.settings.license,
  ): Promise<LicenseValidationOutcome> => {
    const trimmed = license.trim()
    if (!trimmed) {
      await this.clearLocalLicense()
      return { kind: 'empty' }
    }

    this.plugin.settings.license = trimmed

    try {
      const raw = await this.plugin.apiClient.post(LICENSE_VERIFY_PATH, {
        license: trimmed,
      })
      if (raw === false) {
        return { kind: 'network_error', message: 'API not configured' }
      }

      const result = this.parseApiResult(raw)
      if (!result) {
        return { kind: 'network_error', message: 'Invalid response' }
      }

      const data = result.data
      const isValid = Boolean(data?.valid) && result.success !== false
      const lifetime = Boolean(data?.lifetime)
      const now = Date.now()

      if (isValid) {
        this.plugin.settings.licenseValid = true
        this.plugin.settings.licenseLifetime = lifetime
        this.plugin.settings.lastLicenseCheckAt = now
        await this.plugin.saveSettings()
        return { kind: 'valid', lifetime }
      }

      // Definitive invalid — clear applied state, keep typed key for correction.
      this.plugin.settings.licenseValid = false
      this.plugin.settings.licenseLifetime = false
      this.plugin.settings.lastLicenseCheckAt = now
      await this.plugin.saveSettings()
      return {
        kind: 'invalid',
        message: result.description?.trim() || 'Invalid license',
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[Foxycape PDF] license validation failed (network)', error)
      return { kind: 'network_error', message }
    }
  }

  /**
   * POST license only to unbind from the current device.
   * Device token comes from ApiClient system parameters.
   * On success, clears local license state (keeps trial).
   */
  unbindLicense = async (): Promise<LicenseUnbindOutcome> => {
    const trimmed = this.plugin.settings.license.trim()
    if (!trimmed) {
      await this.clearLocalLicense()
      return { kind: 'empty' }
    }

    try {
      const raw = await this.plugin.apiClient.post(LICENSE_UNBIND_PATH, {
        license: trimmed,
      })
      if (raw === false) {
        return { kind: 'network_error', message: 'API not configured' }
      }

      const result = this.parseApiResult(raw)
      if (!result) {
        return { kind: 'network_error', message: 'Invalid response' }
      }

      if (result.success === false) {
        return {
          kind: 'failed',
          message: result.description?.trim() || 'Failed to unbind license',
        }
      }

      await this.clearLocalLicense()
      return { kind: 'success' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[Foxycape PDF] license unbind failed (network)', error)
      return { kind: 'network_error', message }
    }
  }

  /** Validate on startup when a license key is stored. */
  validateOnStartupIfNeeded = async (): Promise<void> => {
    await this.ensureTrialStarted()
    if (!this.plugin.settings.license.trim()) {
      return
    }
    await this.validateLicense()
  }

  /** Every 2 days while the plugin stays loaded, re-check a stored license. */
  startPeriodicValidation = (): void => {
    if (this.periodicRegistered) {
      return
    }
    this.periodicRegistered = true
    this.plugin.registerInterval(
      window.setInterval(() => {
        if (!this.plugin.settings.license.trim()) {
          return
        }
        void this.validateLicense()
      }, REVALIDATE_MS),
    )
  }

  private clearLocalLicense = async (): Promise<void> => {
    this.plugin.settings.license = ''
    this.plugin.settings.licenseValid = false
    this.plugin.settings.licenseLifetime = false
    this.plugin.settings.lastLicenseCheckAt = 0
    await this.plugin.saveSettings()
  }

  private parseApiResult = (json: unknown): LicenseApiResult | null => {
    if (!json || typeof json !== 'object') {
      return null
    }
    const raw = json as Record<string, unknown>
    const dataRaw = raw.data
    let data: LicenseData | null = null
    if (dataRaw && typeof dataRaw === 'object') {
      const d = dataRaw as Record<string, unknown>
      data = {
        valid: Boolean(d.valid),
        lifetime: Boolean(d.lifetime),
      }
    }
    return {
      success: typeof raw.success === 'boolean' ? raw.success : undefined,
      code: typeof raw.code === 'number' ? raw.code : undefined,
      description: typeof raw.description === 'string' ? raw.description : undefined,
      data,
    }
  }
}
