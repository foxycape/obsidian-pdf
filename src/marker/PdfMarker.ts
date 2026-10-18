import type { FixedContentRange } from '@foxycape/core/kernal/ContentRange'
import { EventNames } from '@foxycape/core/kernal/EventNames'
import { injectCssContent } from '@foxycape/core/kernal/html/injector'
import type { ILogger } from '@foxycape/core/kernal/logger/ILogger'
import type { IHighlighter } from '@/mark/IHighlighter'
import { markToHighlightItem } from '@/mark/IHighlighter'
import type { IMarker } from '@/mark/IMarker'
import {
  buildMark,
  getFixedContentRange,
  markMatchesPageNumber,
  parseMarkQueryPageNumber,
  type Mark,
} from '@/mark/Mark'
import { hydrateLegacyMark } from './hydrateLegacyMark'
import type {
  CreateMarkOptions,
  FindMarkTarget,
  MarkStyle,
  MarkType,
  QueryMarkOptions,
} from '@/mark/types'
import { sharedPassageMarkId } from '@/mark/positionMarkId'
import type { IMarkStorage } from '@/storage/IMarkStorage'
import { ANONYMOUS_OWNER_ID } from '@/storage/ownerId'
import {
  getPageLayoutRef,
  selectionToFixedContentRange,
} from '@foxycape/core/mediaTypes/pdf/shared/geometry/selectionToFixedContentRange'
import { getSelectionText } from '@foxycape/core/mediaTypes/pdf/shared/geometry/textRects'
import type { IPdfDocument } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfDocument'
import type { IPdfRenderer } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfRenderer'
import { rangeToObsidianSelection } from '@/obsidian/selectionLink'
import { resolvePdfNavMeta } from './pdfNavMeta'
import {
  playGotoHighlightAnimation,
  waitForPageRendered,
} from './PdfGotoAnimation'
import { PdfHighlighter } from './PdfHighlighter'
import { DEFAULT_MARK_COLORS, PDF_MARK_STYLE_ELEMENT_ID } from './PdfMarkConstants'
import { buildMarkStylesCss, getDefaultMarkStyles } from './PdfMarkStyles'

export type MarkDataChangePayload = {
  dataType: 'mark'
  action: 'create' | 'update' | 'delete'
  items: Mark[]
  /** Obsidian `selection=a,b,c,d` captured before selection was cleared (create only). */
  selection?: string
}

type PdfPageRenderedPayload = {
  pageNumber: number
}

export class PdfMarker implements IMarker {
  private readonly renderer: IPdfRenderer
  private readonly logger: ILogger
  private readonly highlighter: IHighlighter
  private storage: IMarkStorage | undefined
  private simpleId = ''
  private readonly cache = new Map<string, Mark>()
  private isInitialized = false

