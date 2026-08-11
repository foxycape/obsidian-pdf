import type { Reader } from '@core/kernal'

export type PdfViewChromeProps = {
  reader: Reader
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string
  sidebarOpen: boolean
  onToggleSidebar: () => void
  navTarget: string | HTMLElement
  pageTarget: string | HTMLElement
  zoomTarget: string | HTMLElement
}

export type PdfScaleOption = {
  label: string
  value: string
}

export const PDF_SCALE_VALUES = [
  'auto',
  'page-width',
  '0.5',
  '0.75',
  '1',
  '1.5',
  '2',
  '3',
] as const
