import {
  EventNames,
  type Reader,
} from '@foxycape/core/kernal'
import {
  copyImage as copyImageToClipboard,
} from '@foxycape/core/kernal/html/image'
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
  cropPagesInClientRect,
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
import { placeScreenshotMenu } from '@/screenshot/screenshotMenuPlacement'

type PageViewLike = {
  div?: HTMLElement
  canvas?: HTMLCanvasElement
  pdfPage?: { view?: number[] }
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
}

export const usePdfScreenshot = (options: {
  reader: Reader
  hostEl: HTMLElement
  t: (key: string, fallback: string) => string
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
  })
  const viewerEl = shallowRef<HTMLElement | null>(null)
  const overlayEl = shallowRef<HTMLElement | null>(null)
  const menuEl = shallowRef<HTMLElement | null>(null)

  let ratios: RectRatios | null = null
  let drag: DragSession | null = null

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

  const setActive = (active: boolean) => {
    if (state.active === active) {
      return
    }
    state.active = active
    if (!active) {
      clearSelection()
      viewerEl.value = null
    } else {
      getOwnerDocument().getSelection()?.removeAllRanges()
      syncViewer()
    }
    options.onActiveChange?.(active)
  }

  const toggle = () => {
    setActive(!state.active)
  }

  const close = () => {
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
    if (!state.active) {
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
    if (!state.active) {
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
    updateMenuPosition,
  }
}
