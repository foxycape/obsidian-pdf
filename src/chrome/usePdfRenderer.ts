import type { Reader } from '@foxycape/core/kernal'
import type { CustomPdfRenderer } from '@/reader/mediaTypes/pdf/CustomPdfRenderer'

export const getCustomPdfRenderer = (reader: Reader | null | undefined) => {
  const renderer = reader?.getRenderer?.() as CustomPdfRenderer | null | undefined
  return renderer ?? null
}

/** Alias: Obsidian PDF always uses CustomPdfRenderer. */
export const getPdfRenderer = getCustomPdfRenderer
