import { EventNames } from '@foxycape/core/kernal/EventNames'
import { Theme } from '@foxycape/core/kernal/Theme'
import type { IPdfRenderer } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfRenderer'

/** Temporary flash when navigating to a mark / deep-link rect. */
export const PDF_GOTO_ANIMATION_CLASS = 'foxycape-pdf-goto-animation'
export const PDF_GOTO_ANIMATION_MS = 2000
export const PDF_GOTO_STYLE_ELEMENT_ID = 'foxycape-pdf-goto-animation-styles'

const KEYFRAMES_NAME = 'foxycape-pdf-goto-bg'

export const injectGotoAnimationStyles = (doc: Document): void => {
  if (doc.getElementById(PDF_GOTO_STYLE_ELEMENT_ID)) {
    return
  }
  const style = doc.head.createEl('style')
  style.id = PDF_GOTO_STYLE_ELEMENT_ID
  // Match legacy HtmlThemeApplier `bg` keyframes: transparent → highlight → transparent (2s).
  style.textContent = `
@keyframes ${KEYFRAMES_NAME} {
  0% { background-color: transparent; background-image: none; }
  50% { background-color: var(${Theme.GotoTargetAnimationColor}, rgba(255,150,50,0.2)); background-image: none; }
  100% { background-color: transparent; background-image: none; }
}
.${PDF_GOTO_ANIMATION_CLASS} {
  animation: ${KEYFRAMES_NAME} ${PDF_GOTO_ANIMATION_MS}ms ease-in-out !important;
  border-color: transparent !important;
}
`
}

export type PlayGotoHighlightOptions = {
  /** When true, remove the overlay nodes after the flash (deep-link selection fallback). */
  removeElements?: boolean
}

type PageRenderedPayload = {
  pageNumber?: number
}

const isPageReadyForGeometry = (renderer: IPdfRenderer, pageNumber: number): boolean => {
  const pageView = renderer.getPageView(pageNumber) as
    | { div?: HTMLElement; renderingState?: number }
    | undefined
  const pageEl = pageView?.div
  if (!pageEl || pageEl.clientWidth <= 0 || pageEl.clientHeight <= 0) {
    return false
  }
  // pdf.js sets data-loaded once the canvas/page content is present.
  if (pageEl.getAttribute('data-loaded') === 'true') {
    return true
  }
  // renderingState === 3 means FINISHED in pdf.js UI utils.
  return pageView?.renderingState === 3
}

/**
 * Resolve when the page canvas/layout is ready for geometry overlays.
 * Does not wait for the text layer.
 */
export const waitForPageRendered = (
  renderer: IPdfRenderer,
  pageNumber: number,
  timeoutMs = 2500,
): Promise<void> => {
  if (isPageReadyForGeometry(renderer, pageNumber)) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) {
        return
      }
      settled = true
      renderer.owner.events.off(EventNames.PdfPageRendered, onRendered)
      window.clearTimeout(timer)
      resolve()
    }

    const onRendered = (payload: PageRenderedPayload) => {
      if (payload?.pageNumber === pageNumber) {
        finish()
      }
    }

    renderer.owner.events.on(EventNames.PdfPageRendered, onRendered)
    const timer = window.setTimeout(finish, timeoutMs)

    // Race: page may finish between the initial check and listener attach.
    if (isPageReadyForGeometry(renderer, pageNumber)) {
      finish()
    }
  })
}

/**
 * Flash rectangle overlays with a 2s background highlight, then clear.
 * Does not use IDocument.setAnimation — geometry masks are plain divs.
 */
export const playGotoHighlightAnimation = (
  elements: Array<Element | null | undefined>,
  options?: PlayGotoHighlightOptions,
): void => {
  const nodes = elements.filter((el): el is HTMLElement => !!el && el.instanceOf(HTMLElement))
  if (nodes.length === 0) {
    return
  }

  const doc = nodes[0].ownerDocument
  injectGotoAnimationStyles(doc)

  // Drop any in-flight goto flash so a new navigation restarts cleanly.
  doc.querySelectorAll(`.${PDF_GOTO_ANIMATION_CLASS}`).forEach((el) => {
    el.classList.remove(PDF_GOTO_ANIMATION_CLASS)
  })

  for (const el of nodes) {
    el.classList.add(PDF_GOTO_ANIMATION_CLASS)
  }

  window.setTimeout(() => {
    for (const el of nodes) {
      if (!el.isConnected) {
        continue
      }
      if (options?.removeElements) {
        el.remove()
      } else {
        el.classList.remove(PDF_GOTO_ANIMATION_CLASS)
      }
    }
  }, PDF_GOTO_ANIMATION_MS)
}
