import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}
import type { IDevice } from '@foxycape/core/kernal'
import type { HttpClientOptions, IHttpClient } from '@foxycape/core/kernal/network/IHttpClient'
import { ApiClient } from '@/network/ApiClient'
import { ResponseCode } from '@/network/ApiConstants'

const createMockDevice = (): IDevice => ({
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

describe('foxycape-pdf network', () => {
  it('exposes response codes', () => {
    expect(ResponseCode.Success).toBe(200)
    expect(ResponseCode.AccessTokenExpired).toBe(18)
  })

  it('signs and posts through IApiClient using core IHttpClient', async () => {
    const calls: Array<{ url: string; body: FormData }> = []
    const httpClient: IHttpClient = {
      get: async () => ({}),
      post: async (url, data, _options?: HttpClientOptions) => {
        calls.push({ url, body: data as FormData })
        return { code: ResponseCode.Success, Message: 'ok' }
      },
      getConfig: async (_urls, defaultValue) => defaultValue,
      getRange: async () => ({ data: new Uint8Array(), status: 200, partial: false }),
    }

    const apiClient = new ApiClient(httpClient, createMockDevice(), {
      endPoint: 'https://api.example.com',
      appId: 'test-app',
      getSecret: async () => 'secret',
      camelcase: true,
      serverIsSupportCamelcase: false,
    })

    const result = (await apiClient.post('/reader/ping', { foo: 'bar' })) as {
      code: number
      message?: string
    }

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.example.com/reader/ping')
    expect(calls[0].body.get('foo')).toBe('bar')
    expect(calls[0].body.get('X_Public_AppId')).toBe('test-app')
    expect(calls[0].body.get('X_Public_SignAlg')).toBe('ecdsa-p256-sha256')
    expect(String(calls[0].body.get('X_Public_SignPublicKey') ?? '').length).toBeGreaterThan(40)
    expect(String(calls[0].body.get('X_Public_Token') ?? '').length).toBeGreaterThan(40)
    expect(result.code).toBe(ResponseCode.Success)
    expect(result.message).toBe('ok')
  })

  it('holds a signed API call until device registration succeeds', async () => {
    const calls: string[] = []
    let releaseRegistration: () => void = () => {}
    const registration = new Promise<void>((resolve) => {
      releaseRegistration = resolve
    })
    const httpClient: IHttpClient = {
      get: async (url) => {
        calls.push(url)
        return { code: ResponseCode.Success }
      },
      post: async (url) => {
        calls.push(url)
        return { code: ResponseCode.Success }
      },
      getConfig: async (_urls, defaultValue) => defaultValue,
      getRange: async () => ({ data: new Uint8Array(), status: 200, partial: false }),
    }
    const apiClient = new ApiClient(httpClient, createMockDevice(), {
      endPoint: 'https://api.example.com',
      appId: 'test-app',
      getSecret: async () => 'secret',
    })
    apiClient.setEnsureDeviceRegistered(() => registration)

    const pending = apiClient.post('/reader/license/verify', { license: 'key' })
    await Promise.resolve()
    expect(calls).toHaveLength(0)

    releaseRegistration()
    await pending
    expect(calls).toEqual(['https://api.example.com/reader/license/verify'])
  })

  it('does not wait for registration when posting the regist path', async () => {
    let waited = false
    const httpClient: IHttpClient = {
      get: async () => ({}),
      post: async (url) => url,
      getConfig: async (_urls, defaultValue) => defaultValue,
      getRange: async () => ({ data: new Uint8Array(), status: 200, partial: false }),
    }
    const apiClient = new ApiClient(httpClient, createMockDevice(), {
      endPoint: 'https://api.example.com',
      appId: 'test-app',
      getSecret: async () => 'secret',
    })
    apiClient.setEnsureDeviceRegistered(async () => {
      waited = true
    })

    await apiClient.post('/reader/device/regist', { dataJson: '{}' })
    expect(waited).toBe(false)
  })

  it('returns false when endpoint is missing for relative methods', async () => {
    const apiClient = new ApiClient(
      {
        get: async () => ({}),
        post: async () => ({}),
        getConfig: async (_urls, defaultValue) => defaultValue,
        getRange: async () => ({ data: new Uint8Array(), status: 200, partial: false }),
      },
      createMockDevice(),
      {
        endPoint: '',
        appId: 'test-app',
        getSecret: async () => '',
      },
    )
    await expect(apiClient.get('/reader/ping', {})).resolves.toBe(false)
  })
})
