import type { ImageDescriptor } from '@foxycape/core/kernal'
import { compareTagName } from '@foxycape/core/kernal/html/finder'
import { checkHasValidRange } from '@foxycape/core/kernal/html/selection'
import type { IPdfDocument } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfDocument'
import type { IPdfRenderer } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfRenderer'
import { asAugmentedCanvasContext } from '../canvasContextHooks'
import type { CustomPdfOptions } from '../CustomPdfOptions'
import type { IPdfImageDetector, PdfImageDetectResult } from './IPdfImageDetector'
import { canvasCssScale, isFullPageInternalImage, toCssImageBox } from './pdfInternalImageUtils'

export class PdfImageDetector implements IPdfImageDetector {
  /** Hit boxes from the painting canvas. Survives pdf.js swapping the visible canvas. */
  private readonly hitsByPage = new Map<number, ImageDescriptor[]>()

  constructor(
    private readonly renderer: IPdfRenderer,
    private readonly options: CustomPdfOptions,
  ) {}

  clearPage = (pageNumber: number) => {
    this.hitsByPage.delete(pageNumber)
  }

  add = (pageNumber: number, descriptor: ImageDescriptor) => {
    const hits = this.hitsByPage.get(pageNumber)
    if (hits) {
      hits.push(descriptor)
      return
    }
    this.hitsByPage.set(pageNumber, [descriptor])
  }

  async detect(e: MouseEvent | TouchEvent, doc?: IPdfDocument): Promise<PdfImageDetectResult> {
    const resolvedDoc = doc ?? (await this.findPageDocument(e.target as HTMLElement))
    if (!resolvedDoc) {
      return { doc: null, found: false }
    }
    doc = resolvedDoc

    let offsetX: number
    let offsetY: number
    if ('changedTouches' in e) {
      if (e.changedTouches.length === 0) {
        return { doc, found: false }
      }
      const { clientX, clientY } = e.changedTouches[0]
      const contentContainerRect = doc.getContentContainer().getBoundingClientRect()
      offsetX = clientX - contentContainerRect.left
      offsetY = clientY - contentContainerRect.top
    } else {
      offsetX = e.offsetX
      offsetY = e.offsetY
    }

    if (!this.options.enableViewPdfImages) {
      return { doc, found: false, offsetX, offsetY }
    }
    if (!('getText' in doc)) {
      return { doc, found: false, offsetX, offsetY }
    }

    const imageDescriptor = await this.findImageDescriptor(offsetX, offsetY, doc)
    if (!imageDescriptor) {
      return { doc, found: false, offsetX, offsetY }
    }

    const ownerDocument = doc.getContentContainer()?.ownerDocument
    if (!ownerDocument) {
      return { doc, found: false, offsetX, offsetY }
    }

    if (checkHasValidRange(ownerDocument)) {
      return { doc, found: false, offsetX, offsetY }
    }

    if (compareTagName((e.target as Element)?.tagName, 'A')) {
      return { doc, found: false, offsetX, offsetY }
    }

    return { doc, found: true, offsetX, offsetY }
  }

  findImageDescriptor = async (offsetX: number, offsetY: number, doc: IPdfDocument) => {
    const pageView = this.renderer.getPageView(doc.pageNumber)
    if (!pageView?.canvas) {
      return null
    }

    const stored = this.hitsByPage.get(doc.pageNumber)
    let imageDescriptors = stored?.length ? stored : undefined
    if (!imageDescriptors?.length) {
      const canvasContext = pageView.canvas.getContext('2d')
      imageDescriptors = canvasContext
        ? (asAugmentedCanvasContext(canvasContext).imageDescriptors ?? undefined)
        : undefined
    }
    if (!imageDescriptors?.length) {
      return null
    }

    let imageDescriptor: ImageDescriptor | null = null
    const changeOrientation = (pageView.rotation ?? 0) % 180 !== 0
    const { scaleX, scaleY } = canvasCssScale(pageView.canvas)

    for (let i = imageDescriptors.length - 1; i >= 0; i--) {
      const image = imageDescriptors[i]
      const rawX = image.x
      const rawY = image.y
      const rawScaledWidth = image.scaledWidth
      const rawScaledHeight = image.scaledHeight
      if (
        rawX == null ||
        rawY == null ||
        rawScaledWidth == null ||
        rawScaledHeight == null
      ) {
        continue
      }
      const box = toCssImageBox(rawX, rawY, rawScaledWidth, rawScaledHeight, scaleX, scaleY)
      const x = box.x
      const y = box.y
      const scaledWidth = box.width
      const scaledHeight = box.height

      if (
        offsetX > x &&
        offsetX < x + (changeOrientation ? scaledHeight : scaledWidth) &&
        offsetY > y &&
        offsetY < y + (changeOrientation ? scaledWidth : scaledHeight)
      ) {
        imageDescriptor = image
        break
      }
    }

    if (
      imageDescriptor &&
      isFullPageInternalImage(
        imageDescriptor,
        pageView.width,
        pageView.height,
        { scaleX, scaleY },
      )
    ) {
      return null
    }

    return imageDescriptor
  }

  private findPageDocument = async (trigger: HTMLElement) => {
    let target = trigger
    if (
      !target ||
      target.nodeType !== Node.ELEMENT_NODE ||
      compareTagName(target.tagName, 'HTML') ||
      compareTagName(target.tagName, 'BODY')
    ) {
      return null
    }

    while (
      !target.classList?.contains('page') &&
      !compareTagName(target.tagName, 'BODY') &&
      target.parentElement
    ) {
      target = target.parentElement
    }

    if (!target || compareTagName(target.tagName, 'BODY')) {
      return null
    }

    const startPageNumber = Number.parseInt(target.getAttribute('data-page-number') ?? '', 10)
    if (Number.isNaN(startPageNumber) || startPageNumber <= 0) {
      return null
    }

    return this.renderer.getDocument((startPageNumber - 1).toString())
  }

  async dispose(): Promise<void> {
    this.hitsByPage.clear()
  }
}
