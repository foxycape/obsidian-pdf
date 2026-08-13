import type { CssRect } from './screenshotGeometry'
import {
  layoutStitchRows,
  mapClientRectToCanvasPixels,
  mapPageCssRectToCanvasPixels,
  type PageBoxLike,
} from './screenshotGeometry'

export const cropCanvasRegion = (
  source: HTMLCanvasElement,
  region: CssRect,
): HTMLCanvasElement | null => {
  const x = Math.max(0, Math.floor(region.x))
  const y = Math.max(0, Math.floor(region.y))
  const width = Math.max(0, Math.min(Math.floor(region.width), source.width - x))
  const height = Math.max(0, Math.min(Math.floor(region.height), source.height - y))
  if (width < 1 || height < 1) {
    return null
  }
  const out = createEl('canvas')
  out.detach()
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  if (!ctx) {
    return null
  }
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height)
  return out
}

export const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to encode screenshot'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })

export const cropPageCanvas = (
  canvas: HTMLCanvasElement,
  cssRect: CssRect,
  pageEl: PageBoxLike,
): HTMLCanvasElement | null => {
  const region = mapPageCssRectToCanvasPixels(cssRect, pageEl, canvas)
  if (!region) {
    return null
  }
  return cropCanvasRegion(canvas, region)
}

export type PageCanvasSource = {
  pageNumber: number
  canvas: HTMLCanvasElement
}

export type CroppedPagePiece = {
  pageNumber: number
  canvas: HTMLCanvasElement
  x: number
  y: number
}

/** Crop every page canvas that intersects a viewport-space rect. Gaps are dropped. */
export const cropPagesInClientRect = (
  pages: PageCanvasSource[],
  clientRect: CssRect,
): CroppedPagePiece[] => {
  const pieces: CroppedPagePiece[] = []
  for (const page of pages) {
    const region = mapClientRectToCanvasPixels(clientRect, page.canvas)
    if (!region) {
      continue
    }
    const cropped = cropCanvasRegion(page.canvas, region)
    if (!cropped) {
      continue
    }
    const canvasBox = page.canvas.getBoundingClientRect()
    const scaleX = page.canvas.width / canvasBox.width
    const scaleY = page.canvas.height / canvasBox.height
    pieces.push({
      pageNumber: page.pageNumber,
      canvas: cropped,
      x: canvasBox.left + region.x / scaleX,
      y: canvasBox.top + region.y / scaleY,
    })
  }
  return pieces
}

export const stitchScreenshotPieces = (
  pieces: CroppedPagePiece[],
): HTMLCanvasElement | null => {
  if (pieces.length === 0) {
    return null
  }
  if (pieces.length === 1) {
    return pieces[0].canvas
  }
  const rows = layoutStitchRows(pieces)
  const rowCanvases: HTMLCanvasElement[] = []
  for (const row of rows) {
    const rowWidth = row.reduce((sum, piece) => sum + piece.canvas.width, 0)
    const rowHeight = row.reduce((max, piece) => Math.max(max, piece.canvas.height), 0)
    if (rowWidth < 1 || rowHeight < 1) {
      continue
    }
    if (row.length === 1) {
      rowCanvases.push(row[0].canvas)
      continue
    }
    const rowCanvas = createEl('canvas')
    rowCanvas.detach()
    rowCanvas.width = rowWidth
    rowCanvas.height = rowHeight
    const ctx = rowCanvas.getContext('2d')
    if (!ctx) {
      continue
    }
    let x = 0
    for (const piece of row) {
      ctx.drawImage(piece.canvas, x, 0)
      x += piece.canvas.width
    }
    rowCanvases.push(rowCanvas)
  }
  if (rowCanvases.length === 0) {
    return null
  }
  if (rowCanvases.length === 1) {
    return rowCanvases[0]
  }
  const width = rowCanvases.reduce((max, canvas) => Math.max(max, canvas.width), 0)
  const height = rowCanvases.reduce((sum, canvas) => sum + canvas.height, 0)
  const out = createEl('canvas')
  out.detach()
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  if (!ctx) {
    return null
  }
  let y = 0
  for (const rowCanvas of rowCanvases) {
    ctx.drawImage(rowCanvas, 0, y)
    y += rowCanvas.height
  }
  return out
}
