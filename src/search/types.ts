export type PdfSearchMatchOptions = {
  caseSensitive: boolean
  matchDiacritics: boolean
  entireWord: boolean
}

export type PdfSearchRect = {
  x: number
  y: number
  width: number
  height: number
}

export type PdfSearchMatch = {
  id: string
  /** 0-based global index among flattened matches */
  index: number
  /** 1-based page number */
  pageNumber: number
  /** 0-based match index within the page */
  pageMatchIndex: number
  /**
   * Character offset in TextHighlighter / `item.str` join space
   * (same as PDFFindController.pageMatches after getOriginalIndex).
   */
  start: number
  /** Match length in that layer string space */
  length: number
  /** Lazily built HTML snippet for the result list */
  showText?: string
  /** Cached page-content-box rects for overlay painting */
  rects?: PdfSearchRect[]
}

export type PdfSearchResult = {
  keyword: string
  finished: boolean
  total: number
  index: number
  items: PdfSearchMatch[]
}

export type PdfSearchRequest = PdfSearchMatchOptions & {
  query: string
  /** Max matches to keep (default 1000) */
  maxSearchCount?: number
}
