import {
  EventNames,
  Options,
  type PageChangeOptions,
  Reader,
} from '../../kernal'
import { PdfRenderer } from '../../mediaTypes/pdf/renderer/PdfRenderer'
import type { PdfScrollMode, PdfSpreadMode } from '../../mediaTypes/pdf/renderer/layout/IPdfRendererLayout'
import { registerPdfMediaType } from './registerPdfMediaType'

const sampleUrl = new URL('./fixtures/sample.pdf', import.meta.url).href

const readerRoot = document.querySelector<HTMLElement>('#reader-root')
const statusEl = document.querySelector<HTMLElement>('#status')
const btnSample = document.querySelector<HTMLButtonElement>('#btn-sample')
const btnReload = document.querySelector<HTMLButtonElement>('#btn-reload')
const fileInput = document.querySelector<HTMLInputElement>('#file-input')
const btnScrollVertical = document.querySelector<HTMLButtonElement>('#btn-scroll-vertical')
const btnScrollHorizontal = document.querySelector<HTMLButtonElement>('#btn-scroll-horizontal')
const btnSpreadSingle = document.querySelector<HTMLButtonElement>('#btn-spread-single')
const btnSpreadDouble = document.querySelector<HTMLButtonElement>('#btn-spread-double')
const btnSpreadBook = document.querySelector<HTMLButtonElement>('#btn-spread-book')
const selectZoom = document.querySelector<HTMLSelectElement>('#select-zoom')
const btnZoomIn = document.querySelector<HTMLButtonElement>('#btn-zoom-in')
const btnZoomOut = document.querySelector<HTMLButtonElement>('#btn-zoom-out')
const btnZoomReset = document.querySelector<HTMLButtonElement>('#btn-zoom-reset')
const btnPagePrev = document.querySelector<HTMLButtonElement>('#btn-page-prev')
const btnPageNext = document.querySelector<HTMLButtonElement>('#btn-page-next')
const inputPage = document.querySelector<HTMLInputElement>('#input-page')
const pageTotalEl = document.querySelector<HTMLElement>('#page-total')
const btnRotateLeft = document.querySelector<HTMLButtonElement>('#btn-rotate-left')
const btnRotateRight = document.querySelector<HTMLButtonElement>('#btn-rotate-right')

if (
  !readerRoot ||
  !statusEl ||
  !btnSample ||
  !btnReload ||
  !fileInput ||
  !btnScrollVertical ||
  !btnScrollHorizontal ||
  !btnSpreadSingle ||
  !btnSpreadDouble ||
  !btnSpreadBook ||
  !selectZoom ||
  !btnZoomIn ||
  !btnZoomOut ||
  !btnZoomReset ||
  !btnPagePrev ||
  !btnPageNext ||
  !inputPage ||
  !pageTotalEl ||
  !btnRotateLeft ||
  !btnRotateRight
) {
  throw new Error('sample page DOM is incomplete')
}

type OpenTarget = {
  label: string
  source: Blob | ArrayBuffer
  extension: string
}

const options = new Options()
options.debug = true
options.enableFooter=false
options.enableHeader=false

const reader = new Reader(options)

const pdfOptions = registerPdfMediaType(reader)

// Host UI only needs to handle RequirePdfPassword (PdfFileParser emits it).
reader.events.on(
  EventNames.RequirePdfPassword,
  async (
    callback: (password: string | Error) => Promise<void> | void,
    reason: string,
    _reasonType: number,
  ) => {
    const password = window.prompt(reason)
    if (password == null) {
      await callback(new Error('password cancelled'))
      return
    }
    await callback(password)
  },
)

let lastTarget: OpenTarget | null = null
let currentScrollMode: PdfScrollMode = 'vertical'
let currentSpreadMode: PdfSpreadMode = 'single'

const getPdfRenderer = () => {
  const renderer = reader.getRenderer()
  return renderer instanceof PdfRenderer ? renderer : null
}

const setStatus = (text: string, kind: 'ok' | 'error' | '' = '') => {
  statusEl.textContent = text
  statusEl.classList.remove('ok', 'error')
  if (kind) {
    statusEl.classList.add(kind)
  }
}

const setBusy = (isBusy: boolean) => {
  const controls = [
    btnSample,
    btnReload,
    fileInput,
    btnScrollVertical,
    btnScrollHorizontal,
    btnSpreadSingle,
    btnSpreadDouble,
    btnSpreadBook,
    selectZoom,
    btnZoomIn,
    btnZoomOut,
    btnZoomReset,
    btnPagePrev,
    btnPageNext,
    inputPage,
    btnRotateLeft,
    btnRotateRight,
  ] as const
  for (const el of controls) {
    el.disabled = isBusy
  }
  btnReload.disabled = isBusy || !lastTarget
}

const syncScrollButtons = () => {
  btnScrollVertical.classList.toggle('active', currentScrollMode === 'vertical')
  btnScrollHorizontal.classList.toggle('active', currentScrollMode === 'horizontal')
}

