import type { ImageDescriptor } from '@core/kernal'
import { compareTagName } from '@core/kernal/html/finder'
import { checkHasValidRange } from '@core/kernal/html/selection'
import type { IPdfDocument } from '@core/mediaTypes/pdf/renderer/IPdfDocument'
import type { IPdfRenderer } from '@core/mediaTypes/pdf/renderer/IPdfRenderer'
import type { CustomPdfOptions } from '../CustomPdfOptions'
import type { IPdfImageDetector, PdfImageDetectResult } from './IPdfImageDetector'
import { isFullPageInternalImage } from './pdfInternalImageUtils'

export class PdfImageDetector implements IPdfImageDetector {
  constructor(
    private readonly renderer: IPdfRenderer,
    private readonly options: CustomPdfOptions,
  ) {}

  async detect(e: MouseEvent | TouchEvent, doc?: IPdfDocument): Promise<PdfImageDetectResult> {
    doc = (doc ?? (await this.findPageDocument(e.target as HTMLElement))) as IPdfDocument | null
    if (!doc) {
      return { doc: null, found: false }
    }

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

    const canvasContext = pageView.canvas.getContext('2d') as CanvasRenderingContext2D
    const imageDescriptors = (canvasContext as any)['imageDescriptors'] as
      | ImageDescriptor[]
      | undefined
    if (!imageDescriptors?.length) {
      return null
    }

    let imageDescriptor: ImageDescriptor | null = null
    const changeOrientation = (pageView.rotation ?? 0) % 180 !== 0
    const devicePixelRatio = window.devicePixelRatio ?? 1

    for (let i = imageDescriptors.length - 1; i >= 0; i--) {
      const image = imageDescriptors[i]
      const x = image.x! / devicePixelRatio
      const y = image.y! / devicePixelRatio
      const scaledWidth = image.scaledWidth! / devicePixelRatio
      const scaledHeight = image.scaledHeight! / devicePixelRatio

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
      isFullPageInternalImage(imageDescriptor, pageView.width, pageView.height)
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

    return this.renderer.getDocument((startPageNumber - 1).toString()) as IPdfDocument
  }

  async dispose(): Promise<void> {
    //
  }
}
