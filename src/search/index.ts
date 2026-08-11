export type { IPdfSearcher } from './IPdfSearcher'
export { PdfSearcher } from './PdfSearcher'
export {
  PDF_SEARCH_HIT_ACTIVE_CLASS,
  PDF_SEARCH_HIT_CLASS,
  PDF_SEARCH_HIT_ID_ATTR,
  PDF_SEARCH_LAYER_CLASS,
} from './PdfSearchOverlay'
export {
  buildLayerText,
  buildShowTextSnippet,
  buildTextLayerMapping,
  convertMatches,
  resolveMatchRectsFromDom,
} from './matchGeometry'
export type {
  PdfConvertedMatch,
  PdfMatchBoundary,
  PdfTextLayerMapping,
} from './matchGeometry'
export type {
  PdfSearchMatch,
  PdfSearchMatchOptions,
  PdfSearchRect,
  PdfSearchRequest,
  PdfSearchResult,
} from './types'
