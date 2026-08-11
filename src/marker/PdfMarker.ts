import { computeUniqueId } from '@core/kernal/common/uuid'
import type { FixedContentRange } from '@core/kernal/ContentRange'
import { EventNames } from '@core/kernal/EventNames'
import { injectCssContent } from '@core/kernal/html/injector'
import type { ILogger } from '@core/kernal/logger/ILogger'
import type { IMarker } from '@core/kernal/mark/IMarker'
import { MARK_HIGHLIGHT_ID_ATTR } from '@core/kernal/mark/MarkConstants'
import {
  createMark as buildMark,
  getFixedContentRange,
  type Mark,
} from '@core/kernal/mark/Mark'
import type {
  CreateMarkOptions,
  FindMarkTarget,
  MarkStyle,
  MarkType,
  QueryMarkOptions,
} from '@core/kernal/mark/types'
import type { IStorage } from '@core/kernal/storage/IStorage'
import {
  getPageLayoutRef,
  selectionToFixedContentRange,
} from '@core/mediaTypes/pdf/shared/geometry/selectionToFixedContentRange'
import { getSelectionText } from '@core/mediaTypes/pdf/shared/geometry/textRects'
import type { IPdfDocument } from '@core/mediaTypes/pdf/renderer/IPdfDocument'
import type { IPdfRenderer } from '@core/mediaTypes/pdf/renderer/IPdfRenderer'
import { rangeToObsidianSelection } from '@/obsidian/selectionLink'
import {
  playGotoHighlightAnimation,
  waitForPageRendered,
} from './PdfGotoAnimation'
import { DEFAULT_MARK_COLORS, PDF_MARK_STYLE_ELEMENT_ID } from './PdfMarkConstants'
import {
  findMarkIdAtPoint,
  paintMarkOnPage,
  removeAllMarkOverlays,
  removeMarkOverlays,
} from './PdfMarkOverlay'
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
  private storage: IStorage | undefined
  private resourceId = ''
  private tableName = ''
  private readonly cache = new Map<string, Mark>()
  private isInitialized = false

  constructor(renderer: IPdfRenderer) {
    this.renderer = renderer
    this.logger = this.renderer.owner.loggerFactory.getLogger(this.constructor.name)
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }
    const context = this.renderer.owner.context
    this.resourceId = context?.id ?? context?.simpleId ?? ''
    if (!this.resourceId) {
      this.logger.warn('PdfMarker initialize skipped: missing resourceId')
      return
    }
    this.tableName = `mark-${this.resourceId}`
    this.storage = await this.renderer.owner.services.get('storage', true)
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
    const text = options.text || getSelectionText(options.target)
    const contentRange = selectionToFixedContentRange(options.target, (pageNumber) => {
      const pageEl =
        this.getDocByPageNumber(pageNumber)?.getContentContainer() ??
        this.renderer.getPageView(pageNumber)?.div
      if (!pageEl) {
        return undefined
      }
      return getPageLayoutRef(pageEl)
    })
    if (!contentRange) {
      this.logger.warn('createMark failed: empty contentRange')
      return null
    }

    const markId = this.computeMarkId(contentRange, text)
    const existing = this.cache.get(markId)
    if (existing) {
      existing.styleName = options.styleName
      existing.customColor = options.customColor
      existing.updateTime = new Date().toISOString()
      await this.persist(existing)
      await this.restoreMarks([existing])
      this.emitDataChange('update', [existing])
      return existing
    }

    const mark = buildMark(
      this.resourceId,
      options.type,
      text,
      options.styleName,
      contentRange,
      markId,
      options.customColor,
    )
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
    for (const mark of marks) {
      const fixed = getFixedContentRange(mark)
      if (!fixed) {
        continue
      }
      const pageNumbers = new Set(fixed.geometries.map((g) => g.pageNumber))
      for (const pageNumber of pageNumbers) {
        const doc = this.getDocByPageNumber(pageNumber)
        if (!doc) {
          continue
        }
        paintMarkOnPage(doc, mark)
      }
    }
  }

  async deleteMark(markId: string): Promise<void> {
    await this.ensureReady()
    const mark = this.cache.get(markId)
    this.cache.delete(markId)
    if (this.storage && this.tableName) {
      await this.storage.delete(this.tableName, markId)
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
    mark.updateTime = new Date().toISOString()
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
    if (query?.types?.length) {
      marks = marks.filter((m) => query.types!.includes(m.type))
    }
    if (query?.keyword) {
      const keyword = query.keyword.toLowerCase()
      marks = marks.filter((m) => m.text.toLowerCase().includes(keyword))
    }
    if (query?.pageNumber != null) {
      const pageNumber = query.pageNumber
      marks = marks.filter((m) => {
        const fixed = getFixedContentRange(m)
        return fixed?.geometries.some((g) => g.pageNumber === pageNumber) ?? false
      })
    }
    return marks
  }

  async remove(markIds: string[]): Promise<void> {
    const root = this.renderer.getRendererContainer()
    if (!root) {
      return
    }
    removeMarkOverlays(root, markIds)
  }

  async removeAll(): Promise<void> {
    const root = this.renderer.getRendererContainer()
    if (!root) {
      return
    }
    removeAllMarkOverlays(root)
  }

  async goto(mark: Mark): Promise<void> {
    const pageNumber =
      mark.pageNumber || getFixedContentRange(mark)?.geometries[0]?.pageNumber
    if (!pageNumber) {
      return
    }
    const doc =
      this.getDocByPageNumber(pageNumber) ?? (this.renderer.getDocuments() as IPdfDocument[])[0]
    if (doc && this.renderer.pagingNavigator) {
      await this.renderer.pagingNavigator.gotoPage(doc, pageNumber)
    }

    // Geometry overlays only need the page canvas/layout, not the text layer.
    await waitForPageRendered(this.renderer, pageNumber)
    await this.restoreMarks([mark])

    const root = this.renderer.getRendererContainer()
    const masks = root
      ? Array.from(
          root.querySelectorAll(`[${MARK_HIGHLIGHT_ID_ATTR}="${CSS.escape(mark.markId)}"]`),
        )
      : []
    masks[0]?.scrollIntoView({ block: 'center', inline: 'nearest' })
    playGotoHighlightAnimation(masks)
  }

  async findMark(target: FindMarkTarget): Promise<{ id: string; type: MarkType } | undefined> {
    if (target.element) {
      const host = target.element.closest(`[${MARK_HIGHLIGHT_ID_ATTR}]`) as HTMLElement | null
      if (host) {
        const id = host.getAttribute(MARK_HIGHLIGHT_ID_ATTR)
        const type = (host.getAttribute('data-mark-type') as MarkType) || 'drawline'
        if (id) {
          return { id, type }
        }
      }
    }

    const pageNumber = target.pageNumber
    if (pageNumber == null || target.offsetX == null || target.offsetY == null) {
      return undefined
    }
    const doc = this.getDocByPageNumber(pageNumber)
    const pageEl = doc?.getContentContainer()
    if (!pageEl) {
      return undefined
    }
    const id = findMarkIdAtPoint(pageEl, target.offsetX, target.offsetY)
    if (!id) {
      return undefined
    }
    const mark = this.cache.get(id)
    return { id, type: mark?.type ?? 'drawline' }
  }

  async dispose(): Promise<void> {
    this.unbindEvents()
    await this.removeAll()
    this.cache.clear()
    this.isInitialized = false
  }

  private async ensureReady() {
    if (!this.isInitialized) {
      await this.initialize()
    }
    if (!this.storage || !this.tableName) {
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

  private onPageRendered = async (payload: PdfPageRenderedPayload) => {
    const pageNumber = payload?.pageNumber
    if (!pageNumber) {
      return
    }
    const marks = await this.getMarks({ pageNumber })
    if (marks.length > 0) {
      await this.restoreMarks(marks)
    }
  }

  private onScaleChanging = async () => {
    await this.restoreLoadedPages()
  }

  private async restoreLoadedPages() {
    const docs = this.renderer.getLoadedDocuments() as IPdfDocument[]
    for (const doc of docs) {
      const marks = await this.getMarks({ pageNumber: doc.pageNumber })
      for (const mark of marks) {
        paintMarkOnPage(doc, mark)
      }
    }
  }

  private async loadAllFromStorage() {
    if (!this.storage || !this.tableName) {
      return
    }
    const all = await this.storage.getAll<Mark>(this.tableName)
    this.cache.clear()
    for (const [key, value] of all) {
      if (value?.markId) {
        this.cache.set(value.markId, value)
      } else if (value) {
        this.cache.set(key, value)
      }
    }
  }

  private async persist(mark: Mark) {
    if (!this.storage || !this.tableName) {
      return
    }
    await this.storage.set(this.tableName, mark.markId, mark)
  }

  private getDocByPageNumber(pageNumber: number): IPdfDocument | undefined {
    const docs = this.renderer.getDocuments() as IPdfDocument[]
    return docs.find((d) => d.pageNumber === pageNumber)
  }

  private computeMarkId(contentRange: FixedContentRange, text: string): string {
    const geometryKey = contentRange.geometries
      .map((g) => `${g.pageNumber}:${g.coords.join(',')}`)
      .join('|')
    return computeUniqueId(`${this.resourceId}|${geometryKey}|${text}`)
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
