import { formatDate } from '@core/kernal/common/date'
import { convertJsonToCamelcase } from '@core/kernal/common/object'
import { isNullOrWhiteSpace, startsWith } from '@core/kernal/common/text'
import { checkIsAbsoluteUrl, stringifyParamters } from '@core/kernal/common/url'
import { getUuid } from '@core/kernal/common/uuid'
import { injectExternalJS } from '@core/kernal/html/injector'
import type { HttpClientOptions, IHttpClient } from '@core/kernal/network/IHttpClient'
import { BrowserCapabilities } from '@core/kernal/web/BrowserCapabilities'
import type { ApiSettings, FileInfo, IApiClient } from './IApiClient'
import { IDevice } from '@core/kernal'
import { ICrypto } from '@core/kernal/crypto/ICrypto'

type WasmWindow = Window & {
  Module?: { asm?: unknown }
  stringToNewUTF8?: (value: string) => number
  _getToken?: (ptr: number) => number
  UTF8ToString?: (ptr: number, maxBytesToRead?: number) => string
  _free?: (ptr: number) => void
}

type ApiResult = {
  code?: number
  [key: string]: unknown
}

/**
 * Signed API client implementing {@link IApiClient}.
 * Uses `@core` for HTTP transport, crypto, device id, and helpers.
 */
export class ApiClient implements IApiClient {
  private readonly currentHttpClient: IHttpClient
  private readonly maxRefreshSecretTimes = 3
  private currentRefreshSecretTimes = 0
  private lastRefreshSecretTime: Date | null = null
  private loadedWasm = false
  private checkTimeout: ReturnType<typeof setTimeout> | null = null
  private ellapsedMillSeconds = 0
  private readonly crypto: ICrypto
  private readonly device:IDevice;
  requestHandler?: (data: object, options?: HttpClientOptions) => Promise<void>
  responseHandler?: (response: unknown) => Promise<void>

  constructor(
    httpClient: IHttpClient,
    device:IDevice,
    crypto:ICrypto,
    public readonly apiSettings: ApiSettings,
  ) {
    this.currentHttpClient = httpClient
    this.crypto = crypto
    this.device = device
  }

  get httpClient(): IHttpClient {
    return this.currentHttpClient
  }

  async post(
    methodName: string,
    data: unknown,
    sign = true,
    files?: FileInfo[],
    options?: HttpClientOptions,
  ): Promise<unknown> {
    if (isNullOrWhiteSpace(methodName)) {
      return false
    }
    const methodNameIsRemoteUrl = checkIsAbsoluteUrl(methodName)
    if (isNullOrWhiteSpace(this.apiSettings?.endPoint) && !methodNameIsRemoteUrl) {
      return false
    }

    let url = methodName
    if (!methodNameIsRemoteUrl) {
      url = this.joinEndpoint(this.apiSettings.endPoint, methodName)
    }

    const isApiHost = this.isSameHost(url, this.apiSettings.endPoint)
    let bodyData = this.normalizeRequestData(data, options)

    const requestOptions: HttpClientOptions = {
      ...(options ?? {}),
      headers: { ...(options?.headers ?? {}) },
      responseType: options?.responseType ?? 'json',
    }
    if (!bodyData) {
      bodyData = {}
    }

    if (isApiHost) {
      await this.handleMethodParameters(bodyData as object, requestOptions)
    }

    const deviceToken = this.device.getId()
    const systemParameters = this.getSystemParameters(deviceToken)
    let body: unknown

    if (requestOptions.requestBodyType === 'raw') {
      body = bodyData
      if (isApiHost) {
        for (const key of Object.keys(systemParameters)) {
          requestOptions.headers![key] = String(systemParameters[key])
        }
      }
    } else {
      let payload: Record<string, unknown>
      if (isApiHost) {
        payload = { ...(bodyData as object), ...systemParameters }
        if (sign) {
          payload.X_Public_Token = await this.getSignature(payload)
        }
      } else {
        payload = { ...(bodyData as object) }
      }

      const formData = new FormData()
      for (const key of Object.keys(payload)) {
        formData.append(key, payload[key] as string | Blob)
      }
      if (files?.length) {
        for (const file of files) {
          formData.append(file.name, file.file, file.fileName)
        }
      }
      body = formData
    }

    const result = (await this.httpClient.post(url, body, requestOptions)) as ApiResult
    if (this.shouldRefreshSecret(result)) {
      await this.refreshSigningEnv()
      return this.post(methodName, data, sign, files, options)
    }

    this.convertToCamelcase(result)
    if (this.responseHandler) {
      await this.responseHandler(result)
    }
    return result
  }

