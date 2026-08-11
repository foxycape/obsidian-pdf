import { createApp, h, markRaw, reactive, type App } from 'vue'
import type { Reader } from '@core/kernal'
import { PdfSearcher, type IPdfSearcher } from '@/search'
import type { IPdfRenderer } from '@core/mediaTypes/pdf/renderer/IPdfRenderer'
import PdfSearchBar from './PdfSearchBar.vue'
import { getPdfRenderer } from '../usePdfRenderer'

export type PdfSearchBarMount = {
  setOpen: (open: boolean) => void
  toggle: () => void
  updateReader: (reader: Reader) => void
  dispose: () => void
}

type SearchBarState = {
  reader: Reader
  searcher: IPdfSearcher
  open: boolean
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
}

const createSearcher = (reader: Reader): IPdfSearcher => {
  const renderer = getPdfRenderer(reader) as unknown as IPdfRenderer | null
  if (!renderer) {
    throw new Error('PDF renderer is not ready for search.')
  }
  return new PdfSearcher(renderer)
}

export const mountPdfSearchBar = (options: {
  hostEl: HTMLElement
  reader: Reader
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
}): PdfSearchBarMount => {
  // Keep inside the leaf host so the bar only appears in this PDF tab
  // (body-fixed overlays leak across Obsidian workspace leaves).
  const root = options.hostEl.ownerDocument.createElement('div')
  root.className = 'foxycape-pdf-search-root'
  options.hostEl.appendChild(root)

  let searcher = createSearcher(options.reader)
  const state = reactive<SearchBarState>({
    reader: markRaw(options.reader),
    searcher: markRaw(searcher),
    open: false,
    t: options.t,
  })

  const app: App = createApp({
    setup: () => () =>
      h(PdfSearchBar as any, {
        reader: state.reader,
        searcher: state.searcher,
        open: state.open,
        t: state.t,
        'onUpdate:open': (value: boolean) => {
          state.open = value
        },
      }),
  })
  app.mount(root)

  return {
    setOpen: (open: boolean) => {
      state.open = open
    },
    toggle: () => {
      state.open = !state.open
    },
    updateReader: (reader: Reader) => {
      void state.searcher.dispose()
      searcher = createSearcher(reader)
      state.reader = markRaw(reader)
      state.searcher = markRaw(searcher)
      state.open = false
    },
    dispose: () => {
      void state.searcher.dispose()
      app.unmount()
      root.remove()
    },
  }
}
