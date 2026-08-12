import {
  EventNames,
  MARK_COLORS_TABLE,
  type IMarker,
  type IStorage,
  type Mark,
  type MarkStyleName,
  type Reader,
} from '@foxycape/core/kernal'
import { getRange } from '@foxycape/core/kernal/html/selection'
import { MARK_HIGHLIGHT_ID_ATTR } from '@foxycape/core/kernal/mark/MarkConstants'
import { DEFAULT_MARK_COLORS } from '@/marker/PdfMarkConstants'
import {
  buildPdfDeepLinkFragment,
  formatMarkQuoteLine,
  getRangePageNumber,
  rangeToObsidianSelection,
} from '@/obsidian/selectionLink'
import { PdfSelection } from '@foxycape/core/mediaTypes/pdf/shared/selection/PdfSelection'
import type { IPdfSelection } from '@foxycape/core/mediaTypes/pdf/shared/selection/IPdfSelection'
import type { App, TFile } from 'obsidian'
import { nextTick, onBeforeUnmount, reactive, ref, type Ref } from 'vue'
import {
  ALL_MARK_COLORS,
  buildQuickColorList,
  colorListStorageKey,
  insertQuickColor,
  isSameMarkColor,
  normalizeMarkColor,
  PREDEFINE_MARK_COLORS,
  QUICK_MARK_COLOR_COUNT,
} from './markToolbarColors'

export type PdfMarkToolbarLinkSource = {
  app: App
  pdfFile: TFile
}

export type PdfMarkToolbarState = {
  visible: boolean
  left: number
  top: number
  activeStyle: MarkStyleName | ''
  activeColor: string
  /** Style's built-in default color (shown as first swatch) */
  defaultColor: string
  markId: string
  /** Up to 4 quick colors (excludes defaultColor); toolbar total with default = 5 */
  colors: string[]
  showColorPalette: boolean
  /** Hover menu under the copy chevron */
  showCopyMenu: boolean
}

