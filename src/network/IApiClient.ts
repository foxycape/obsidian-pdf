import type { HttpClientOptions, IHttpClient } from '@foxycape/core/kernal/network/IHttpClient'

export type FileInfo = {
  file: Blob
  /** Form field name */
  name: string
  /** Uploaded file name */
  fileName: string
}

export type ApiSettings = {
  /** API base URL, e.g. https://gw.example.com */
  endPoint: string
  appId: string
  /** Secret provider used when WASM signing is disabled */
  getSecret: () => Promise<string>
  apiVersion?: string
  appVersion?: string
  /** Server response code that requires refreshing the signing environment */
  requireChangeSecretCode?: number
  accessTokenExpiredCode?: number
  enableWasm?: boolean
  wasmSignerFilePath?: string
  getWasmSignerUrl?: (signerUrl: string) => Promise<string>
  /** Convert response keys to camelCase locally when server does not */
  camelcase?: boolean
  serverIsSupportCamelcase?: boolean
}

export type IApiClient = {
  /**
   * POST an API method.
   * @param methodName Relative path (`/a/b`) or absolute URL
   * @param data Request parameters
   * @param sign Whether to sign (default true)
   * @param files Optional upload files
   * @param options Extra HTTP options
   */
  post: (
    methodName: string,
    data: unknown,
    sign?: boolean,
    files?: FileInfo[],
    options?: HttpClientOptions,
  ) => Promise<unknown>

  /**
   * GET an API method.
   * @param methodName Relative path (`/a/b`) or absolute URL
   * @param data Query parameters
   * @param sign Whether to sign (default true)
   * @param options Extra HTTP options
   */
  get: (
    methodName: string,
    data: unknown,
    sign?: boolean,
    options?: HttpClientOptions,
  ) => Promise<unknown>

  /** Sign method parameters and return the full parameter bag including system fields. */
  sign: (methodParameters: unknown) => Promise<Record<string, unknown>>

  requestHandler?: (data: object, options?: HttpClientOptions) => Promise<void>
  responseHandler?: (response: unknown) => Promise<void>

  readonly httpClient: IHttpClient
}
