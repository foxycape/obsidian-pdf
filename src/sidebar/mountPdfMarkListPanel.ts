import { createApp, h, markRaw, reactive, type App } from 'vue'
import type { IMarker, Reader } from '@core/kernal'
import { injectToolbarIcons } from '@/chrome/mark/injectToolbarIcons'
import PdfMarkListPanel from './PdfMarkListPanel.vue'

export type PdfMarkListPanelMount = {
  setOpen: (open: boolean) => void
  updateSession: (reader: Reader, getMarker: () => IMarker | undefined) => void
  dispose: () => void
}

type PanelState = {
  reader: Reader
  getMarker: () => IMarker | undefined
  open: boolean
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
  onClose: () => void
}

export const mountPdfMarkListPanel = (options: {
  hostEl: HTMLElement
  reader: Reader
  getMarker: () => IMarker | undefined
  open: boolean
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
  onClose: () => void
}): PdfMarkListPanelMount => {
  injectToolbarIcons(options.hostEl.ownerDocument)

  const state = reactive<PanelState>({
    reader: markRaw(options.reader),
    getMarker: options.getMarker,
    open: options.open,
    t: options.t,
    onClose: options.onClose,
  })

  const app: App = createApp({
    setup: () => () =>
      h(PdfMarkListPanel, {
        reader: state.reader as Reader,
        getMarker: state.getMarker,
        open: state.open,
        t: state.t,
        onClose: state.onClose,
      } as any),
  })
  app.mount(options.hostEl)

  return {
    setOpen: (open: boolean) => {
      state.open = open
    },
    updateSession: (reader: Reader, getMarker: () => IMarker | undefined) => {
      state.reader = markRaw(reader)
      state.getMarker = getMarker
    },
    dispose: () => {
      app.unmount()
      options.hostEl.empty()
    },
  }
}
