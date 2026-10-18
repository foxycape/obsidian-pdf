import type { IPdfRenderer } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfRenderer'

export type PdfNavMeta = {
  navUrl?: string
  navTitle?: string
}

export const resolvePdfNavMeta = async (
  renderer: IPdfRenderer | null | undefined,
  pageNumber: number | undefined,
): Promise<PdfNavMeta | undefined> => {
  if (!renderer || !pageNumber || pageNumber < 1) {
    return undefined
  }
  const doc =
    renderer.getDocuments().find((item) => item.pageNumber === pageNumber) ??
    renderer.getDocuments()[0]
  if (!doc) {
    return undefined
  }
  try {
    const navPoint = await renderer.navPointProvider.getNavPoint(doc.url, pageNumber, 'char')
    const navTitle = navPoint?.title?.trim() || undefined
    const navUrl = navPoint?.url?.trim() || undefined
    if (!navTitle && !navUrl) {
      return undefined
    }
    return { navTitle, navUrl }
  } catch {
    return undefined
  }
}
