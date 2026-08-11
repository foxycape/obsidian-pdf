import type { IDevice } from '@foxycape/core/kernal'
import type { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'
import { DEVICE_REGIST_PATH } from '@/license/constants'

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
  constructor(
    private readonly plugin: FoxycapePdfPlugin,
    private readonly device: IDevice,
  ) {}

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
      browserLanguage: info.browserLanguage,
      devicePixelRatio: window.devicePixelRatio,
      availableResolutionX: info.availableResolutionX,
      availableResolutionY: info.availableResolutionY,
      availableResolution:
        info.availableResolution ??
        (info.availableResolutionX != null && info.availableResolutionY != null
          ? `${info.availableResolutionX}x${info.availableResolutionY}`
          : undefined),
      deviceSize: info.deviceSize,
      cpuType: info.cpuType,
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
