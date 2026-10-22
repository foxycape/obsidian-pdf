import { formatDate } from '@foxycape/core/kernal/common/date'
import { convertJsonToCamelcase } from '@foxycape/core/kernal/common/object'
import { isNullOrWhiteSpace, startsWith } from '@foxycape/core/kernal/common/text'
import { checkIsAbsoluteUrl, stringifyParamters } from '@foxycape/core/kernal/common/url'
import { getUuid } from '@foxycape/core/kernal/common/uuid'
import type { HttpClientOptions, IHttpClient } from '@foxycape/core/kernal/network/IHttpClient'
import type { ApiSettings, FileInfo, IApiClient } from './IApiClient'
import { IDevice } from '@foxycape/core/kernal'
import { canonicalSignQuery, ensureDeviceSignMaterial } from '@/api/deviceSignKey'

type ApiResult = {
  code?: number
  [key: string]: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const recordFromMap = (map: Map<unknown, unknown>): Record<string, unknown> => {
  const record: Record<string, unknown> = {}
  for (const [key, value] of map.entries()) {
    record[String(key)] = value
  }
  return record
}

const copyRequestHeaders = (headers: unknown): Record<string, string> => {
  if (!isRecord(headers)) {
    return {}
  }
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    result[key] = String(value)
  }
  return result
}

/**
 * Signed API client implementing {@link IApiClient}.
 * Uses `@foxycape/core` for HTTP transport, device id, and helpers.
 * Requests are signed with the device ECDSA key.
 */
export class ApiClient implements IApiClient {
  private readonly currentHttpClient: IHttpClient
  private readonly maxRefreshSecretTimes = 3
  private currentRefreshSecretTimes = 0
  private lastRefreshSecretTime: Date | null = null
  private readonly device:IDevice;
  requestHandler?: (data: object, options?: HttpClientOptions) => Promise<void>
  responseHandler?: (response: unknown) => Promise<void>
  private ensureDeviceRegistered: (() => Promise<void>) | null = null

  /** Installed by the plugin after the device service exists. */
  setEnsureDeviceRegistered = (ensure: () => Promise<void>): void => {
    this.ensureDeviceRegistered = ensure
  }

  constructor(
    httpClient: IHttpClient,
    device:IDevice,
    public readonly apiSettings: ApiSettings,
  ) {
    this.currentHttpClient = httpClient
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
    await this.waitForDeviceRegistration(url, sign, isApiHost)
    let bodyData = this.normalizeRequestData(data, options)

    const headers = copyRequestHeaders(options?.headers)
    const requestOptions: HttpClientOptions = {
      ...(options ?? {}),
      headers,
      responseType: options?.responseType ?? 'json',
    }
    if (!bodyData || typeof bodyData !== 'object') {
      bodyData = {}
    }
    const bodyRecord = bodyData as Record<string, unknown>

    if (isApiHost) {
      await this.handleMethodParameters(bodyRecord, requestOptions)
    }

    const deviceToken = this.device.getId()
    const systemParameters = this.getSystemParameters(deviceToken)
    let body: unknown

    if (requestOptions.requestBodyType === 'raw') {
      body = bodyData
      if (isApiHost) {
        for (const [key, value] of Object.entries(systemParameters)) {
          headers[key] = String(value)
        }
        requestOptions.headers = headers
      }
    } else {
      let payload: Record<string, unknown>
      if (isApiHost) {
        payload = { ...bodyRecord, ...systemParameters }
        if (sign) {
          payload = await this.signPayload(payload)
        }
      } else {
        payload = { ...bodyRecord }
      }

      const formData = new FormData()
      for (const key of Object.keys(payload)) {
        const value = payload[key]
        formData.append(key, value instanceof Blob ? value : String(value ?? ''))
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
    await this.waitForDeviceRegistration(url, sign, isApiHost)
    const parametersData: Record<string, unknown> =
      data instanceof Map
        ? recordFromMap(data)
        : isRecord(data)
          ? { ...data }
          : {}

    const requestOptions: HttpClientOptions = {
      ...(options ?? {}),
      headers: copyRequestHeaders(options?.headers),
      responseType: options?.responseType ?? 'json',
    }

    let parameters: Record<string, unknown>
    if (isApiHost) {
      await this.handleMethodParameters(parametersData, requestOptions)
      const systemParameters = this.getSystemParameters(this.device.getId())
      parameters = { ...parametersData, ...systemParameters }
      if (sign) {
        parameters = await this.signPayload(parameters)
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
    const parameters: Record<string, unknown> =
      methodParameters instanceof Map
        ? recordFromMap(methodParameters)
        : isRecord(methodParameters)
          ? { ...methodParameters }
          : {}
    await this.handleMethodParameters(parameters)
    const systemParameters = this.getSystemParameters(this.device.getId())
    return this.signPayload({ ...parameters, ...systemParameters })
  }

  /** Registration is the request that binds the key, so it must not wait for itself. */
  private waitForDeviceRegistration = async (
    url: string,
    sign: boolean,
    isApiHost: boolean,
  ): Promise<void> => {
    if (!sign || !isApiHost || !this.ensureDeviceRegistered || this.isDeviceRegistRequest(url)) {
      return
    }
    await this.ensureDeviceRegistered()
  }

  private isDeviceRegistRequest = (url: string): boolean => {
    let path = url
    try {
      path = new URL(url).pathname
    } catch {
      path = url.split('?')[0] ?? url
    }
    return path.replace(/\/+$/, '').toLowerCase().endsWith('/device/regist')
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
        newData[String(key)] = typeof value === 'string' ? this.handleText(value) : value
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
      const record = data as Record<string, unknown>
      for (const key of Object.keys(record)) {
        const value = record[key]
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
  }

  /** ECDSA P-256 over the ordinal canonical string. The private key never leaves this device. */
  private signPayload = async (
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const material = await ensureDeviceSignMaterial()
    const signed: Record<string, unknown> = {
      ...payload,
      X_Public_SignAlg: material.alg,
      X_Public_SignPublicKey: material.publicKeySpki,
    }
    signed.X_Public_Token = await material.sign(canonicalSignQuery(signed))
    return signed
  }
}
