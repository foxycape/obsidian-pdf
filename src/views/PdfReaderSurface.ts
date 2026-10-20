import type { ItemView, Menu, TFile, ViewStateResult } from 'obsidian'
import type { FoxycapePdfPlugin } from '@/plugin/FoxycapePdfPlugin'

/** Item view that stays in main.js. The PDF session in pdf.js drives it. */
export type PdfReaderSurface = ItemView & {
  plugin: FoxycapePdfPlugin
  file: TFile | null
  sourceUrl: string | null
}

export type PdfReaderSession = {
  onOpen: () => Promise<void>
  onClose: () => Promise<void>
  setState: (state: unknown, result: ViewStateResult) => Promise<void>
  getState: () => { file?: string; url?: string }
  getEphemeralState: () => Record<string, unknown>
  setEphemeralState: (state: unknown) => void
  onPaneMenu: (menu: Menu, source: string) => void
  getDisplayText: () => string
  getIcon: () => string
  requestOpenFind: () => void
  requestToggleScreenshot: () => void
  getReader: () => { context?: { id?: string } } | null
  isMounted: () => boolean
}
