import type { IDevice } from '@foxycape/core/kernal'
import { WebBrowser } from '@foxycape/core/kernal'
import {
  ApiClient,
  type ApiSettings,
  type IApiClient,
} from '@/network'
import type { Plugin } from 'obsidian'
import { API_ENDPOINT } from '@/license/constants'
import { ObsidianHttpClient } from './ObsidianHttpClient'

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
  _plugin: Plugin,
  config: PluginApiConfig = {},
): PluginApiContext => {
  const device: IDevice = new WebBrowser()
  const apiSettings: ApiSettings = {
    endPoint: config.endPoint ?? API_ENDPOINT,
    appId: config.appId ?? '20',
    appVersion: config.appVersion ?? '1.0.0',
    getSecret: config.getSecret ?? (async () => ''),
    apiVersion: '1.0',
    camelcase: true,
    serverIsSupportCamelcase: true,
  }
  return {
    apiClient: new ApiClient(new ObsidianHttpClient(), device, apiSettings),
    device,
  }
}
