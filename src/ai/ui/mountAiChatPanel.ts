import { createApp, h, ref, type App } from 'vue'
import type { Reader } from '@foxycape/core/kernal'
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
  t: (key: string, fallback: string, named?: object) => string
  openSettings: () => void
}): AiChatPanelMount => {
  const root = options.hostEl.createDiv({ cls: 'foxycape-pdf-ai-host' })
  const chrome = ref<InstanceType<typeof AiChrome> | null>(null)

  const app: App = createApp({
    setup: () => () =>
      h(AiChrome, {
        ref: chrome,
        storage: options.storage,
        t: options.t,
        openSettings: options.openSettings,
      }),
  })
  app.mount(root)

  return {
    open: (reader, getMarker, draft) => {
      chrome.value?.openChat(reader, getMarker, draft)
    },
    isOpen: () => chrome.value?.isChatOpen() ?? false,
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
      app.unmount()
      root.remove()
    },
  }
}