  async get(
    methodName: string,
    data: unknown,
    sign = true,
    options?: HttpClientOptions,
  ): Promise<unknown> {
    if (isNullOrWhiteSpace(methodName)) {
      return false
    }
    const methodNameIsRemoteUrl = checkIsAbsoluteUrl(methodName)
    if (isNullOrWhiteSpace(this.apiSettings?.endPoint) && !methodNameIsRemoteUrl) {
      return false
    }

    let url = methodName
    if (!methodNameIsRemoteUrl) {
      url = this.joinEndpoint(this.apiSettings.endPoint, methodName)
    }

    const isApiHost = this.isSameHost(url, this.apiSettings.endPoint)
    let parametersData: Record<string, unknown> =
      data instanceof Map ? Object.fromEntries(data) : ((data as object) ?? {})
    if (!parametersData) {
      parametersData = {}
    }

    const requestOptions: HttpClientOptions = Object.assign({}, options ?? {}, {
      headers: { ...(options?.headers ?? {}) },
      responseType: options?.responseType ?? 'json',
    })

    let parameters: Record<string, unknown>
    if (isApiHost) {
      await this.handleMethodParameters(parametersData, requestOptions)
      const systemParameters = this.getSystemParameters(this.device.getId())
      parameters = { ...parametersData, ...systemParameters }
      if (sign) {
        parameters.X_Public_Token = await this.getSignature(parameters)
      }
    } else {
      parameters = { ...parametersData }
    }

    const query = stringifyParamters(parameters)
    if (!isNullOrWhiteSpace(query)) {
      url = `${url}?${query}`
    }

    const result = (await this.httpClient.get(url, requestOptions)) as ApiResult
    if (this.shouldRefreshSecret(result)) {
      this.loadedWasm = false
      await this.refreshSigningEnv()
      return this.get(methodName, data, sign, options)
    }

    this.convertToCamelcase(result)
    if (this.responseHandler) {
      await this.responseHandler(result)
    }
    return result
  }

  async sign(methodParameters: unknown): Promise<Record<string, unknown>> {
    let parameters: Record<string, unknown> =
      methodParameters instanceof Map
        ? Object.fromEntries(methodParameters)
        : ((methodParameters as object) ?? {})
    if (!parameters) {
      parameters = {}
    }
    await this.handleMethodParameters(parameters)
    await this.ensureEnvCompleted()
    const systemParameters = this.getSystemParameters(this.device.getId())
    const signed = { ...parameters, ...systemParameters }
    signed.X_Public_Token = await this.getSignature(signed)
    return signed
  }

  private joinEndpoint = (endPoint: string, methodName: string): string => {
    let base = endPoint
    if (base.endsWith('/')) {
      base = base.slice(0, -1)
    }
    const path = startsWith(methodName, '/') ? methodName : `/${methodName}`
    return `${base}${path}`
  }

  private isSameHost = (url: string, endPoint: string | undefined | null): boolean => {
    if (isNullOrWhiteSpace(endPoint)) {
      return false
    }
    try {
      return new URL(url).host.toLowerCase() === new URL(endPoint).host.toLowerCase()
    } catch {
      return false
    }
  }

  private normalizeRequestData = (data: unknown, options?: HttpClientOptions): unknown => {
    if (!data || options?.requestBodyType === 'raw') {
      return data
    }

    const newData: Record<string, unknown> = {}
    if (data instanceof Map) {
      for (const [key, value] of data.entries()) {
        newData[key] = typeof value === 'string' ? this.handleText(value) : value
      }
      return newData
    }
    if (data instanceof FormData) {
      for (const key of data.keys()) {
        const value = data.get(key)
        newData[key] = typeof value === 'string' ? this.handleText(value) : value
      }
      return newData
    }
    if (typeof data === 'object') {
      for (const key of Object.keys(data as object)) {
        const value = (data as Record<string, unknown>)[key]
        newData[key] = typeof value === 'string' ? this.handleText(value) : value
      }
      return newData
    }
    return data
  }

  private handleText = (text: string) => {
    // FormData normalizes lone \r/\n to \r\n; keep signing input stable.
    return text.replace(/\r\n/g, '\n').replace(/[\r\n]/g, '\r\n')
  }