  constructor(renderer: IPdfRenderer, storage: IMarkStorage) {
    this.renderer = renderer
    this.storage = storage
    this.logger = this.renderer.owner.loggerFactory.getLogger(this.constructor.name)
    this.highlighter = new PdfHighlighter(renderer)
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }
    const context = this.renderer.owner.context
    this.simpleId = context?.id ?? ''
    if (!this.simpleId) {
      this.logger.warn('PdfMarker initialize skipped: missing simpleId')
      return
    }
    this.injectStyles()
    this.bindEvents()
    await this.loadAllFromStorage()
    await this.restoreLoadedPages()
    this.isInitialized = true
  }

  getDefaultColor(markType: MarkType, styleName?: string): string | undefined {
    if (markType !== 'drawline') {
      return DEFAULT_MARK_COLORS[markType]
    }
    if (styleName) {
      return DEFAULT_MARK_COLORS[styleName]
    }
    return DEFAULT_MARK_COLORS.mark_pen
  }

  async getMarkStyles(): Promise<MarkStyle[]> {
    return getDefaultMarkStyles()
  }

  async createMark(options: CreateMarkOptions): Promise<Mark | null> {
    await this.ensureReady()
    const text = (options.text || getSelectionText(options.target)).trim()
    const contentRange = this.rangeToContentRange(options.target)
    if (!contentRange || !text) {
      this.logger.warn('createMark failed: empty contentRange')
      return null
    }

    const markId = sharedPassageMarkId(this.simpleId, contentRange, text)
    const existing = this.cache.get(markId)
    if (existing) {
      existing.styleName = options.styleName
      existing.customColor = options.customColor
      existing.updatedAt = Date.now()
      await this.applyNavMeta(existing)
      await this.persist(existing)
      await this.restoreMarks([existing])
      this.emitDataChange('update', [existing])
      return existing
    }

    const mark = buildMark(
      this.simpleId,
      options.type,
      text,
      options.styleName,
      contentRange,
      markId,
      options.customColor,
    )
    await this.applyNavMeta(mark)
    // Capture before clearSelection — DOM Range is empty afterwards.
    const selection = rangeToObsidianSelection(options.target)
    this.cache.set(mark.markId, mark)
    await this.persist(mark)
    await this.restoreMarks([mark])
    this.clearSelection(options.target)
    this.emitDataChange('create', [mark], selection)
    return mark
  }

  async restoreMarks(marks: Mark[]): Promise<void> {
    this.highlighter.paint(marks.map(markToHighlightItem))
  }

  async deleteMark(markId: string): Promise<void> {
    await this.ensureReady()
    const mark = this.cache.get(markId)
    this.cache.delete(markId)
    if (this.storage && this.simpleId) {
      await this.storage.delete(ANONYMOUS_OWNER_ID, markId)
    }
    await this.remove([markId])
    if (mark) {
      this.emitDataChange('delete', [mark])
    }
  }

  async deleteMarks(marks: Mark[]): Promise<void> {
    for (const mark of marks) {
      await this.deleteMark(mark.markId)
    }
  }

  async updateMark(markId: string, mark: Mark): Promise<void> {
    await this.ensureReady()
    mark.markId = markId
    mark.updatedAt = Date.now()
    this.cache.set(markId, mark)
    await this.persist(mark)
    await this.restoreMarks([mark])
    this.emitDataChange('update', [mark])
  }

  async getMark(markId: string): Promise<Mark | undefined> {
    return this.cache.get(markId)
  }

  async getMarks(query?: QueryMarkOptions): Promise<Mark[]> {
    let marks = Array.from(this.cache.values())
    const types = query?.types
    if (types?.length) {
      marks = marks.filter((m) => types.includes(m.type))
    }
    if (query?.keyword) {
      const keyword = query.keyword.toLowerCase()
      marks = marks.filter((m) => m.text.toLowerCase().includes(keyword))
    }
    if (query?.url) {
      marks = this.filterMarksByUrl(marks, query.url)
    }
    return marks
  }

  async remove(markIds: string[]): Promise<void> {
    this.highlighter.remove(markIds)
  }

  async removeAll(): Promise<void> {
    this.highlighter.removeAll()
  }

  async goto(mark: Mark): Promise<void> {
    const pageNumber =
      mark.pageNumber || getFixedContentRange(mark)?.geometries[0]?.pageNumber
    if (!pageNumber) {
      return
    }
    const doc =
      this.getDocByPageNumber(pageNumber) ?? this.renderer.getDocuments()[0]
    if (doc && this.renderer.pagingNavigator) {
      await this.renderer.pagingNavigator.gotoPage(doc, pageNumber)
    }

    // Geometry overlays only need the page canvas/layout, not the text layer.
    await waitForPageRendered(this.renderer, pageNumber)
    await this.restoreMarks([mark])

    const masks = this.highlighter.getElements(mark.markId)
    masks[0]?.scrollIntoView({ block: 'center', inline: 'nearest' })
    playGotoHighlightAnimation(masks)
  }

  captureFixedRange(range: Range): FixedContentRange | undefined {
    return this.rangeToContentRange(range)
  }

  async flashFixedRange(contentRange: FixedContentRange): Promise<boolean> {
    const geometries = contentRange.geometries.filter(
      (geometry) => geometry.pageNumber > 0 && geometry.coords.length >= 4,
    )
    if (geometries.length === 0) {
      return false
    }
    const pageNumber = geometries[0].pageNumber
    const doc = this.getDocByPageNumber(pageNumber) ?? this.renderer.getDocuments()[0]
    if (doc && this.renderer.pagingNavigator) {
      await this.renderer.pagingNavigator.gotoPage(doc, pageNumber)
    }
    await waitForPageRendered(this.renderer, pageNumber)
    const id = 'foxycape-pdf-passage-flash'
    this.highlighter.remove([id])
    this.highlighter.paint([
      {
        id,
        type: 'drawline',
        styleName: 'mark_pen',
        contentRange: { kind: 'fixed', geometries },
      },
    ])
    const masks = this.highlighter.getElements(id)
    if (masks.length === 0) {
      this.highlighter.remove([id])
      return false
    }
    masks[0]?.scrollIntoView({ block: 'center', inline: 'nearest' })
    this.highlighter.detach([id])
    playGotoHighlightAnimation(masks, { removeElements: true })
    return true
  }

  async ensureNavMeta(marks: Mark[]): Promise<Mark[]> {
    for (const mark of marks) {
      if (mark.navTitle?.trim() || mark.navUrl?.trim()) {
        continue
      }
      const hadNav = Boolean(mark.navTitle || mark.navUrl)
      await this.applyNavMeta(mark)
      if (!hadNav && (mark.navTitle || mark.navUrl)) {
        await this.persist(mark)
      }
    }
    return marks
  }

  async findMark(target: FindMarkTarget): Promise<{ id: string; type: MarkType } | undefined> {
    const found = this.highlighter.findAt(target)
    if (!found) {
      return undefined
    }
    return { id: found.id, type: this.cache.get(found.id)?.type ?? found.type }
  }

  async dispose(): Promise<void> {
    this.unbindEvents()
    await this.highlighter.dispose()
    this.cache.clear()
    this.isInitialized = false
  }

  private async ensureReady() {
    if (!this.isInitialized) {
      await this.initialize()
    }
    if (!this.storage || !this.simpleId) {
      throw new Error('PdfMarker storage is not ready')
    }
  }

  private injectStyles() {
    const root = this.renderer.owner.getRootContainer() ?? this.renderer.getRendererContainer()
    if (!root) {
      return
    }
    injectCssContent(root.ownerDocument, buildMarkStylesCss(), true, PDF_MARK_STYLE_ELEMENT_ID)
  }

  private bindEvents() {
    this.renderer.owner.events.on(EventNames.PdfPageRendered, this.onPageRendered)
    this.renderer.owner.events.on(EventNames.PdfScaleChanging, this.onScaleChanging)
  }

  private unbindEvents() {
    this.renderer.owner.events.off(EventNames.PdfPageRendered, this.onPageRendered)
    this.renderer.owner.events.off(EventNames.PdfScaleChanging, this.onScaleChanging)
  }

  private onPageRendered = (payload: PdfPageRenderedPayload) => {
    void this.handlePageRendered(payload)
  }

  private handlePageRendered = async (payload: PdfPageRenderedPayload) => {
    const pageNumber = payload?.pageNumber
    if (!pageNumber) {
      return
    }
    const marks = await this.getMarks({ url: String(pageNumber) })
    if (marks.length > 0) {
      await this.restoreMarks(marks)
    }
  }

  private onScaleChanging = () => {
    this.highlighter.relayout()
  }

  private async restoreLoadedPages() {
    const docs = this.renderer.getLoadedDocuments()
    const marks: Mark[] = []
    for (const doc of docs) {
      marks.push(...(await this.getMarks({ url: String(doc.pageNumber) })))
    }
    if (marks.length > 0) {
      await this.restoreMarks(marks)
    }
  }

  async reloadFromStorage(): Promise<void> {
    if (!this.isInitialized || !this.storage || !this.simpleId) {
      return
    }
    const previous = new Set(this.cache.keys())
    await this.loadAllFromStorage()
    const added = [...this.cache.values()].filter((mark) => !previous.has(mark.markId))
    await this.restoreLoadedPages()
    if (added.length > 0) {
      this.emitDataChange('create', added)
    }
  }

  private async loadAllFromStorage() {
    if (!this.storage || !this.simpleId) {
      return
    }
    const all = await this.storage.listByResource(ANONYMOUS_OWNER_ID, this.simpleId)
    this.cache.clear()
    for (const value of all) {
      if (value?.markId) {
        this.cache.set(value.markId, hydrateLegacyMark(value))
      }
    }
  }

  private async applyNavMeta(mark: Mark) {
    if (mark.navTitle?.trim() || mark.navUrl?.trim()) {
      return
    }
    const pageNumber = mark.pageNumber ?? getFixedContentRange(mark)?.geometries[0]?.pageNumber
    const nav = await resolvePdfNavMeta(this.renderer, pageNumber)
    if (!nav) {
      return
    }
    mark.navTitle = nav.navTitle
    mark.navUrl = nav.navUrl
  }

  private async persist(mark: Mark) {
    if (!this.storage || !this.simpleId) {
      return
    }
    await this.storage.put(ANONYMOUS_OWNER_ID, mark)
  }

  private filterMarksByUrl = (marks: Mark[], url: string): Mark[] => {
    const trimmed = url.trim()
    if (!trimmed) {
      return marks
    }
    const pageNumber =
      parseMarkQueryPageNumber(trimmed) ?? this.renderer.getDocument(trimmed)?.pageNumber
    if (pageNumber != null) {
      return marks.filter((m) => markMatchesPageNumber(m, pageNumber))
    }
    return marks.filter((m) => m.url === trimmed)
  }

  private getDocByPageNumber(pageNumber: number): IPdfDocument | undefined {
    const docs = this.renderer.getDocuments()
    return docs.find((d) => d.pageNumber === pageNumber)
  }

  resolveSelectionMarkId = async (range: Range | null, text: string): Promise<string | undefined> => {
    const source = text.trim()
    if (!range || !source || !this.simpleId) {
      return undefined
    }
    const contentRange = this.rangeToContentRange(range)
    if (!contentRange) {
      return undefined
    }
    return sharedPassageMarkId(this.simpleId, contentRange, source)
  }

  private rangeToContentRange(range: Range): FixedContentRange | undefined {
    return selectionToFixedContentRange(range, (pageNumber) => {
      const doc = this.getDocByPageNumber(pageNumber)
      const pageEl = doc?.getContentContainer() ?? this.renderer.getPageView(pageNumber)?.div
      if (!pageEl) {
        return undefined
      }
      const layout = getPageLayoutRef(pageEl)
      if (!layout) {
        return undefined
      }
      const rotation = doc?.getPageGeometry()?.rotation ?? 0
      return { ...layout, rotation }
    })
  }

  private clearSelection(range: Range) {
    const selection = range.startContainer.ownerDocument?.getSelection()
    selection?.removeAllRanges()
  }

  private emitDataChange(
    action: 'create' | 'update' | 'delete',
    items: Mark[],
    selection?: string,
  ) {
    const payload: MarkDataChangePayload = {
      dataType: 'mark',
      action,
      items,
    }
    if (selection) {
      payload.selection = selection
    }
    this.renderer.owner.events.emit(EventNames.DataChange, payload)
  }
}
