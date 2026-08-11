import { describe, expect, it } from 'vitest'
import type { IDevice } from '@core/kernal'
import type { ICrypto } from '@core/kernal/crypto/ICrypto'
import type { HttpClientOptions, IHttpClient } from '@core/kernal/network/IHttpClient'
import { ApiClient } from '@/network/ApiClient'
import { ResponseCode } from '@/network/ApiConstants'

const createMockDevice = (): IDevice => ({
  getModel: () => 'test',
  getDeviceType: () => 'desktop',
  getDevicePixelRatio: () => 1,
  getInfo: () => ({}) as ReturnType<IDevice['getInfo']>,
  getId: () => 'device-id',
})

const createMockCrypto = (): ICrypto => ({
  digest: async () => 'a'.repeat(40),
  encrypt: async () => new ArrayBuffer(0),
  decrypt: async () => new ArrayBuffer(0),
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
    }

    const apiClient = new ApiClient(httpClient, createMockDevice(), createMockCrypto(), {
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
    expect(String(calls[0].body.get('X_Public_Token') ?? '')).toHaveLength(40)
    expect(result.code).toBe(ResponseCode.Success)
    expect(result.message).toBe('ok')
  })

  it('returns false when endpoint is missing for relative methods', async () => {
    const apiClient = new ApiClient(
      {
        get: async () => ({}),
        post: async () => ({}),
        getConfig: async (_urls, defaultValue) => defaultValue,
      },
      createMockDevice(),
      createMockCrypto(),
      {
        endPoint: '',
        appId: 'test-app',
        getSecret: async () => '',
      },
    )
    await expect(apiClient.get('/reader/ping', {})).resolves.toBe(false)
  })
})
