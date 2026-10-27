import {
  EventNames,
  type Reader,
} from '@foxycape/core/kernal'
import {
  copyImage as copyImageToClipboard,
} from '@foxycape/core/kernal/html/image'
import type { IApiClient } from '@/network'
import { AiAccessError } from '@/ai/errors'
import { tryGetAiRuntime } from '@/ai/runtime'
import { requireOcrAccessToken } from '@/ocr/ocrAccess'
import { recognizeOcrRegion, reviewOcrRegion } from '@/ocr/recognizeRegion'
import { collectReviewReference, canvasPixelsToUserRect, type ReviewTextItem } from '@/ocr/reviewContext'
import { canApplyReviewedText } from '@/ocr/reviewNote'
// import { tableHtmlToMarkdown } from '@/ocr/tableHtml'
import type { OcrRegionKind, OcrReviewResult, OcrSheetState, OcrTableMode } from '@/ocr/types'
import { uploadOcrImage } from '@/ocr/uploadOcrImage'
import { Notice } from 'obsidian'
import { nextTick, onBeforeUnmount, reactive, shallowRef, watch } from 'vue'
import { getPdfRenderer } from '@/chrome/usePdfRenderer'
import {
  clearPendingPdfImageRef,
  stagePdfImageRefCopy,
  type PdfImageLinkSource,
} from '@/obsidian/pdfImageRef'
import { buildPdfUserSpaceRectParam } from '@/obsidian/selectionLink'
import {
  canvasToPngBlob,
  cropCanvasRegion,
  cropPagesInClientRect,
  exceedsOcrPageScale,
  mapCropToTargetViewport,
  OCR_PAGE_SCALE,
  stitchScreenshotPieces,
} from '@/screenshot/cropPageCanvas'
import {
  clampRect,
  clientPointToPageCss,
  getPageNumberFromEl,
  HANDLE_IDS,
  isRectLargeEnough,
  mapClientRectToCanvasPixels,
  MIN_SCREENSHOT_SIZE,
  normalizeRect,
  ratiosToRect,
  rectToRatios,
  resizeRect,
  type CssRect,
  type RectRatios,
  type ScreenshotHandle,
} from '@/screenshot/screenshotGeometry'
import { placeBesideSelection, type OcrSheetFrame } from '@/screenshot/placeBesideSelection'
import { placeScreenshotMenu } from '@/screenshot/screenshotMenuPlacement'

type PdfViewportLike = {
  width: number
  height: number
}

type PdfPageLike = {
  view?: number[]
  getViewport?: (params: { scale: number }) => PdfViewportLike
  getTextContent?: (options: { disableNormalization: boolean }) => Promise<{ items?: ReviewTextItem[] }>
  render?: (params: {
    canvasContext: CanvasRenderingContext2D
    viewport: PdfViewportLike
  }) => { promise: Promise<void> }
}

type PageViewLike = {
  div?: HTMLElement
  canvas?: HTMLCanvasElement
  pdfPage?: PdfPageLike
}

type DragSession = {
  pointerId: number
  mode: 'create' | ScreenshotHandle
  originRect: CssRect
  start: { x: number; y: number }
}

const isHandleId = (value: string | undefined): value is ScreenshotHandle =>
  !!value && (HANDLE_IDS as readonly string[]).includes(value)

type ScreenshotUiState = {
  active: boolean
  dragging: boolean
  showChrome: boolean
  overlayWidth: number
  overlayHeight: number
  rect: CssRect | null
  menuLeft: number
  menuTop: number
  busy: boolean
  recognizing: OcrRegionKind | null
  reviewing: boolean
  ocrResult: OcrSheetState | null
  sheetFrame: OcrSheetFrame
}

