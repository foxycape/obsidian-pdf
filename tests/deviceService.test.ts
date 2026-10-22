import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { IDevice } from '@foxycape/core/kernal'
import { DeviceService } from '@/api/DeviceService'
import { DEVICE_REGIST_PATH } from '@/license/constants'
import type { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}

const createDevice = (): IDevice => ({
  getModel: () => 'test',
  getDeviceType: () => 'desktop',
  getInfo: () => ({}) as ReturnType<IDevice['getInfo']>,
  getId: () => 'device-id',
  getOS: () => 'windows',
  getOSVersion: () => '10',
  getArch: () => 'x64',
  getLanguage: () => 'en',
  getOSThemeName: () => 'light',
})

const createService = (post: (path: string) => Promise<unknown>) => {
  const plugin = {
    apiClient: { post },
    locale: { getCurrentLanguage: () => 'en' },
    manifest: { version: '3.4.4' },
    settings: { trialStartedAt: 0 },
  } as unknown as FoxycapePdfPlugin
  return new DeviceService(plugin, createDevice())
}

describe('device registration gate', () => {
  it('registers once for concurrent callers and skips after success', async () => {
    let release: (value: unknown) => void = () => {}
    const pending = new Promise((resolve) => {
      release = resolve
    })
    const calls: string[] = []
    const service = createService(async (path) => {
      calls.push(path)
      return pending
    })

    const first = service.ensureRegistered()
    const second = service.ensureRegistered()
    await vi.waitFor(() => {
      expect(calls).toEqual([DEVICE_REGIST_PATH])
    })

    release({ success: true })
    await Promise.all([first, second])
    await service.ensureRegistered()
    expect(calls).toEqual([DEVICE_REGIST_PATH])
  })

  it('retries registration after a failure', async () => {
    const calls: string[] = []
    let response: unknown = { success: false, description: 'not stored' }
    const service = createService(async (path) => {
      calls.push(path)
      return response
    })

    await expect(service.ensureRegistered()).rejects.toThrow('not stored')
    response = { code: 200 }
    await service.ensureRegistered()
    expect(calls).toEqual([DEVICE_REGIST_PATH, DEVICE_REGIST_PATH])
  })
})