const syncSpreadButtons = () => {
  btnSpreadSingle.classList.toggle('active', currentSpreadMode === 'single')
  btnSpreadDouble.classList.toggle('active', currentSpreadMode === 'double')
  btnSpreadBook.classList.toggle('active', currentSpreadMode === 'doubleBook')
}

const syncPageInfo = () => {
  const renderer = getPdfRenderer()
  if (!renderer) {
    inputPage.value = '1'
    pageTotalEl.textContent = '/ -'
    return
  }
  const current = renderer.currentPage || 1
  const total = renderer.numberOfPages || 0
  inputPage.value = String(current)
  inputPage.max = String(Math.max(total, 1))
  pageTotalEl.textContent = `/ ${total || '-'}`
}

const CUSTOM_ZOOM_OPTION_ATTR = 'data-custom-zoom'

const parseScaleNumber = (value: string): number | null => {
  if (value.endsWith('%')) {
    const percent = Number.parseFloat(value)
    return Number.isFinite(percent) && percent > 0 ? percent / 100 : null
  }
  const scale = Number.parseFloat(value)
  return Number.isFinite(scale) && scale > 0 ? scale : null
}

const syncZoomSelect = () => {
  const renderer = getPdfRenderer()
  const value = renderer?.scalable.currentScaleValue || pdfOptions.scaleValue || 'auto'
  const currentScale =
    parseScaleNumber(value) ?? (renderer ? renderer.scalable.currentScale : null)
  const predefined = Array.from(selectZoom.options).find((option) => {
    if (option.hasAttribute(CUSTOM_ZOOM_OPTION_ATTR)) {
      return false
    }
    if (option.value === value) {
      return true
    }
    const optionScale = parseScaleNumber(option.value)
    return (
      optionScale != null &&
      currentScale != null &&
      Math.abs(optionScale - currentScale) < 1e-6
    )
  })
  const customOption = selectZoom.querySelector<HTMLOptionElement>(
    `option[${CUSTOM_ZOOM_OPTION_ATTR}]`,
  )

  if (predefined) {
    customOption?.remove()
    selectZoom.value = predefined.value
    return
  }

  const percentLabel =
    value.endsWith('%')
      ? value
      : currentScale != null
        ? `${Math.round(currentScale * 100)}%`
        : value

  let option = customOption
  if (!option) {
    option = document.createElement('option')
    option.setAttribute(CUSTOM_ZOOM_OPTION_ATTR, 'true')
    selectZoom.insertBefore(option, selectZoom.firstChild)
  }
  option.value = currentScale != null ? String(currentScale) : percentLabel
  option.textContent = percentLabel
  selectZoom.value = option.value
}

const resolveExtension = (nameOrUrl: string, fallback = '.pdf') => {
  const match = /\.pdf$/i.exec(nameOrUrl)
  return match ? '.pdf' : fallback
}

const openTarget = async (target: OpenTarget) => {
  setBusy(true)
  setStatus(`Loading: ${target.label}`)
  try {
    await reader.open(target.source, readerRoot, readerRoot, {
      extension: target.extension,
      fileName: target.label,
    })
    lastTarget = target
    const renderer = getPdfRenderer()
    const total = renderer?.numberOfPages ?? 0
    setStatus(
      `Loaded: ${target.label} (pages ${total}, scroll=${currentScrollMode}, spread=${currentSpreadMode})`,
      'ok',
    )
    syncPageInfo()
    syncZoomSelect()
    syncScrollButtons()
    syncSpreadButtons()
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : String(error)
    setStatus(`Load failed: ${message}`, 'error')
  } finally {
    setBusy(false)
  }
}

const loadSample = async () => {
  const response = await fetch(sampleUrl)
  if (!response.ok) {
    throw new Error(`Failed to read sample file: ${response.status} ${response.statusText}`)
  }
  const source = await response.blob()
  await openTarget({
    label: 'fixtures/sample.pdf',
    source,
    extension: '.pdf',
  })
}

const changeScrollMode = (scrollMode: PdfScrollMode) => {
  if (currentScrollMode === scrollMode) {
    return
  }
  currentScrollMode = scrollMode
  const renderer = getPdfRenderer()
  if (!renderer) {
    syncScrollButtons()
    setStatus(`Scroll set to ${scrollMode} (takes effect on next load)`)
    return
  }
  renderer.layout.changeScrollMode(scrollMode)
  syncScrollButtons()
  setStatus(`Scroll direction switched to ${scrollMode}`, 'ok')
}

const changeSpreadMode = (spreadMode: PdfSpreadMode) => {
  if (currentSpreadMode === spreadMode) {
    return
  }
  currentSpreadMode = spreadMode
  const renderer = getPdfRenderer()
  if (!renderer) {
    syncSpreadButtons()
    setStatus(`Spread set to ${spreadMode} (takes effect on next load)`)
    return
  }
  renderer.layout.changeSpreadMode(spreadMode)
  syncSpreadButtons()
  setStatus(`Spread mode switched to ${spreadMode}`, 'ok')
}

