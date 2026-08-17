import { createApp, h, markRaw, ref, type App } from 'vue'
import type { Reader } from '@foxycape/core/kernal'
import type { PdfImageLinkSource } from '@/obsidian/pdfImageRef'
import PdfScreenshotOverlay from './PdfScreenshotOverlay.vue'

export type PdfScreenshotMount = {
  toggle: () => void
  setActive: (active: boolean) => void
  isActive: () => boolean
  dispose: () => void
}

type ScreenshotOverlayApi = {
  toggle: () => void
  setActive: (active: boolean) => void
  isActive: () => boolean
}

export const mountPdfScreenshot = (options: {
  viewEl: HTMLElement
  hostEl: HTMLElement
  reader: Reader
  t: (key: string, fallback: string) => string
  getLinkSource?: () => PdfImageLinkSource | null
  onActiveChange?: (active: boolean) => void
}): PdfScreenshotMount => {
  const root = options.viewEl.createDiv({ cls: 'foxycape-pdf-screenshot-root' })
  const overlayRef = ref<ScreenshotOverlayApi | null>(null)

  const app: App = createApp({
    setup: () => () =>
      h(PdfScreenshotOverlay, {
        ref: overlayRef,
        reader: markRaw(options.reader),
        hostEl: options.hostEl,
        t: options.t,
        getLinkSource: options.getLinkSource,
        onActiveChange: options.onActiveChange,
      }),
  })
  app.mount(root)

  return {
    toggle: () => {
      overlayRef.value?.toggle()
    },
    setActive: (active: boolean) => {
      overlayRef.value?.setActive(active)
    },
    isActive: () => overlayRef.value?.isActive() ?? false,
    dispose: () => {
      overlayRef.value?.setActive(false)
      app.unmount()
      root.remove()
    },
  }
}
