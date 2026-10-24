import { createApp, h, ref, type App as VueApp } from 'vue'
import type { Reader } from '@foxycape/core/kernal'
import type { App, TFile } from 'obsidian'
import type { PdfMarkdownLinkSource } from '@/obsidian/remotePdfLink'
import type { IMarker } from '@/mark'
import type { DexieStorage } from '@/storage/DexieStorage'
import AiChrome, { type AiChatDraft } from './AiChrome.vue'

export type { AiChatDraft }

export type AiChatPanelMount = {
  open: (reader: Reader, getMarker: () => IMarker | undefined, draft: AiChatDraft) => void
  isOpen: () => boolean
  openAccess: (mode: 'need-license' | 'quota') => void
  openModel: () => void
  openLanguage: () => void
  close: () => void
  dispose: () => void
}

export const mountAiChatPanel = (options: {
  hostEl: HTMLElement
  storage: DexieStorage
  app: App
  openCitedFile: (file: TFile, subpath?: string) => Promise<void>
  openCitedUrl: (url: string, subpath?: string) => Promise<void>
  getLinkSource?: () => PdfMarkdownLinkSource | null
  t: (key: string, fallback: string, named?: object) => string
  openSettings: () => void
}): AiChatPanelMount => {
  const root = options.hostEl.createDiv({ cls: 'foxycape-pdf-ai-host' })
  const chrome = ref<InstanceType<typeof AiChrome> | null>(null)

  const vueApp: VueApp = createApp({
    setup: () => () =>
      h(AiChrome, {
        ref: chrome,
        storage: options.storage,
        app: options.app,
        openCitedFile: options.openCitedFile,
        openCitedUrl: options.openCitedUrl,
        getLinkSource: options.getLinkSource,
        t: options.t,
        openSettings: options.openSettings,
      }),
  })
  vueApp.mount(root)

  return {
    open: (reader, getMarker, draft) => {
      chrome.value?.openChat(reader, getMarker, draft)
    },
    isOpen: () => chrome.value?.isChatOpen() === true,
    openAccess: (mode) => {
      chrome.value?.openAccess(mode)
    },
    openModel: () => {
      chrome.value?.openModel()
    },
    openLanguage: () => {
      chrome.value?.openLanguage()
    },
    close: () => {
      chrome.value?.close()
    },
    dispose: () => {
      vueApp.unmount()
      root.remove()
    },
  }
}
