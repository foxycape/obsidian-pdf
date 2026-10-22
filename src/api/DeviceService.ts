import type { IDevice } from '@foxycape/core/kernal'
import { ensureDeviceSignMaterial } from '@/api/deviceSignKey'
import { DEVICE_REGIST_PATH } from '@/license/constants'
import { ResponseCode } from '@/network/ApiConstants'
import type { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'

export type DeviceRegistApiResult = {
  success?: boolean
  code?: number
  description?: string
}

/**
 * Registers this install with `/reader/device/regist`.
 * Payload is built from {@link IDevice}; encryption is omitted until passport keys exist
 * (same plaintext fallback as the legacy app when AES key is unavailable).
 */
export class DeviceService {
  /** Public key that completed registration in this process. */
  private registeredPublicKeySpki: string | null = null
  /** In-flight or already successful registration. Cleared after a failure so the next call retries. */
  private registrationPromise: Promise<void> | null = null

  constructor(
    private readonly plugin: FoxycapePdfPlugin,
    private readonly device: IDevice,
  ) {}

  /**
   * Register this install once per process for the current ECDSA public key.
   * Concurrent callers share one request. A failure rejects and the next call tries again.
   */
  ensureRegistered = (): Promise<void> => {
    if (this.registrationPromise) {
      return this.registrationPromise
    }
    this.registrationPromise = this.registerOnce()
    return this.registrationPromise
  }

  private registerOnce = async (): Promise<void> => {
    try {
      const material = await ensureDeviceSignMaterial()
      if (this.registeredPublicKeySpki === material.publicKeySpki) {
        return
      }
      const result = await this.registerDevice()
      if (!this.isRegistrationSuccess(result)) {
        const description =
          result !== false && result.description
            ? result.description
            : 'Device registration failed.'
        throw new Error(description)
      }
      this.registeredPublicKeySpki = material.publicKeySpki
    } catch (error) {
      this.registrationPromise = null
      throw error
    }
  }

  private isRegistrationSuccess = (
    result: DeviceRegistApiResult | false,
  ): boolean => {
    if (result === false) {
      return false
    }
    return result.success === true || result.code === ResponseCode.Success
  }

  getDeviceToken = (): string => this.device.getId()

  /** Device fields shared by regist / license verify bodies. */
  buildDevicePayload = (
    otherData?: Record<string, unknown>,
  ): Record<string, unknown> => {
    const info = this.device.getInfo()
    const payload: Record<string, unknown> = {
      deviceToken: info.deviceToken ?? this.device.getId(),
      browserName: info.browserName,
      browserVersion: info.browserVersion,
      osType: info.osType,
      osVersion: info.osVersion,
      language: info.language,
      devicePixelRatio: window.devicePixelRatio,
      availableResolutionX: info.availableResolutionX,
      availableResolutionY: info.availableResolutionY,
      availableResolution:
        info.availableResolution ??
        (info.availableResolutionX != null && info.availableResolutionY != null
          ? `${info.availableResolutionX}x${info.availableResolutionY}`
          : undefined),
      deviceSize: info.deviceSize,
      deviceType: this.device.getDeviceType(),
      deviceModel: this.device.getModel(),
      currentLanguage: this.plugin.locale.getCurrentLanguage(),
      appVersion: this.plugin.manifest.version,
      confirmedTryFeatureDate:
        this.plugin.settings.trialStartedAt > 0
          ? new Date(this.plugin.settings.trialStartedAt)
          : null,
    }
    if (otherData) {
      Object.assign(payload, otherData)
    }
    return payload
  }

  registerDevice = async (
    otherData?: Record<string, unknown>,
  ): Promise<DeviceRegistApiResult | false> => {
    try {
      const payload = this.buildDevicePayload(otherData)

      const raw = await this.plugin.apiClient.post(
        DEVICE_REGIST_PATH,
        { dataJson: JSON.stringify(payload) },
        true,
      )
      if (raw === false) {
        return false
      }
      return this.parseResult(raw)
    } catch (error) {
      console.warn('[Foxycape PDF] device registration failed', error)
      return false
    }
  }

  private parseResult = (json: unknown): DeviceRegistApiResult => {
    if (!json || typeof json !== 'object') {
      return {}
    }
    const raw = json as Record<string, unknown>
    return {
      success: typeof raw.success === 'boolean' ? raw.success : undefined,
      code: typeof raw.code === 'number' ? raw.code : undefined,
      description: typeof raw.description === 'string' ? raw.description : undefined,
    }
  }
}
