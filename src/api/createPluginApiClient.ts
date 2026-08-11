import type { IDevice } from '@foxycape/core/kernal'
import { WebBrowser, WebEnvironment, WebPlatform } from '@foxycape/core/kernal'
import { WebCrypto } from '@foxycape/core/kernal/crypto/WebCrypto'
import {
  ApiClient,
  type ApiSettings,
  type IApiClient,
} from '@/network'
import type { Plugin } from 'obsidian'
import { API_ENDPOINT } from '@/license/constants'
import { ObsidianHttpClient } from './ObsidianHttpClient'
import { resolveWasmSignerUrl, WASM_SIGNER_RELATIVE } from './resolveWasmSignerUrl'

export type PluginApiConfig = {
  endPoint?: string
  appId?: string
  appVersion?: string
  getSecret?: () => Promise<string>
}

export type PluginApiContext = {
  apiClient: IApiClient
  device: IDevice
}

/** Build the shared {@link IApiClient} + {@link IDevice} used by the Obsidian PDF plugin. */
export const createPluginApiClient = (
  plugin: Plugin,
  config: PluginApiConfig = {},
): PluginApiContext => {
  const device: IDevice = new WebBrowser(new WebPlatform(), new WebEnvironment())
  const apiSettings: ApiSettings = {
    endPoint: config.endPoint ?? API_ENDPOINT,
    appId: config.appId ?? 'foxycape-pdf',
    appVersion: config.appVersion ?? '1.0.0',
    getSecret: config.getSecret ?? (async () => ''),
    apiVersion: '1.0',
    camelcase: true,
    serverIsSupportCamelcase: true,
    enableWasm: true,
    wasmSignerFilePath: WASM_SIGNER_RELATIVE,
    getWasmSignerUrl: async () => resolveWasmSignerUrl(plugin),
  }
  return {
    apiClient: new ApiClient(
      new ObsidianHttpClient(),
      device,
      new WebCrypto(),
      apiSettings,
    ),
    device,
  }
}
