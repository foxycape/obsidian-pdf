import { requestUrl, type RequestUrlResponse } from 'obsidian'
import type { HttpClientOptions, IHttpClient, ResponseType } from '@/network'

const isFormDataLike = (data: unknown): data is FormData =>
  !!data &&
  typeof data === 'object' &&
  typeof (data as FormData).append === 'function' &&
  typeof (data as FormData).entries === 'function'

/**
 * Obsidian transport for {@link IHttpClient}.
 * Uses `requestUrl` so API calls bypass CORS (unlike browser `fetch`).
 */
export class ObsidianHttpClient implements IHttpClient {
  async get(url: string, options?: HttpClientOptions): Promise<unknown> {
    const responseType = options?.responseType ?? 'text'
    const response = await requestUrl({
      url,
      method: 'GET',
      headers: this.normalizeHeaders(options?.headers),
      throw: false,
    })
    this.throwIfFailed(response)
    return this.parseResponse(response, responseType)
  }

  async post(url: string, data: unknown, options?: HttpClientOptions): Promise<unknown> {
    const serialized = this.serializeBody(data, options)
    const response = await requestUrl({
      url,
      method: 'POST',
      headers: serialized.headers,
      contentType: serialized.contentType,
      body: serialized.body,
      throw: false,
    })
    this.throwIfFailed(response)
    return this.parseResponse(response, options?.responseType ?? 'json')
  }

  async getConfig<T>(
    urls: string[],
    defaultValue: T,
    responseType: ResponseType = 'json',
  ): Promise<T> {
    if (!urls?.length) {
      return defaultValue
    }

    const datas: T[] = []
    let dataIsArray = false
    for (const url of urls) {
      try {
        const data: unknown = await this.get(url, { responseType })
        if (!data) {
          continue
        }
        if (!dataIsArray) {
          dataIsArray = Array.isArray(data)
        }
        datas.push(data as T)
      } catch {
        // Ignore failed pages when merging multi-page responses.
      }
    }

    if (datas.length === 0) {
      return defaultValue
    }
    if (defaultValue) {
      return Object.assign(defaultValue as object, ...datas) as T
    }
    if (dataIsArray) {
      return Object.assign([], ...datas) as T
    }
    return Object.assign({}, ...datas) as T
  }

  private serializeBody = (
    data: unknown,
    options?: HttpClientOptions,
  ): {
    body?: string | ArrayBuffer
    contentType?: string
    headers?: Record<string, string>
  } => {
    const headers = this.normalizeHeaders(options?.headers) ?? {}

    if (data == null) {
      return { headers }
    }

    if (typeof data === 'string' || data instanceof ArrayBuffer) {
      return {
        body: data,
        contentType: this.pickContentType(headers) ?? undefined,
        headers: this.withoutContentType(headers),
      }
    }

    if (isFormDataLike(data)) {
      const encoded = this.encodeFormData(data)
      return {
        body: encoded.body,
        contentType: encoded.contentType,
        headers: this.withoutContentType(headers),
      }
    }

    if (typeof data === 'object') {
      if (options?.requestBodyType === 'raw') {
        return {
          body: JSON.stringify(data),
          contentType: 'application/json',
          headers: this.withoutContentType(headers),
        }
      }

      const record = data as Record<string, unknown>
      const formData = new FormData()
      for (const key of Object.keys(record)) {
        formData.append(key, String(record[key]))
      }
      const encoded = this.encodeFormData(formData)
      return {
        body: encoded.body,
        contentType: encoded.contentType,
        headers: this.withoutContentType(headers),
      }
    }

    return {
      body: String(data),
      contentType: this.pickContentType(headers) ?? undefined,
      headers: this.withoutContentType(headers),
    }
  }

  /**
   * `requestUrl` only accepts string/ArrayBuffer bodies.
   * Signed API posts are string fields → urlencoded (server accepts form posts).
   */
  private encodeFormData = (
    formData: FormData,
  ): { body: string; contentType: string } => {
    const params = new URLSearchParams()
    for (const [key, value] of formData.entries()) {
      if (typeof value !== 'string') {
        throw new Error(
          'ObsidianHttpClient only supports string FormData fields via requestUrl.',
        )
      }
      params.append(key, value)
    }
    return {
      body: params.toString(),
      contentType: 'application/x-www-form-urlencoded',
    }
  }

  private parseResponse = (response: RequestUrlResponse, responseType: ResponseType) => {
    if (responseType === 'json') {
      try {
        return response.json
      } catch {
        return {}
      }
    }
    if (responseType === 'arraybuffer') {
      return response.arrayBuffer
    }
    if (responseType === 'blob') {
      return new Blob([response.arrayBuffer])
    }
    if (responseType === 'stream') {
      return new Blob([response.arrayBuffer])
    }
    const text = response.text
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  private throwIfFailed = (response: RequestUrlResponse) => {
    if (response.status >= 200 && response.status < 300) {
      return
    }
    if (response.status === 404) {
      throw new Error(`File not found! status: ${response.status}`)
    }
    if (response.status === 403) {
      throw new Error(`Forbidden! status: ${response.status}`)
    }
    if (response.status === 401) {
      throw new Error(`Unauthorized! status: ${response.status}`)
    }
    throw new Error(`HTTP error! status: ${response.status},message: ${response.text}`)
  }

  private normalizeHeaders = (
    headers?: Record<string, string> | HeadersInit,
  ): Record<string, string> | undefined => {
    if (!headers) {
      return undefined
    }
    if (headers instanceof Headers) {
      const result: Record<string, string> = {}
      headers.forEach((value, key) => {
        result[key] = value
      })
      return result
    }
    if (Array.isArray(headers)) {
      return Object.fromEntries(headers)
    }
    return { ...headers }
  }

  private pickContentType = (headers: Record<string, string>): string | null => {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'content-type') {
        return value
      }
    }
    return null
  }

  private withoutContentType = (headers: Record<string, string>): Record<string, string> => {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() !== 'content-type') {
        result[key] = value
      }
    }
    return result
  }
}
