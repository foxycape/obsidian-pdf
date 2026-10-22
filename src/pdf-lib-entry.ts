import * as pdfjsLib from '@foxycape/core/pdfjs/legacy/build/pdf.mjs'
import * as pdfjsViewer from '@/reader/foxycapePdfViewer'
import {
  FOXYCAPE_PDFJS_LIB_GLOBAL,
  FOXYCAPE_PDFJS_VIEWER_GLOBAL,
} from '@/reader/pdfjsGlobalNames'

const runtime = globalThis as typeof globalThis & Record<string, object | undefined>

runtime[FOXYCAPE_PDFJS_LIB_GLOBAL] = pdfjsLib
runtime[FOXYCAPE_PDFJS_VIEWER_GLOBAL] = pdfjsViewer

export default pdfjsLib
