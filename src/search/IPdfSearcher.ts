import type { IDisposable } from '@core/kernal'
import type {
  PdfSearchMatch,
  PdfSearchMatchOptions,
  PdfSearchRequest,
  PdfSearchResult,
} from './types'

export type IPdfSearcher = IDisposable & {
  search(request: PdfSearchRequest): Promise<PdfSearchResult>
  getResult(): PdfSearchResult
  getOptions(): PdfSearchMatchOptions
  setOptions(options: Partial<PdfSearchMatchOptions>): void
  goto(item: PdfSearchMatch): Promise<void>
  gotoNext(): Promise<void>
  gotoPrevious(): Promise<void>
  highlightActive(itemIdOrIndex: string | number, scrollIntoView?: boolean): Promise<void>
  ensureShowText(item: PdfSearchMatch): Promise<string>
  removeAll(reset: boolean): Promise<void>
}