export const usePdfScreenshot = (options: {
  reader: Reader
  hostEl: HTMLElement
  t: (key: string, fallback: string, named?: object) => string
  apiClient: IApiClient
  getLinkSource?: () => PdfImageLinkSource | null
  onActiveChange?: (active: boolean) => void
}) => {
  const state = reactive<ScreenshotUiState>({
    active: false,
    dragging: false,
    showChrome: false,
    overlayWidth: 0,
    overlayHeight: 0,
    rect: null,
    menuLeft: 0,
    menuTop: 0,
    busy: false,
    recognizing: null,
    reviewing: false,
    ocrResult: null,
    sheetFrame: {
      left: null,
      top: null,
      bottom: null,
      maxWidth: 0,
      maxHeight: 0,
    },
  })
  const viewerEl = shallowRef<HTMLElement | null>(null)
  const overlayEl = shallowRef<HTMLElement | null>(null)
  const menuEl = shallowRef<HTMLElement | null>(null)

  let ratios: RectRatios | null = null
  let drag: DragSession | null = null
  let disposed = false
  let requestToken = 0

  const getOwnerDocument = (): Document =>
    options.hostEl.ownerDocument ?? document

  const getPageView = (pageNumber: number): PageViewLike | undefined => {
    return getPdfRenderer(options.reader)?.getPageView(pageNumber)
  }

  const resolveViewerEl = (): HTMLElement | null => {
    return options.hostEl.querySelector<HTMLElement>('.pdfViewer')
  }

  const syncViewer = () => {
    const el = resolveViewerEl()
    viewerEl.value = el
    if (!el) {
      return
    }
    if (el.ownerDocument.defaultView?.getComputedStyle(el).position === 'static') {
      el.classList.add('foxycape-pdf-page--relative')
    }
    state.overlayWidth = el.clientWidth
    state.overlayHeight = el.clientHeight
  }

  const viewerBounds = () => ({
    width: viewerEl.value?.clientWidth || state.overlayWidth,
    height: viewerEl.value?.clientHeight || state.overlayHeight,
  })

  const commitRect = (rect: CssRect) => {
    const bounds = viewerBounds()
    const next = clampRect(rect, bounds)
    state.rect = next
    state.overlayWidth = bounds.width
    state.overlayHeight = bounds.height
    ratios = rectToRatios(next, bounds)
  }

  const clearSelection = () => {
    state.rect = null
    state.showChrome = false
    state.dragging = false
    ratios = null
    drag = null
  }

  const restoreFromRatios = () => {
    if (!state.active || !ratios) {
      return
    }
    syncViewer()
    const bounds = viewerBounds()
    if (!(bounds.width > 0) || !(bounds.height > 0)) {
      return
    }
    state.rect = ratiosToRect(ratios, bounds)
    if (state.showChrome) {
      void updateMenuPosition()
    }
    if (state.ocrResult) {
      updateOcrSheetPosition()
    }
  }

  const overlayPoint = (e: PointerEvent) => {
    const el = overlayEl.value ?? viewerEl.value
    if (!el) {
      return { x: 0, y: 0 }
    }
    return clientPointToPageCss(e.clientX, e.clientY, el)
  }

  const selectionClientRect = (rect: CssRect): CssRect | null => {
    const el = overlayEl.value ?? viewerEl.value
    if (!el) {
      return null
    }
    const box = el.getBoundingClientRect()
    return {
      x: box.left + el.clientLeft + rect.x,
      y: box.top + el.clientTop + rect.y,
      width: rect.width,
      height: rect.height,
    }
  }

  const updateMenuPosition = async () => {
    const rect = state.rect
    if (!state.showChrome || !rect) {
      return
    }
    await nextTick()
    const menu = menuEl.value
    const pos = placeScreenshotMenu({
      selection: {
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      },
      menu: {
        width: menu?.offsetWidth || 120,
        height: menu?.offsetHeight || 44,
      },
      viewport: {
        left: 0,
        top: 0,
        width: state.overlayWidth,
        height: state.overlayHeight,
      },
    })
    state.menuLeft = pos.left
    state.menuTop = pos.top
  }

  const preferredOcrCard = () => {
    const host = options.hostEl
    const view = host.ownerDocument.defaultView
    const fontSize = Number.parseFloat(view?.getComputedStyle(host).fontSize ?? '') || 16
    return {
      width: Math.min(36 * fontSize, Math.max(0, host.clientWidth - 2 * fontSize)),
      height: Math.min(32 * fontSize, host.clientHeight * 0.7),
    }
  }

  const updateOcrSheetPosition = () => {
    const rect = state.rect
    const host = options.hostEl
    if (!state.ocrResult || !rect || host.clientWidth <= 0 || host.clientHeight <= 0) {
      return
    }
    const client = selectionClientRect(rect)
    if (!client) {
      return
    }
    const hostBox = host.getBoundingClientRect()
    const placed = placeBesideSelection({
      selection: {
        left: client.x - hostBox.left - host.clientLeft,
        top: client.y - hostBox.top - host.clientTop,
        width: client.width,
        height: client.height,
      },
      card: preferredOcrCard(),
      viewport: {
        left: 0,
        top: 0,
        width: host.clientWidth,
        height: host.clientHeight,
      },
    })
    state.sheetFrame.left = placed.left
    state.sheetFrame.maxWidth = placed.maxWidth
    state.sheetFrame.maxHeight = placed.maxHeight
    if (placed.placement === 'above') {
      state.sheetFrame.top = null
      state.sheetFrame.bottom = host.clientHeight - (placed.top + placed.maxHeight)
      return
    }
    state.sheetFrame.top = placed.top
    state.sheetFrame.bottom = null
  }

  const resolveScrollParent = (start: HTMLElement | null): HTMLElement | null => {
    const view = start?.ownerDocument.defaultView
    let node = start?.parentElement ?? null
    while (node && view) {
      const style = view.getComputedStyle(node)
      const overflowY = style.overflowY
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
        return node
      }
      if (node === options.hostEl) {
        break
      }
      node = node.parentElement
    }
    return null
  }

  let sheetScrollTarget: HTMLElement | null = null
  let sheetResizeObserver: ResizeObserver | null = null

  const onSheetLayout = () => {
    updateOcrSheetPosition()
  }

  const unbindOcrSheetLayout = () => {
    sheetScrollTarget?.removeEventListener('scroll', onSheetLayout)
    sheetScrollTarget = null
    sheetResizeObserver?.disconnect()
    sheetResizeObserver = null
  }

  const bindOcrSheetLayout = () => {
    unbindOcrSheetLayout()
    const scrollParent = resolveScrollParent(viewerEl.value)
    if (scrollParent) {
      sheetScrollTarget = scrollParent
      scrollParent.addEventListener('scroll', onSheetLayout, { passive: true })
    }
    sheetResizeObserver = new ResizeObserver(onSheetLayout)
    sheetResizeObserver.observe(options.hostEl)
  }

  const setActive = (active: boolean) => {
    if (state.active === active) {
      return
    }
    state.active = active
    if (!active) {
      clearSelection()
      state.ocrResult = null
      unbindOcrSheetLayout()
      viewerEl.value = null
    } else {
      state.ocrResult = null
      unbindOcrSheetLayout()
      getOwnerDocument().getSelection()?.removeAllRanges()
      syncViewer()
    }
    options.onActiveChange?.(active)
  }

  const toggle = () => {
    setActive(!state.active)
  }

  const close = () => {
    requestToken += 1
    setActive(false)
  }

  const beginCreate = (point: { x: number; y: number }, pointerId: number) => {
    syncViewer()
    state.dragging = true
    state.showChrome = false
    const origin = { x: point.x, y: point.y, width: 0, height: 0 }
    drag = {
      pointerId,
      mode: 'create',
      originRect: origin,
      start: point,
    }
    commitRect(origin)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (!state.active || state.ocrResult) {
      return
    }
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return
    }
    const target = e.target as Element | null
    if (!target) {
      return
    }
    if (menuEl.value?.contains(target)) {
      return
    }

    const handleEl = target.closest<HTMLElement>('[data-screenshot-handle]')
    if (handleEl && state.rect && isHandleId(handleEl.dataset.screenshotHandle)) {
      e.preventDefault()
      e.stopPropagation()
      state.dragging = true
      state.showChrome = false
      drag = {
        pointerId: e.pointerId,
        mode: handleEl.dataset.screenshotHandle,
        originRect: { ...state.rect },
        start: overlayPoint(e),
      }
      options.hostEl.setPointerCapture(e.pointerId)
      return
    }

    if (target.closest('.foxycape-pdf-crop-rect')) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    if (!viewerEl.value) {
      syncViewer()
    }
    if (!viewerEl.value?.contains(target) && target !== overlayEl.value) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    beginCreate(overlayPoint(e), e.pointerId)
    options.hostEl.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!drag || drag.pointerId !== e.pointerId) {
      return
    }
    e.preventDefault()
    const point = overlayPoint(e)
    const bounds = viewerBounds()
    if (drag.mode === 'create') {
      commitRect(normalizeRect(drag.start.x, drag.start.y, point.x, point.y))
      return
    }
    commitRect(resizeRect(drag.originRect, drag.mode, point, bounds))
  }

  const endDrag = (e: PointerEvent) => {
    if (!drag || drag.pointerId !== e.pointerId) {
      return
    }
    try {
      options.hostEl.releasePointerCapture(e.pointerId)
    } catch {
      // Pointer was already released.
    }
    const rect = state.rect
    drag = null
    state.dragging = false
    if (!rect || !isRectLargeEnough(rect, MIN_SCREENSHOT_SIZE)) {
      clearSelection()
      return
    }
    state.showChrome = true
    void updateMenuPosition()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!state.active || state.ocrResult) {
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  const listPageCanvases = () => {
    const viewer = viewerEl.value
    if (!viewer) {
      return []
    }
    const pages: Array<{ pageNumber: number; canvas: HTMLCanvasElement }> = []
    viewer.querySelectorAll<HTMLElement>('.page').forEach((pageEl) => {
      const pageNumber = getPageNumberFromEl(pageEl)
      if (!pageNumber) {
        return
      }
      const canvas =
        getPageView(pageNumber)?.canvas ??
        pageEl.querySelector('canvas')
      if (!canvas) {
        return
      }
      pages.push({ pageNumber, canvas })
    })
    return pages
  }

  const resolveCroppedCanvas = () => {
    const rect = state.rect
    if (!rect) {
      return null
    }
    const clientRect = selectionClientRect(rect)
    if (!clientRect) {
      return null
    }
    const pieces = cropPagesInClientRect(listPageCanvases(), clientRect)
    return stitchScreenshotPieces(pieces)
  }

  const resolveCanvasRectParam = (): { pageNumber: number; rect?: string } | null => {
    const rect = state.rect
    if (!rect) {
      return null
    }
    const clientRect = selectionClientRect(rect)
    if (!clientRect) {
      return null
    }
    const pages = listPageCanvases()
    for (const page of pages) {
      const pixels = mapClientRectToCanvasPixels(clientRect, page.canvas)
      if (!pixels) {
        continue
      }
      const view = getPageView(page.pageNumber)?.pdfPage?.view
      if (!view || view.length < 4) {
        return { pageNumber: page.pageNumber }
      }
      const pageOriginWidth = view[2]
      const pageOriginHeight = view[3]
      if (typeof pageOriginWidth !== 'number' || typeof pageOriginHeight !== 'number') {
        return { pageNumber: page.pageNumber }
      }
      return {
        pageNumber: page.pageNumber,
        rect: buildPdfUserSpaceRectParam({
          x: pixels.x,
          y: pixels.y,
          width: pixels.width,
          height: pixels.height,
          canvasWidth: page.canvas.width,
          canvasHeight: page.canvas.height,
          pageOriginWidth,
          pageOriginHeight,
        }),
      }
    }
    return null
  }

  const resolveCropPieces = () => {
    const rect = state.rect
    if (!rect) {
      return []
    }
    const clientRect = selectionClientRect(rect)
    if (!clientRect) {
      return []
    }
    return cropPagesInClientRect(listPageCanvases(), clientRect)
  }

  const errorText = (error: unknown): string => {
    if (error instanceof Error && error.message.trim()) {
      return error.message
    }
    return 'OCR'
  }

  const reportOcrError = (error: unknown, during: 'recognize' | 'review' = 'recognize') => {
    if (error instanceof AiAccessError) {
      const runtime = tryGetAiRuntime()
      if (error.code === 'no-ai-token') {
        runtime?.onQuotaExhausted({ officialOnly: true })
      } else {
        runtime?.onNeedLicense({ officialOnly: true })
      }
      return
    }
    const message = errorText(error)
    if (during === 'review') {
      new Notice(options.t('pdf_ocr_review_failed', 'Proofreading failed: {message}', { message }))
      return
    }
    new Notice(options.t('pdf_ocr_failed', 'Recognition failed: {message}', { message }))
  }

  const renderOcrCrop = async (
    pdfPage: PdfPageLike,
    source: HTMLCanvasElement,
    crop: CssRect,
  ): Promise<HTMLCanvasElement | null> => {
    const unit = pdfPage.getViewport?.({ scale: 1 })
    const target = pdfPage.getViewport?.({ scale: OCR_PAGE_SCALE })
    if (!unit || !target || !pdfPage.render) {
      return null
    }
    if (exceedsOcrPageScale(source.width, unit.width)) {
      return null
    }
    const region = mapCropToTargetViewport({
      crop,
      sourceWidth: source.width,
      sourceHeight: source.height,
      targetWidth: target.width,
      targetHeight: target.height,
    })
    if (!region) {
      return null
    }
    const full = (getOwnerDocument().win as Window & {
      createEl<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K]
    }).createEl('canvas')
    full.detach()
    full.width = Math.max(1, Math.ceil(target.width))
    full.height = Math.max(1, Math.ceil(target.height))
    const context = full.getContext('2d')
    if (!context) {
      return null
    }
    await pdfPage.render({ canvasContext: context, viewport: target }).promise
    return cropCanvasRegion(full, region)
  }

  const resolveOcrCanvas = async (
    pageNumber: number,
    fallback: HTMLCanvasElement,
  ): Promise<HTMLCanvasElement> => {
    const pageView = getPageView(pageNumber)
    const source = pageView?.canvas
    const pdfPage = pageView?.pdfPage
    const rect = state.rect
    if (!source || !pdfPage || !rect) {
      return fallback
    }
    const clientRect = selectionClientRect(rect)
    const crop = clientRect ? mapClientRectToCanvasPixels(clientRect, source) : null
    if (!crop) {
      return fallback
    }
    try {
      return (await renderOcrCrop(pdfPage, source, crop)) ?? fallback
    } catch {
      return fallback
    }
  }

  const recognizeRegion = async (kind: OcrRegionKind, tableMode?: OcrTableMode) => {
    if (state.busy || state.reviewing) {
      return
    }
    const pieces = resolveCropPieces()
    if (pieces.length === 0) {
      new Notice(options.t('pdf_ocr_failed', 'Recognition failed: {message}', { message: 'crop' }))
      return
    }
    if (pieces.length !== 1) {
      new Notice(options.t('pdf_ocr_cross_page', 'Select a region on a single page'))
      return
    }
    const fileId = options.reader.context?.id?.trim() ?? ''
    if (!fileId) {
      new Notice(options.t('pdf_ocr_failed', 'Recognition failed: {message}', { message: 'file' }))
      return
    }
    const piece = pieces[0]
    const token = ++requestToken
    state.recognizing = kind
    state.busy = true
    try {
      const canvas = await resolveOcrCanvas(piece.pageNumber, piece.canvas)
      const blob = await canvasToPngBlob(canvas)
      const accessToken = await requireOcrAccessToken(options.apiClient)
      const pageUrl = await uploadOcrImage(
        options.apiClient,
        blob,
        `ocr-p${piece.pageNumber}.png`,
        accessToken,
      )
      const content = await recognizeOcrRegion({
        apiClient: options.apiClient,
        accessToken,
        kind,
        fileId,
        pageNumber: piece.pageNumber,
        pageUrl,
        pageWidth: canvas.width,
        pageHeight: canvas.height,
        tableMode,
      })
      if (disposed || token !== requestToken) {
        return
      }
      if (!content.trim()) {
        new Notice(options.t('pdf_ocr_empty', 'Nothing was recognized'))
        return
      }
      state.showChrome = false
      state.ocrResult = {
        kind,
        fileId,
        pageNumber: piece.pageNumber,
        content,
        reviewNote: null,
      }
      updateOcrSheetPosition()
      bindOcrSheetLayout()
    } catch (error) {
      if (!disposed && token === requestToken) {
        reportOcrError(error)
      }
    } finally {
      state.busy = false
      state.recognizing = null
    }
  }

  const copyOcrResult = async () => {
    const result = state.ocrResult
    if (!result || state.reviewing) {
      return
    }
    const text = result.content
    // const text =
    //   result.kind === 'table' ? tableHtmlToMarkdown(result.content) || result.content : result.content
    try {
      await navigator.clipboard.writeText(text)
      new Notice(options.t('pdf_ocr_copied', 'Copied'))
      dismissOcrResult()
    } catch {
      new Notice(options.t('pdf_ocr_failed', 'Recognition failed: {message}', { message: 'copy' }))
    }
  }

  const reviewExplanation = (review: OcrReviewResult): string => {
    const reason = review.reason.trim()
    if (reason) {
      return reason
    }
    return options.t('pdf_ocr_review_error_reason', 'Proofreading failed')
  }

  const resolveReviewReference = async (pageNumber: number): Promise<string> => {
    const pageView = getPageView(pageNumber)
    const source = pageView?.canvas
    const pdfPage = pageView?.pdfPage
    const rect = state.rect
    if (!source || !pdfPage?.getTextContent || !pdfPage.view || !rect) {
      return ''
    }
    const clientRect = selectionClientRect(rect)
    const pixels = clientRect ? mapClientRectToCanvasPixels(clientRect, source) : null
    if (!pixels) {
      return ''
    }
    const region = canvasPixelsToUserRect(pixels, source.width, source.height, pdfPage.view)
    if (!region) {
      return ''
    }
    try {
      const content = await pdfPage.getTextContent({ disableNormalization: true })
      return collectReviewReference(content.items ?? [], region)
    } catch {
      return ''
    }
  }

  const reviewOcrResult = async () => {
    const result = state.ocrResult
    if (!result || state.reviewing || state.busy) {
      return
    }
    state.ocrResult = { ...result, reviewNote: null }
    state.reviewing = true
    try {
      const accessToken = await requireOcrAccessToken(options.apiClient)
      const referenceText = await resolveReviewReference(result.pageNumber)
      const review = await reviewOcrRegion({
        apiClient: options.apiClient,
        accessToken,
        kind: result.kind,
        fileId: result.fileId,
        pageNumber: result.pageNumber,
        content: result.content,
        referenceText,
      })
      if (disposed) {
        return
      }
      const suggested = review.suggestedText.trim()
      const apply = canApplyReviewedText(review.verdict)
      state.ocrResult = {
        ...result,
        content: apply && suggested ? suggested : result.content,
        reviewNote: {
          ok: apply,
          explanation: apply ? '' : reviewExplanation(review),
        },
      }
    } catch (error) {
      if (!disposed) {
        reportOcrError(error, 'review')
      }
    } finally {
      state.reviewing = false
    }
  }

  const dismissOcrResult = () => {
    if (state.reviewing) {
      return
    }
    close()
  }

  const copyImage = async () => {
    if (state.busy) {
      return
    }
    const cropped = resolveCroppedCanvas()
    if (!cropped) {
      new Notice(options.t('pdf_image_error', 'Image action failed: {message}').replace('{message}', 'copy'))
      return
    }
    state.busy = true
    try {
      clearPendingPdfImageRef()
      await copyImageToClipboard(cropped)
      new Notice(options.t('pdf_image_copied', 'Image copied'))
      close()
    } catch {
      new Notice(options.t('pdf_image_error', 'Image action failed: {message}').replace('{message}', 'copy'))
    } finally {
      state.busy = false
    }
  }

  const copyImageReference = async () => {
    if (state.busy) {
      return
    }
    const linkSource = options.getLinkSource?.() ?? null
    if (!linkSource?.pdfFile) {
      new Notice(options.t('pdf_image_ref_unavailable', 'Unable to create image reference'))
      return
    }
    const cropped = resolveCroppedCanvas()
    const location = resolveCanvasRectParam()
    if (!cropped || !location) {
      new Notice(
        options.t('pdf_image_error', 'Image action failed: {message}').replace('{message}', 'copyReference'),
      )
      return
    }
    state.busy = true
    try {
      const pngBlob = await canvasToPngBlob(cropped)
      await stagePdfImageRefCopy({
        pngBlob,
        pdfFile: linkSource.pdfFile,
        pageNumber: location.pageNumber,
        kind: 'screenshot',
        rect: location.rect,
      })
      new Notice(
        options.t(
          'pdf_image_ref_copied',
          'Image reference copied -- paste into Markdown, then right-click the image to open its PDF location in Foxycape',
        ),
      )
      close()
    } catch {
      new Notice(
        options.t('pdf_image_error', 'Image action failed: {message}').replace('{message}', 'copyReference'),
      )
    } finally {
      state.busy = false
    }
  }

  const onScaleChanging = () => {
    if (!state.active || !ratios) {
      return
    }
    state.dragging = false
    drag = null
  }

  const onPageRendered = () => {
    if (!state.active) {
      return
    }
    restoreFromRatios()
  }

  watch(
    () => state.showChrome,
    (visible) => {
      if (visible) {
        void updateMenuPosition()
      }
    },
  )

  const host = options.hostEl
  host.addEventListener('pointerdown', onPointerDown, true)
  host.addEventListener('pointermove', onPointerMove)
  host.addEventListener('pointerup', endDrag)
  host.addEventListener('pointercancel', endDrag)
  getOwnerDocument().addEventListener('keydown', onKeyDown)

  options.reader.events.on(EventNames.PdfScaleChanging, onScaleChanging)
  options.reader.events.on(EventNames.PdfPageRendered, onPageRendered)

  onBeforeUnmount(() => {
    disposed = true
    unbindOcrSheetLayout()
    host.removeEventListener('pointerdown', onPointerDown, true)
    host.removeEventListener('pointermove', onPointerMove)
    host.removeEventListener('pointerup', endDrag)
    host.removeEventListener('pointercancel', endDrag)
    getOwnerDocument().removeEventListener('keydown', onKeyDown)
    options.reader.events.off(EventNames.PdfScaleChanging, onScaleChanging)
    options.reader.events.off(EventNames.PdfPageRendered, onPageRendered)
    if (state.active) {
      options.onActiveChange?.(false)
    }
  })

  return {
    state,
    viewerEl,
    overlayEl,
    menuEl,
    handles: HANDLE_IDS,
    setActive,
    toggle,
    close,
    copyImage,
    copyImageReference,
    recognizeRegion,
    copyOcrResult,
    reviewOcrResult,
    dismissOcrResult,
    updateMenuPosition,
  }
}