const changeZoom = async (value: string) => {
  const renderer = getPdfRenderer()
  if (!renderer) {
    pdfOptions.scaleValue = value
    setStatus(`Zoom set to ${value} (takes effect on next load)`)
    return
  }
  setBusy(true)
  try {
    await renderer.scalable.scaleTo(value)
    syncZoomSelect()
    setStatus(`Zoom switched to ${value}`, 'ok')
  } catch (error) {
    console.error(error)
    setStatus(`Zoom failed: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    setBusy(false)
  }
}

const zoomBy = async (action: 'in' | 'out' | 'reset') => {
  const renderer = getPdfRenderer()
  if (!renderer) {
    setStatus('Reader is not ready. Load a document first.', 'error')
    return
  }
  setBusy(true)
  try {
    if (action === 'in') {
      await renderer.scalable.zoomIn()
    } else if (action === 'out') {
      await renderer.scalable.zoomOut()
    } else {
      await renderer.scalable.zoomReset()
    }
    syncZoomSelect()
    setStatus(
      `Current zoom: ${renderer.scalable.currentScaleValue || `${Math.round(renderer.scalable.currentScale * 100)}%`}`,
      'ok',
    )
  } catch (error) {
    console.error(error)
    setStatus(`Zoom failed: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    setBusy(false)
  }
}

const gotoRelativePage = async (direction: 'prev' | 'next') => {
  const renderer = getPdfRenderer()
  if (!renderer?.pagingNavigator) {
    setStatus('Reader is not ready. Load a document first.', 'error')
    return
  }
  setBusy(true)
  try {
    const ok =
      direction === 'prev'
        ? await renderer.pagingNavigator.gotoPreviousPage()
        : await renderer.pagingNavigator.gotoNextPage()
    syncPageInfo()
    if (ok) {
      setStatus(`Current page: ${renderer.currentPage} / ${renderer.numberOfPages}`, 'ok')
    }
  } catch (error) {
    console.error(error)
    setStatus(`Page turn failed: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    setBusy(false)
  }
}

const gotoPageNumber = async () => {
  const renderer = getPdfRenderer()
  if (!renderer?.pagingNavigator) {
    setStatus('Reader is not ready. Load a document first.', 'error')
    return
  }
  const pageNumber = Number(inputPage.value)
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    setStatus('Enter a valid page number', 'error')
    syncPageInfo()
    return
  }
  setBusy(true)
  try {
    const doc = renderer.getDocuments()[0]
    if (!doc) {
      setStatus('Document is not ready', 'error')
      return
    }
    await renderer.pagingNavigator.gotoPage(doc, pageNumber)
    syncPageInfo()
    setStatus(`Jumped to page ${renderer.currentPage}`, 'ok')
  } catch (error) {
    console.error(error)
    setStatus(`Jump failed: ${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    setBusy(false)
  }
}

const rotatePages = (delta: number) => {
  const renderer = getPdfRenderer()
  if (!renderer) {
    setStatus('Reader is not ready. Load a document first.', 'error')
    return
  }
  renderer.layout.rotatePages(delta)
  setStatus(`Rotated ${delta > 0 ? 'right' : 'left'} 90°`, 'ok')
}

btnSample.addEventListener('click', () => {
  void loadSample()
})

btnReload.addEventListener('click', () => {
  if (!lastTarget) {
    return
  }
  void openTarget(lastTarget)
})

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (!file) {
    return
  }
  void openTarget({
    label: file.name,
    source: file,
    extension: resolveExtension(file.name),
  }).finally(() => {
    fileInput.value = ''
  })
})

btnScrollVertical.addEventListener('click', () => {
  changeScrollMode('vertical')
})

btnScrollHorizontal.addEventListener('click', () => {
  changeScrollMode('horizontal')
})

btnSpreadSingle.addEventListener('click', () => {
  changeSpreadMode('single')
})

btnSpreadDouble.addEventListener('click', () => {
  changeSpreadMode('double')
})

btnSpreadBook.addEventListener('click', () => {
  changeSpreadMode('doubleBook')
})

selectZoom.addEventListener('change', () => {
  void changeZoom(selectZoom.value)
})

btnZoomIn.addEventListener('click', () => {
  void zoomBy('in')
})

btnZoomOut.addEventListener('click', () => {
  void zoomBy('out')
})

btnZoomReset.addEventListener('click', () => {
  void zoomBy('reset')
})

btnPagePrev.addEventListener('click', () => {
  void gotoRelativePage('prev')
})

btnPageNext.addEventListener('click', () => {
  void gotoRelativePage('next')
})

inputPage.addEventListener('change', () => {
  void gotoPageNumber()
})

btnRotateLeft.addEventListener('click', () => {
  rotatePages(-90)
})

btnRotateRight.addEventListener('click', () => {
  rotatePages(90)
})

reader.events.on(EventNames.PageChange, (options: PageChangeOptions) => {
  syncPageInfo()
  if (options.pageNumber != null) {
    const renderer = getPdfRenderer()
    const total = renderer?.numberOfPages || 0
    setStatus(`Current page: ${options.pageNumber} / ${total || '-'}`, 'ok')
  }
})

syncScrollButtons()
syncSpreadButtons()
syncPageInfo()
void loadSample()