export const usePdfMarkToolbar = (options: {
  reader: Reader
  getMarker: () => IMarker | undefined
  hostEl: Ref<HTMLElement | null>
  t: (key: string, fallback: string) => string
  getLinkSource?: () => PdfMarkToolbarLinkSource | null
  /** Returns false (and may show a notice) when premium actions are blocked. */
  ensureEntitled?: () => boolean
}) => {
  const state = reactive<PdfMarkToolbarState>({
    visible: false,
    left: 0,
    top: 0,
    activeStyle: 'mark_pen',
    activeColor: PREDEFINE_MARK_COLORS[0],
    defaultColor: DEFAULT_MARK_COLORS.mark_pen,
    markId: '',
    colors: [...PREDEFINE_MARK_COLORS].slice(0, QUICK_MARK_COLOR_COUNT),
    showColorPalette: false,
    showCopyMenu: false,
  })

  const toolbarEl = ref<HTMLElement | null>(null)
  let activeRange: Range | null = null
  let isPointerDown = false
  let clickedToolbar = false
  let showTimer: number | null = null
  /**
   * Mark id that was open when pointerdown hid the toolbar.
   * Used so a second click on the same mark toggles the toolbar closed
   * (pointerdown hides ?click would otherwise reopen it).
   */
  let toggleCloseMarkId = ''
  let clearToggleCloseTimer: number | null = null
  /** Last style chosen by user for new selections (survives hide / mark edit) */
  let lastStyle: MarkStyleName = 'mark_pen'
  let pdfTextAssistant: IPdfSelection | null = null

  const getMarker = (): IMarker | undefined => options.getMarker()

  const getPdfTextAssistant = (): IPdfSelection | null => {
    if (pdfTextAssistant) {
      return pdfTextAssistant
    }
    const renderer = options.reader.getRenderer()
    if (!renderer) {
      return null
    }
    pdfTextAssistant = new PdfSelection(renderer)
    return pdfTextAssistant
  }

  const getStorage = async (): Promise<IStorage | undefined> => {
    try {
      return await options.reader.services.get('storage', true)
    } catch {
      return undefined
    }
  }

  const getOwnerDocument = (): Document | null => {
    return (
      options.reader.getRenderer()?.getRendererContainer()?.ownerDocument ??
      options.reader.getRootContainer()?.ownerDocument ??
      options.hostEl.value?.ownerDocument ??
      null
    )
  }

  const styleDefaultColor = (styleName: MarkStyleName) =>
    normalizeMarkColor(DEFAULT_MARK_COLORS[styleName] || PREDEFINE_MARK_COLORS[0])

  const refreshQuickColors = async (
    styleName: MarkStyleName,
    optionsForList?: { currentColor?: string; customColor?: string },
  ) => {
    const defaultColor = styleDefaultColor(styleName)
    state.defaultColor = defaultColor
    const storage = await getStorage()
    const storedList = storage
      ? await storage.get<string[]>(MARK_COLORS_TABLE, colorListStorageKey(styleName))
      : null
    state.colors = buildQuickColorList({
      storedList,
      currentColor: optionsForList?.currentColor,
      customColor: optionsForList?.customColor,
      defaultColor,
    })
  }

  const loadSavedColor = async (styleName: MarkStyleName): Promise<string> => {
    const defaultColor = styleDefaultColor(styleName)
    const storage = await getStorage()
    const saved = storage
      ? await storage.get<string>(MARK_COLORS_TABLE, styleName)
      : undefined
    if (saved) {
      return normalizeMarkColor(saved)
    }
    return defaultColor
  }

  const persistColorChoice = async (styleName: MarkStyleName, color: string) => {
    const normalized = normalizeMarkColor(color)
    const defaultColor = styleDefaultColor(styleName)
    if (isSameMarkColor(normalized, defaultColor)) {
      await refreshQuickColors(styleName, { currentColor: normalized })
    } else {
      state.colors = insertQuickColor(state.colors, normalized, defaultColor)
    }
    const storage = await getStorage()
    if (!storage) {
      return
    }
    await storage.set(MARK_COLORS_TABLE, styleName, normalized)
    await storage.set(
      MARK_COLORS_TABLE,
      colorListStorageKey(styleName),
      [...state.colors],
    )
  }

  const restoreColorsForStyle = async (
    styleName: MarkStyleName,
    preferredColor?: string,
  ) => {
    const defaultColor = styleDefaultColor(styleName)
    state.defaultColor = defaultColor
    if (preferredColor) {
      state.activeColor = normalizeMarkColor(preferredColor)
    } else {
      state.activeColor = await loadSavedColor(styleName)
    }
    await refreshQuickColors(styleName, {
      currentColor: state.activeColor,
      customColor: preferredColor,
    })
  }

  const hide = (clearSelection = false) => {
    state.visible = false
    state.markId = ''
    state.showColorPalette = false
    state.showCopyMenu = false
    // Keep lastStyle; restore indicator for next selection toolbar.
    state.activeStyle = lastStyle
    activeRange = null
    clickedToolbar = false
    if (clearSelection) {
      getOwnerDocument()?.getSelection()?.removeAllRanges()
    }
  }

  const positionNearRect = (rect: DOMRect) => {
    const toolbarWidth = toolbarEl.value?.offsetWidth || 280
    const toolbarHeight = toolbarEl.value?.offsetHeight || 72
    let left = rect.left + rect.width / 2 - toolbarWidth / 2
    let top = rect.top - toolbarHeight - 10
    if (top < 8) {
      top = rect.bottom + 10
    }
    left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8))
    top = Math.max(8, Math.min(top, window.innerHeight - toolbarHeight - 8))
    state.left = left
    state.top = top
  }

  const showForRange = async (range: Range) => {
    try {
      activeRange = range.cloneRange()
    } catch {
      activeRange = range
    }
    state.markId = ''
    state.activeStyle = lastStyle
    state.showColorPalette = false
    state.showCopyMenu = false
    await restoreColorsForStyle(lastStyle)
    const rect = range.getBoundingClientRect()
    if ((rect.width <= 0 && rect.height <= 0) || Number.isNaN(rect.top)) {
      hide()
      return
    }
    state.visible = true
    await nextTick()
    positionNearRect(rect)
  }

  const showForMark = async (mark: Mark, anchor?: DOMRect) => {
    state.markId = mark.markId
    state.activeStyle = mark.styleName
    state.showColorPalette = false
    state.showCopyMenu = false
    await restoreColorsForStyle(mark.styleName, mark.customColor)
    activeRange = null
    state.visible = true
    await nextTick()
    if (anchor) {
      positionNearRect(anchor)
      return
    }
    const root = options.reader.getRenderer()?.getRendererContainer()
    const el = root?.querySelector<HTMLElement>(
      `[${MARK_HIGHLIGHT_ID_ATTR}="${CSS.escape(mark.markId)}"]`,
    )
    if (el) {
      positionNearRect(el.getBoundingClientRect())
    }
  }

  const getActiveRange = (doc: Document): Range | null => {
    const strict = getRange(doc, false)
    if (strict) {
      return strict
    }
    const selection = doc.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return null
    }
    const range = selection.getRangeAt(0)
    if (!range || range.collapsed) {
      return null
    }
    const rects = range.getClientRects()
    for (let i = 0; i < rects.length; i++) {
      if (rects[i].width > 0.5 && rects[i].height > 0.5) {
        return range
      }
    }
    return null
  }

  const tryShowFromSelection = async () => {
    if (isPointerDown) {
      return false
    }
    const doc = getOwnerDocument()
    if (!doc) {
      return false
    }
    const range = getActiveRange(doc)
    if (!range) {
      return false
    }
    await showForRange(range)
    return true
  }

  const scheduleShowFromSelection = () => {
    if (showTimer) {
      window.clearTimeout(showTimer)
    }
    showTimer = window.setTimeout(() => {
      void (async () => {
        const shown = await tryShowFromSelection()
        if (!shown && !state.markId) {
          hide()
        }
      })()
      showTimer = null
    }, 20)
  }

  const onSelectionChange = async () => {
    const doc = getOwnerDocument()
    if (!doc) {
      return
    }
    const hasRange = !!getActiveRange(doc)
    if (hasRange && isPointerDown) {
      if (state.visible) {
        hide()
      }
      return
    }
    if (!hasRange) {
      if (state.visible && !state.markId && !clickedToolbar) {
        hide()
      }
      return
    }
    if (state.visible && !state.markId && !isPointerDown) {
      await tryShowFromSelection()
    }
  }

  const clearToggleCloseMarkId = () => {
    toggleCloseMarkId = ''
    if (clearToggleCloseTimer) {
      window.clearTimeout(clearToggleCloseTimer)
      clearToggleCloseTimer = null
    }
  }

  const onPointerDown = async (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button === 2) {
      return
    }
    const target = e.target as Element | null
    if (target && toolbarEl.value?.contains(target)) {
      clickedToolbar = true
      e.preventDefault()
      return
    }
    clickedToolbar = false
    isPointerDown = true
    if (showTimer) {
      window.clearTimeout(showTimer)
      showTimer = null
    }
    if (clearToggleCloseTimer) {
      window.clearTimeout(clearToggleCloseTimer)
      clearToggleCloseTimer = null
    }
    // Remember open mark before hide so click can toggle it closed.
    toggleCloseMarkId = state.visible && state.markId ? state.markId : ''
    if (state.visible) {
      hide()
    }
  }

  const onPointerUp = async (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button === 2) {
      return
    }
    isPointerDown = false
    const target = e.target as Element | null
    if (target && toolbarEl.value?.contains(target)) {
      return
    }
    if (clickedToolbar) {
      clickedToolbar = false
      return
    }
    // Clear after click has a chance to run (same gesture); keeps drag-away safe.
    if (toggleCloseMarkId) {
      clearToggleCloseTimer = window.setTimeout(() => {
        toggleCloseMarkId = ''
        clearToggleCloseTimer = null
      }, 0)
    }
    scheduleShowFromSelection()
  }

  const onDocumentClick = async (e: MouseEvent) => {
    const target = e.target as Element | null
    if (!target) {
      return
    }
    if (toolbarEl.value?.contains(target)) {
      return
    }

    // Capture before any await: pointerup may clear via window.setTimeout(0).
    const closingMarkId = toggleCloseMarkId
    clearToggleCloseMarkId()

    const marker = getMarker()
    const found = marker ? await marker.findMark({ element: target }) : undefined
    if (found) {
      const mark = await marker?.getMark(found.id)
      if (mark) {
        // Second click on the same mark: keep toolbar closed (toggle off).
        if (closingMarkId && mark.markId === closingMarkId) {
          return
        }
        const host = target.closest<HTMLElement>(`[${MARK_HIGHLIGHT_ID_ATTR}]`)
        await showForMark(mark, host?.getBoundingClientRect())
        return
      }
    }

    const doc = getOwnerDocument()
    const hasRange = doc ? !!getActiveRange(doc) : false
    if (!hasRange) {
      hide()
    }
  }

  const drawline = async (styleName: MarkStyleName, customColor?: string) => {
    if (options.ensureEntitled && !options.ensureEntitled()) {
      return
    }
    const marker = getMarker()
    if (!marker) {
      return
    }
    const previousStyle = state.activeStyle
    lastStyle = styleName
    state.activeStyle = styleName
    state.showColorPalette = false

    if (customColor) {
      state.activeColor = normalizeMarkColor(customColor)
      state.defaultColor = styleDefaultColor(styleName)
      await refreshQuickColors(styleName, {
        currentColor: state.activeColor,
        customColor,
      })
    } else if (styleName !== previousStyle || !state.activeColor) {
      await restoreColorsForStyle(styleName)
    } else {
      state.defaultColor = styleDefaultColor(styleName)
      await refreshQuickColors(styleName, { currentColor: state.activeColor })
    }

    const color = normalizeMarkColor(
      customColor || state.activeColor || styleDefaultColor(styleName),
    )
    state.activeColor = color
    await persistColorChoice(styleName, color)

    if (state.markId) {
      const mark = await marker.getMark(state.markId)
      if (!mark) {
        return
      }
      mark.styleName = styleName
      mark.customColor = color
      await marker.updateMark(mark.markId, mark)
      return
    }

    const doc = getOwnerDocument()
    const range = activeRange ?? (doc ? getActiveRange(doc) : null)
    if (!range) {
      return
    }
    const mark = await marker.createMark({
      type: 'drawline',
      text: range.toString(),
      target: range,
      styleName,
      customColor: color,
    })
    if (mark) {
      hide(true)
    }
  }

  const removeMark = async () => {
    const marker = getMarker()
    if (!marker || !state.markId) {
      return
    }
    await marker.deleteMark(state.markId)
    hide(true)
  }

  const resolveToolbarStyle = (): MarkStyleName =>
    state.activeStyle || lastStyle || 'mark_pen'

  const setColor = async (color: string) => {
    const style = resolveToolbarStyle()
    const normalized = normalizeMarkColor(color)
    state.activeColor = normalized
    state.showColorPalette = false
    await persistColorChoice(style, normalized)
    await drawline(style, normalized)
  }

  /** Pick from the full palette: new colors go to front; existing ones keep position */
  const pickMoreColor = async (color: string) => {
    const style = resolveToolbarStyle()
    const normalized = normalizeMarkColor(color)
    state.defaultColor = styleDefaultColor(style)
    state.activeColor = normalized
    state.showColorPalette = false
    await persistColorChoice(style, normalized)
    await drawline(style, normalized)
  }

  const toggleColorPalette = () => {
    state.showColorPalette = !state.showColorPalette
  }

  const onToolbarPointerDown = (e: Event) => {
    clickedToolbar = true
    e.preventDefault()
  }

  const isSelectionInPdf = (range: Range | null): boolean => {
    if (!range) {
      return false
    }
    const container = options.reader.getRenderer()?.getRendererContainer()
    if (!container) {
      return false
    }
    try {
      return (
        container.contains(range.commonAncestorContainer) ||
        container.contains(range.startContainer)
      )
    } catch {
      return false
    }
  }

  const getSelectionText = async (): Promise<{ text: string; range: Range | null }> => {
    const doc = getOwnerDocument()
    const range = activeRange ?? (doc ? getActiveRange(doc) : null)
    let text = ''
    if (range) {
      try {
        const assistant = getPdfTextAssistant()
        text = assistant ? assistant.getText(range) : range.toString()
      } catch {
        text = range.toString()
      }
    } else if (state.markId) {
      const mark = await getMarker()?.getMark(state.markId)
      text = mark?.text ?? ''
    }
    return { text: (text || '').trim(), range }
  }

  const writeClipboard = async (text: string): Promise<boolean> => {
    if (!text) {
      return false
    }
    const doc = getOwnerDocument()
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      try {
        if (typeof ClipboardItem !== 'undefined') {
          const item = new ClipboardItem({
            'text/plain': new Blob([text], { type: 'text/plain' }),
          })
          await navigator.clipboard.write([item])
          return true
        }
      } catch {
        // ignore
      }
      // Retry after focus/select � works when the first write lacked user activation.
      try {
        if (doc?.body) {
          const ta = doc.body.createEl('textarea')
          ta.value = text
          ta.classList.add('foxycape-pdf-clipboard-proxy')
          ta.focus({ preventScroll: true })
          ta.select()
          try {
            await navigator.clipboard.writeText(text)
            return true
          } finally {
            ta.remove()
          }
        }
      } catch {
        // ignore
      }
    }
    return false
  }

  let isCopying = false
  const copyText = async () => {
    if (isCopying) {
      return
    }
    isCopying = true
    state.showCopyMenu = false
    try {
      const { text } = await getSelectionText()
      if (!text) {
        return
      }
      const ok = await writeClipboard(text)
      if (ok) {
        options.reader.notifier?.info(
          options.t('share_copy_success_tip', 'Copied to clipboard'),
        )
        hide(true)
      }
    } finally {
      isCopying = false
    }
  }

  /**
   * Copy a paste-ready markdown quote with a PDF deep link.
   * - New selection: `#page=&selection=` (no markId yet)
   * - Existing mark toolbar: `#page=&markId=` (no live DOM Range after showForMark)
   */
  const copyTextReference = async () => {
    if (isCopying) {
      return
    }
    if (options.ensureEntitled && !options.ensureEntitled()) {
      return
    }
    isCopying = true
    state.showCopyMenu = false
    try {
      const linkSource = options.getLinkSource?.() ?? null
      if (!linkSource) {
        options.reader.notifier?.info(
          options.t('share_copy_reference_unavailable', 'Unable to create text reference'),
        )
        return
      }
      const { text, range } = await getSelectionText()
      let quoteText = text
      let pageNumber: number | undefined
      let selection: string | undefined
      let markId: string | undefined

      if (range) {
        selection = rangeToObsidianSelection(range)
        pageNumber = getRangePageNumber(range)
      }

      // Clicking an existing highlight clears the live selection (`activeRange = null`).
      // Fall back to the persisted mark so copy-reference still works.
      if ((!selection || pageNumber == null) && state.markId) {
        const mark = await getMarker()?.getMark(state.markId)
        if (mark) {
          quoteText = (mark.text || quoteText || '').trim()
          pageNumber = mark.pageNumber ?? pageNumber
          markId = mark.markId
        }
      }

      if (!quoteText || pageNumber == null || (!selection && !markId)) {
        options.reader.notifier?.info(
          options.t('share_copy_reference_unavailable', 'Unable to create text reference'),
        )
        return
      }
      const subpath = buildPdfDeepLinkFragment({
        pageNumber,
        selection,
        markId,
      })
      const markdownLink = linkSource.app.fileManager.generateMarkdownLink(
        linkSource.pdfFile,
        '',
        subpath,
        '↗',
      )
      const payload = formatMarkQuoteLine(quoteText, markdownLink)
      const ok = await writeClipboard(payload)
      if (ok) {
        options.reader.notifier?.info(
          options.t('share_copy_success_tip', 'Copied to clipboard'),
        )
        hide(true)
      }
    } finally {
      isCopying = false
    }
  }

  const openCopyMenu = () => {
    state.showCopyMenu = true
  }

  const closeCopyMenu = () => {
    state.showCopyMenu = false
  }

  /** Ctrl/Cmd+C formatted copy via PdfTextAssistant (not raw browser selection). */
  const onCtrlWithCKeyCopy = async (e?: Event) => {
    const doc = getOwnerDocument()
    const range = activeRange ?? (doc ? getActiveRange(doc) : null)
    if (!isSelectionInPdf(range) && !state.markId) {
      return
    }
    if (e instanceof KeyboardEvent) {
      e.preventDefault()
      e.stopPropagation()
    }
    await copyText()
  }

  const onCopyKeyDown = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) {
      return
    }
    if (e.key !== 'c' && e.key !== 'C' && e.code !== 'KeyC') {
      return
    }
    const doc = getOwnerDocument()
    const range = activeRange ?? (doc ? getActiveRange(doc) : null)
    if (!isSelectionInPdf(range) && !state.markId) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    void copyText()
  }

  // Warm color list for default style
  void restoreColorsForStyle(lastStyle)

  const ownerDoc = getOwnerDocument()
  ownerDoc?.addEventListener('keydown', onCopyKeyDown, true)

  const handleSelectionChange = () => {
    void onSelectionChange()
  }
  const handleDocumentClick = (...args: Parameters<typeof onDocumentClick>) => {
    void onDocumentClick(...args)
  }
  const handlePointerDown = (...args: Parameters<typeof onPointerDown>) => {
    void onPointerDown(...args)
  }
  const handlePointerUp = (...args: Parameters<typeof onPointerUp>) => {
    void onPointerUp(...args)
  }
  const handleCtrlWithCKeyCopy = (...args: Parameters<typeof onCtrlWithCKeyCopy>) => {
    void onCtrlWithCKeyCopy(...args)
  }

  options.reader.events.on(EventNames.DocumentSelectionChange, handleSelectionChange)
  options.reader.events.on(EventNames.DocumentClick, handleDocumentClick)
  options.reader.events.on(EventNames.Pointerdown, handlePointerDown)
  options.reader.events.on(EventNames.Pointerup, handlePointerUp)
  options.reader.events.on(EventNames.Pointercancel, handlePointerUp)
  options.reader.events.on(EventNames.CtrlWithCKeyCopy, handleCtrlWithCKeyCopy)

  onBeforeUnmount(() => {
    if (showTimer) {
      window.clearTimeout(showTimer)
    }
    if (clearToggleCloseTimer) {
      window.clearTimeout(clearToggleCloseTimer)
    }
    ownerDoc?.removeEventListener('keydown', onCopyKeyDown, true)
    options.reader.events.off(EventNames.DocumentSelectionChange, handleSelectionChange)
    options.reader.events.off(EventNames.DocumentClick, handleDocumentClick)
    options.reader.events.off(EventNames.Pointerdown, handlePointerDown)
    options.reader.events.off(EventNames.Pointerup, handlePointerUp)
    options.reader.events.off(EventNames.Pointercancel, handlePointerUp)
    options.reader.events.off(EventNames.CtrlWithCKeyCopy, handleCtrlWithCKeyCopy)
  })

  return {
    state,
    toolbarEl,
    hide,
    drawline,
    removeMark,
    setColor,
    pickMoreColor,
    toggleColorPalette,
    onToolbarPointerDown,
    allColors: ALL_MARK_COLORS,
    isSameMarkColor,
    labels: {
      markPen: () => options.t('toolbar_markpen', 'Highlighter'),
      wavy: () => options.t('toolbar_wavyLine', 'Wavy underline'),
      underline: () => options.t('toolbar_straight', 'Underline'),
      delete: () => options.t('share_delete', 'Delete'),
      copy: () => options.t('share_copy_text', 'Copy'),
      copyDesc: () => options.t('share_copy_text_desc', 'Copy text'),
      copyTextReference: () =>
        options.t('share_copy_text_reference', 'Copy text reference'),
      defaultColor: () => options.t('share_default_color', 'Default color'),
      moreColors: () => options.t('share_more_colors', 'More colors'),
      more: () => options.t('share_more', 'More'),
      ai: () => options.t('toolbar_ai', 'AI'),
    },
    copyText,
    copyTextReference,
    openCopyMenu,
    closeCopyMenu,
  }
}