  protected getSystemParameters = (deviceToken: string): Record<string, unknown> => {
    return {
      X_Public_AppId: this.apiSettings.appId,
      X_Public_ApiVersion: this.apiSettings.apiVersion ?? '1.0',
      X_Public_AppVersion: this.apiSettings.appVersion ?? '1.0.0',
      X_Public_DeviceToken: deviceToken,
      X_Public_Nonce: getUuid(),
      X_Public_TimeStamp: formatDate(new Date(), true),
      camelcase: !!this.apiSettings.camelcase,
    }
  }

  protected convertToCamelcase = (data: unknown) => {
    if (!this.apiSettings.camelcase || this.apiSettings.serverIsSupportCamelcase) {
      return
    }
    convertJsonToCamelcase(data as object)
  }

  private handleMethodParameters = async (data: object, options?: HttpClientOptions) => {
    if (this.requestHandler) {
      await this.requestHandler(data, options)
    }
  }

  private getRequireChangeSecretCode = () =>
    this.apiSettings.requireChangeSecretCode ?? 999

  private shouldRefreshSecret = (result: ApiResult | null | undefined): boolean => {
    if (!result || result.code !== this.getRequireChangeSecretCode()) {
      return false
    }
    if (
      this.lastRefreshSecretTime &&
      Date.now() - this.lastRefreshSecretTime.getTime() > 60 * 1000
    ) {
      this.lastRefreshSecretTime = null
      this.currentRefreshSecretTimes = 0
    }
    return this.currentRefreshSecretTimes <= this.maxRefreshSecretTimes
  }

  private refreshSigningEnv = async () => {
    this.currentRefreshSecretTimes += 1
    this.lastRefreshSecretTime = new Date()
    await this.ensureEnvCompleted()
  }

  private async ensureEnvCompleted(): Promise<void> {
    if (this.loadedWasm || !this.apiSettings.enableWasm || !BrowserCapabilities.supportWebAssembly()) {
      return
    }

    let wasmSignerUrl = this.apiSettings.wasmSignerFilePath ?? 'static/signer.js'
    if (this.apiSettings.getWasmSignerUrl) {
      wasmSignerUrl = await this.apiSettings.getWasmSignerUrl(wasmSignerUrl)
    } else {
      const separator = wasmSignerUrl.includes('?') ? '&' : '?'
      wasmSignerUrl = `${wasmSignerUrl}${separator}_custom_preventCacheHash=${Date.now()}`
    }

    await injectExternalJS(
      document,
      wasmSignerUrl,
      true,
      `x_${Math.random()}_${this.currentRefreshSecretTimes}`,
    )

    this.ellapsedMillSeconds = 0
    await new Promise<void>((resolve, reject) => {
      this.checkWasmLoaded(resolve, reject)
    })
  }

  private checkWasmLoaded = (resolve: () => void, reject: (reason?: unknown) => void) => {
    if (this.checkTimeout) {
      clearTimeout(this.checkTimeout)
      this.checkTimeout = null
    }

    this.ellapsedMillSeconds += 10
    const wasmWindow = window as WasmWindow
    if (wasmWindow.Module?.asm) {
      this.loadedWasm = true
      resolve()
      return
    }

    if (this.ellapsedMillSeconds >= 60 * 1000) {
      reject(new Error('timeout'))
      return
    }

    this.checkTimeout = setTimeout(() => {
      this.checkWasmLoaded(resolve, reject)
    }, 10)
  }

  private async getSignature(parameters: Record<string, unknown>): Promise<string> {
    if (!parameters) {
      return ''
    }
    await this.ensureEnvCompleted()

    const query = Object.keys(parameters)
      .sort((a, b) => (a.toLowerCase() >= b.toLowerCase() ? 1 : -1))
      .map((key) => `${key}=${parameters[key]}`)
      .join('')

    if (
      BrowserCapabilities.supportWebAssembly() &&
      this.apiSettings.enableWasm &&
      this.loadedWasm
    ) {
      const wasmWindow = window as WasmWindow
      if (
        !wasmWindow.stringToNewUTF8 ||
        !wasmWindow._getToken ||
        !wasmWindow.UTF8ToString ||
        !wasmWindow._free
      ) {
        return ''
      }
      const p = wasmWindow.stringToNewUTF8(query)
      const p2 = wasmWindow._getToken(p)
      const hash = wasmWindow.UTF8ToString(p2, 40)
      wasmWindow._free(p)
      wasmWindow._free(p2)
      return hash
    }

    if (this.apiSettings.getSecret) {
      const signedQuery = query + (await this.apiSettings.getSecret())
      return this.crypto.digest(signedQuery, 'SHA-1')
    }
    return ''
  }
}
