import { createApp, h, markRaw, type App } from 'vue'
import type { IMarker, Reader } from '@foxycape/core/kernal'
import { injectToolbarIcons } from './injectToolbarIcons'
import PdfMarkToolbar from './PdfMarkToolbar.vue'
import type { PdfMarkToolbarLinkSource } from './usePdfMarkToolbar'

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
  getLinkSource?: () => PdfMarkToolbarLinkSource | null
  ensureEntitled?: () => boolean
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
        getLinkSource: options.getLinkSource,
        ensureEntitled: options.ensureEntitled,
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
