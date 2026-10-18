import { createApp, h, markRaw, type App } from 'vue'
import type { Reader } from '@foxycape/core/kernal'
import type { IMarker } from '@/mark'
import type { IHttpClient } from '@foxycape/core/kernal/network/IHttpClient'
import type { DexieStorage } from '@/storage/DexieStorage'
import type { IStorage } from '@/storage/IStorage'
import { injectToolbarIcons } from './injectToolbarIcons'
import PdfMarkToolbar from './PdfMarkToolbar.vue'
import type { PdfMarkToolbarLinkSource } from './usePdfMarkToolbar'
import type { ToolbarVisibility } from '@/settings/types'

export type PdfMarkToolbarMount = {
  updateSession: (reader: Reader, getMarker: () => IMarker | undefined) => void
  setPaused: (paused: boolean) => void
  dispose: () => void
}

export const mountPdfMarkToolbar = (options: {
  hostEl: HTMLElement
  reader: Reader
  getMarker: () => IMarker | undefined
  t: (key: string, fallback: string) => string
  storage: IStorage
  passageStorage: DexieStorage
  httpClient: IHttpClient
  getLinkSource?: () => PdfMarkToolbarLinkSource | null
  onOpenAi?: (draft: {
    simpleId: string
    quote: string
    markId: string
    pageNumber?: number
    prompt?: string
    autoSend?: boolean
    displayInput?: string
  }) => void
  onNeedAccess?: (mode: 'need-license' | 'quota') => void
  onOpenModel?: () => void
  onOpenLanguage?: () => void
  onOpenTranslateList?: () => void
  getVisibility: () => ToolbarVisibility
  setVisibility: (next: ToolbarVisibility) => void
}): PdfMarkToolbarMount => {
  const doc = options.hostEl.ownerDocument
  injectToolbarIcons(doc)

  // Attach to document.body so fixed toolbar is never clipped by PDF mount overflow.
  const root = doc.body.createDiv({ cls: 'foxycape-pdf-mark-toolbar-root' })

  let currentReader = markRaw(options.reader)
  let currentGetMarker = options.getMarker

  const app: App = createApp({
    setup: () => () =>
      h(PdfMarkToolbar, {
        reader: currentReader,
        getMarker: currentGetMarker,
        hostEl: options.hostEl,
        t: options.t,
        storage: options.storage,
        passageStorage: options.passageStorage,
        httpClient: options.httpClient,
        getLinkSource: options.getLinkSource,
        onOpenAi: options.onOpenAi,
        onNeedAccess: options.onNeedAccess,
        onOpenModel: options.onOpenModel,
        onOpenLanguage: options.onOpenLanguage,
        onOpenTranslateList: options.onOpenTranslateList,
        getVisibility: options.getVisibility,
        setVisibility: options.setVisibility,
      }),
  })
  app.mount(root)

  return {
    updateSession: (reader: Reader, getMarker: () => IMarker | undefined) => {
      currentReader = markRaw(reader)
      currentGetMarker = getMarker
    },
    setPaused: (paused: boolean) => {
      root.toggleClass('is-paused', paused)
    },
    dispose: () => {
      app.unmount()
      root.remove()
    },
  }
}
