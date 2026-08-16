import {
  AnimationClassName,
  type ImageDescriptor,
  type Reader
} from '@foxycape/core/kernal'
import { getRandomId } from '@foxycape/core/kernal/common/uuid'
import { getFileName } from '@foxycape/core/kernal/common/path'
import { isNullOrWhiteSpace } from '@foxycape/core/kernal/common/text'
import { compareTagName } from '@foxycape/core/kernal/html/finder'
import {
  copyImage as copyImageToClipboard,
  createBlobUrl,
  getBlob,
  getImageSize
} from '@foxycape/core/kernal/html/image'
import { existsElement, injectCssContent, removeElement } from '@foxycape/core/kernal/html/injector'
import PhotoSwipe from 'photoswipe'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import { sanitizeHTMLToDom } from 'obsidian'
import {
  clearPendingPdfImageRef,
  stagePdfImageRefCopy,
} from '@/obsidian/pdfImageRef'
import type { IPdfImageSource } from '../IPdfImageSource'
import { getFlipOnlyMatrix } from '../pdfInternalImageUtils'
import type { PdfImageViewerCallbacks, PdfImageViewerHistoryTarget, PdfImageViewerOptions } from './types'
import { IMAGE_ICONS } from '../imageIcons'
import { bindPhotoSwipeZoomInteraction } from './bindPhotoSwipeZoomInteraction'
import { createPhotoSwipeZoomInteractionOptions } from './photoSwipeZoomLevels'

const ICONS = {
  download: IMAGE_ICONS.download,
  copy: IMAGE_ICONS.copy,
  copyReference: IMAGE_ICONS.copyReference,
  rotate: IMAGE_ICONS.rotate,
  close: IMAGE_ICONS.close,
  loader: IMAGE_ICONS.loader,
} as const

const DEFAULT_HTML_DATA_KEY = 'defaultHtml'
const DEFAULT_TITLE_DATA_KEY = 'defaultTitle'

type ImageSlideData = {
  url?: string
  imageId: string
  src?: string
  width?: number
  height?: number
  matrix?: ImageDescriptor['matrix']
}

export class PdfImageViewer {
  private lightbox: PhotoSwipeLightbox | null = null
  private readonly target: HTMLElement
  private readonly isFullscreen: boolean
  private readonly resizeObserver: ResizeObserver
  private readonly pswpPositionCssId = getRandomId()
  private imageDescriptors: ImageDescriptor[] = []
  private readonly customCssId = getRandomId(true)
  private readonly photoswipeCssId = getRandomId(true)
  private readonly historyTarget: PdfImageViewerHistoryTarget = { layer: 'pdf-internal-image-viewer' }
  private initialized = false
  private toastEl: HTMLElement | null = null
  private toastTimer: number | null = null

  constructor(
    public readonly reader: Reader,
    private readonly imageSource: IPdfImageSource,
    rootElement: HTMLElement | null,
    private readonly callbacks: PdfImageViewerCallbacks,
    private readonly viewerOptions: PdfImageViewerOptions = {}
  ) {
    this.isFullscreen = viewerOptions.fullscreen ?? true
    this.target =
      rootElement ??
      (typeof document !== 'undefined' ? document.body : createDiv())

    this.resizeObserver = new ResizeObserver(() => {
      this.updateViewerSize()
    })

    if (this.isFullscreen) {
      this.resizeObserver.observe(document.documentElement)
      window.addEventListener('resize', this.onWindowResize)
      const styleRoot = document.head ?? this.target
      injectCssContent(
        styleRoot,
        '.pswp { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; }',
        false,
        this.pswpPositionCssId
      )
    } else {
      this.resizeObserver.observe(this.target)
      injectCssContent(
        this.target,
        '.pswp { position: absolute !important; }',
        false,
        this.pswpPositionCssId
      )
    }
  }

  private getViewportSize = () => {
    if (this.isFullscreen) {
      return {
        x: window.innerWidth,
        y: window.innerHeight
      }
    }
    return {
      x: this.target.clientWidth,
      y: this.target.clientHeight
    }
  }

  private updateViewerSize = () => {
    if (!this.lightbox?.pswp) return
    this.lightbox.pswp.updateSize(true)
  }

  private onWindowResize = () => {
    this.updateViewerSize()
  }

  private buildImageSource(imageDescriptor: ImageDescriptor): ImageSlideData {
    return {
      url: imageDescriptor.docUrl,
      imageId: imageDescriptor.id,
      src: imageDescriptor.accessibleImageUrl,
      width: imageDescriptor.width,
      height: imageDescriptor.height,
      matrix: imageDescriptor.matrix
    }
  }

  private getPlaceholderDimensions(imageDescriptor: ImageDescriptor) {
    const dpr = window.devicePixelRatio ?? 1
    const width =
      imageDescriptor.width ??
      (imageDescriptor.scaledWidth
        ? Math.round(imageDescriptor.scaledWidth / dpr)
        : undefined)
    const height =
      imageDescriptor.height ??
      (imageDescriptor.scaledHeight
        ? Math.round(imageDescriptor.scaledHeight / dpr)
        : undefined)

    return {
      width: width && width > 0 ? width : 800,
      height: height && height > 0 ? height : 600
    }
  }

  private buildInitialSlideData(imageDescriptor: ImageDescriptor): ImageSlideData {
    const { width, height } = this.getPlaceholderDimensions(imageDescriptor)
    return {
      url: imageDescriptor.docUrl,
      imageId: imageDescriptor.id,
      src: imageDescriptor.accessibleImageUrl,
      width,
      height,
      matrix: imageDescriptor.matrix
    }
  }

  private injectStyles = async () => {
    const root = this.isFullscreen
      ? document.head
      : compareTagName(this.target.tagName, 'BODY')
        ? this.target.ownerDocument
        : this.target
    if (!root) return

    if (!existsElement(root, this.customCssId)) {
      const { default: css } = await import('./style.css?raw')
      if (css) {
        injectCssContent(root, css.toString(), false, this.customCssId)
      }
    }

    if (!existsElement(root, this.photoswipeCssId)) {
      const { default: photoswipeCss } = await import('photoswipe/style.css?raw')
      if (photoswipeCss) {
        injectCssContent(root, photoswipeCss.toString(), false, this.photoswipeCssId)
      }
    }
  }

  private removeStyles = () => {
    const styleRoot = this.isFullscreen ? document.head : this.target
    removeElement(styleRoot, this.customCssId)
    removeElement(styleRoot, this.photoswipeCssId)
    removeElement(styleRoot, this.pswpPositionCssId)
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    this.lightbox = new PhotoSwipeLightbox({
      appendToEl: this.target,
      close: false,
      zoom: false,
      allowPanToNext: false,
      arrowPrev: false,
      arrowNext: false,
      wheelToZoom: true,
      arrowKeys: true,
      preloadFirstSlide: false,
      clickToCloseNonZoomable: this.viewerOptions.clickToCloseNonZoomable ?? false,
      closeOnVerticalDrag: this.viewerOptions.closeOnVerticalDrag ?? true,
      bgClickAction: this.viewerOptions.closeOnBgClick ? 'close' : false,
      maxZoomLevel: 4,
      ...createPhotoSwipeZoomInteractionOptions(),
      preload: [0, 0],
      dataSource: [],
      pswpModule: () => import('photoswipe'),
      getViewportSizeFn: () => this.getViewportSize()
    })

    this.lightbox.on('init', () => {
      void this.injectStyles()
    })

    this.lightbox.on('initialLayout', () => {
      if (this.lightbox?.pswp?.element) {
        this.lightbox.pswp.element.style.setProperty(
          'z-index',
          String(this.viewerOptions.zIndex ?? 10000),
          'important'
        )
      }

      const bridge = this.viewerOptions.historyBridge
      if (bridge?.shouldTrack()) {
        this.historyTarget.closed = false
        bridge.pushState(this.historyTarget, () => this.close())
      }
    })

    this.lightbox.on('close', () => {
      this.hideToast()
      this.disposeCurrentImage()
      this.viewerOptions.historyBridge?.back(this.historyTarget)
    })

    this.lightbox.on('destroy', () => {
      this.hideToast(true)
      this.removeStyles()
    })

    this.lightbox.on('pointerDown', this.beforePointerMove)
    this.lightbox.on('pointerUp', this.afterPointerMove)

    this.lightbox.on('keydown', (event) => {
      if (event.originalEvent.key === 'Escape') {
        event.preventDefault()
      }
    })

    this.lightbox.on('init', () => {
      bindPhotoSwipeZoomInteraction(this.lightbox?.pswp)
    })

    this.lightbox.on('loadComplete', ({ slide }) => {
      if (!slide?.content?.element) return
      const element = slide.content.element
      element.removeAttribute('degree')
      delete element.dataset.pdfFlipTransform
      const slideData = slide.content.data as ImageSlideData | undefined
      const flipMatrix = getFlipOnlyMatrix(slideData?.matrix)
      if (flipMatrix?.toStyle) {
        element.dataset.pdfFlipTransform = flipMatrix.toStyle()
        element.style.transform = flipMatrix.toStyle()
      }
      this.lightbox?.pswp?.updateSize(true)
    })

    this.lightbox.on('uiRegister', () => {
      const pswp = this.lightbox?.pswp
      if (!pswp) return

      pswp.ui.registerElement({
        name: 'zoom-button',
        order: 8,
        tagName: 'div',
        appendTo: 'wrapper',
        onInit: (el, instance) => {
          el.classList.add('foxycape-pdf-pswp-zoom-ui')

          const indicator = el.createDiv({ cls: 'foxycape-pdf-pswp-zoom-indicator' })

          instance.on('zoomPanUpdate', (event) => {
            if (event.slide === instance.currSlide) {
              indicator.innerText = `${Math.round(instance.currSlide.currZoomLevel * 100)}%`
            }
          })

        }
      })

      pswp.ui.registerElement({
        name: 'bottom-buttons',
        order: 8,
        tagName: 'div',
        appendTo: 'wrapper',
        onInit: (el, instance) => {
          el.classList.add('foxycape-pdf-pswp-bottom-ui')

          const buttonsContainer = el.createDiv({ cls: 'button-containers' })
          this.appendButtons(buttonsContainer, instance)
        }
      })
    })

    this.lightbox.init()
    this.initialized = true
  }

  private setButtonIconHtml = (button: HTMLElement, html: string) => {
    button.empty()
    button.appendChild(sanitizeHTMLToDom(html))
  }

  private createActionButton = (
    parent: HTMLElement,
    html: string,
    title: string,
    onClick: () => void
  ) => {
    const button = parent.createEl('button', {
      cls: 'pswp__button pswp-button pswp-custom-button',
      attr: { type: 'button', rel: 'noopener', title },
    })
    this.setButtonIconHtml(button, html)
    button.dataset[DEFAULT_HTML_DATA_KEY] = html
    button.dataset[DEFAULT_TITLE_DATA_KEY] = title
    // button.setAttribute('aria-label', title)
    button.addEventListener('click', onClick)
    return button
  }

  private setToolbarButtonsLoading = (
    container: HTMLElement,
    loading: boolean,
    activeButton: HTMLButtonElement,
    activeTitle: string
  ) => {
    const buttons = container.querySelectorAll('button')
    buttons.forEach((button) => {
      if (!button.instanceOf(HTMLButtonElement)) {
        return
      }
      const actionButton = button
      actionButton.disabled = loading
      if (loading && actionButton === activeButton) {
        this.setButtonIconHtml(actionButton, ICONS.loader)
        actionButton.title = activeTitle
        // actionButton.setAttribute('aria-label', activeTitle)
        actionButton.setAttribute('aria-busy', 'true')
        actionButton.classList.add('pswp-custom-button--loading')
        return
      }

      actionButton.classList.remove('pswp-custom-button--loading')
      actionButton.removeAttribute('aria-busy')
      const defaultHtml = actionButton.dataset[DEFAULT_HTML_DATA_KEY]
      if (defaultHtml) {
        this.setButtonIconHtml(actionButton, defaultHtml)
      }
      const defaultTitle = actionButton.dataset[DEFAULT_TITLE_DATA_KEY]
      if (defaultTitle) {
        actionButton.title = defaultTitle
        // actionButton.setAttribute('aria-label', defaultTitle)
      }
    })
  }

  private createAsyncActionButton = (
    parent: HTMLElement,
    html: string,
    title: string,
    loadingTitle: string,
    action: () => Promise<void>
  ) => {
    const button = this.createActionButton(parent, html, title, () => {
      void (async () => {
        if (button.disabled) return
        this.setToolbarButtonsLoading(parent, true, button, loadingTitle)
        try {
          await action()
        } finally {
          this.setToolbarButtonsLoading(parent, false, button, title)
        }
      })()
    })
    return button
  }

  private appendButtons = (parent: HTMLElement, pswp: PhotoSwipe) => {
    const { texts } = this.callbacks
    const loadingTitle = texts.loading

    this.createAsyncActionButton(parent, ICONS.download, texts.download, loadingTitle, async () => {
      const imageDescriptor = this.getCurrentImageDescriptor(pswp)
      if (!imageDescriptor) return
      await this.downloadImage(imageDescriptor, pswp)
    })

    this.createAsyncActionButton(parent, ICONS.copy, texts.copy, loadingTitle, async () => {
      const imageDescriptor = this.getCurrentImageDescriptor(pswp)
      if (!imageDescriptor) return
      await this.copyImage(imageDescriptor, pswp)
    })

    this.createAsyncActionButton(
      parent,
      ICONS.copyReference,
      texts.copyReference,
      loadingTitle,
      async () => {
        const imageDescriptor = this.getCurrentImageDescriptor(pswp)
        if (!imageDescriptor) return
        await this.copyImageReference(imageDescriptor, pswp)
      },
    )

    this.createActionButton(parent, ICONS.rotate, texts.rotate, () => {
      this.rotate(pswp, 90)
    })

    this.createActionButton(parent, ICONS.close, texts.close, () => {
      this.close()
    })
  }

  private getCurrentImageDescriptor = (pswp: PhotoSwipe) => {
    const slideData = pswp.currSlide?.data as ImageSlideData | undefined
    const imageId = slideData?.imageId
    if (!imageId) return null
    return this.imageDescriptors.find((item) => item.id === imageId) ?? null
  }

  private resolvePageNumber = (docUrl: string) => {
    const pageNumber = Number.parseInt(docUrl, 10)
    return Number.isNaN(pageNumber) ? 1 : pageNumber
  }

  private getSlideRotationDegree = (pswp: PhotoSwipe) => {
    const img = pswp.currSlide?.content?.element as HTMLElement | undefined
    if (!img) return 0
    const degree = Number.parseInt(img.getAttribute('degree') ?? '0', 10)
    return Number.isNaN(degree) ? 0 : degree
  }

  private normalizeRotationDegree = (degree: number) => {
    const normalized = degree % 360
    return normalized < 0 ? normalized + 360 : normalized
  }

  private resolveExportSource = async (
    imageDescriptor: ImageDescriptor,
    rotationDegree: number
  ) => {
    const image = await this.imageSource.getImage(
      this.resolvePageNumber(imageDescriptor.docUrl ?? ''),
      imageDescriptor.imageUrl
    )
    if (!image) {
      throw new Error('Image not found')
    }

    const normalizedDegree = this.normalizeRotationDegree(rotationDegree)
    const flipMatrix = getFlipOnlyMatrix(imageDescriptor.matrix)

    if (normalizedDegree === 0) {
      return {
        source: image,
        matrix: flipMatrix
      }
    }

    const baseBlob = await getBlob(image, flipMatrix)
    const baseWidth = baseBlob.width
    const baseHeight = baseBlob.height
    const isQuarterTurn = normalizedDegree === 90 || normalizedDegree === 270

    const canvas = createEl('canvas')
    canvas.width = isQuarterTurn ? baseHeight : baseWidth
    canvas.height = isQuarterTurn ? baseWidth : baseHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas not supported')
    }

    const bitmap = await createImageBitmap(baseBlob.data)
    try {
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((normalizedDegree * Math.PI) / 180)
      ctx.drawImage(bitmap, -baseWidth / 2, -baseHeight / 2, baseWidth, baseHeight)
    } finally {
      bitmap.close()
    }

    return {
      source: canvas,
      matrix: undefined
    }
  }

  private showToast = (message: string, tone: 'info' | 'error' = 'info') => {
    const host = this.lightbox?.pswp?.element
    if (!host || !message) {
      return
    }

    if (!this.toastEl) {
      this.toastEl = createDiv({
        cls: 'foxycape-pdf-image-toast',
        attr: { role: 'status', 'aria-live': 'polite' },
      })
    }
    if (this.toastEl.parentElement !== host) {
      host.appendChild(this.toastEl)
    }

    this.toastEl.textContent = message
    this.toastEl.dataset.tone = tone
    // Restart enter animation when replacing an existing toast.
    this.toastEl.classList.remove('is-visible')
    void this.toastEl.offsetWidth
    this.toastEl.classList.add('is-visible')

    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer)
    }
    this.toastTimer = window.setTimeout(() => {
      this.hideToast()
    }, 2000)
  }

  private hideToast = (remove = false) => {
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer)
      this.toastTimer = null
    }
    if (!this.toastEl) {
      return
    }
    this.toastEl.classList.remove('is-visible')
    if (remove) {
      this.toastEl.remove()
      this.toastEl = null
    }
  }

  private notifyError = (action: string) => {
    const template = this.callbacks.texts.error || 'Image action failed: {message}'
    this.showToast(template.replace('{message}', action), 'error')
    this.callbacks.onError?.(action)
  }

  private downloadImage = async (imageDescriptor: ImageDescriptor, pswp: PhotoSwipe) => {
    try {
      const rotationDegree = this.getSlideRotationDegree(pswp)
      const { source, matrix } = await this.resolveExportSource(
        imageDescriptor,
        rotationDegree
      )
      const blobObject = await getBlob(source, matrix)
      const fileName = getFileName(imageDescriptor.imageUrl + blobObject.extension)
      await this.callbacks.downloadFile(fileName, blobObject.data)
      this.showToast(this.callbacks.texts.downloaded)
      this.callbacks.onDownloadSuccess?.()
    } catch {
      this.notifyError('download')
    }
  }

  private copyImage = async (imageDescriptor: ImageDescriptor, pswp: PhotoSwipe) => {
    try {
      const rotationDegree = this.getSlideRotationDegree(pswp)
      const { source, matrix } = await this.resolveExportSource(
        imageDescriptor,
        rotationDegree
      )
      clearPendingPdfImageRef()
      await copyImageToClipboard(source, matrix)
      this.showToast(this.callbacks.texts.copied)
      this.callbacks.onCopySuccess?.()
    } catch {
      this.notifyError('copy')
    }
  }

  private copyImageReference = async (
    imageDescriptor: ImageDescriptor,
    pswp: PhotoSwipe,
  ) => {
    try {
      const linkSource = this.callbacks.getLinkSource?.() ?? null
      if (!linkSource?.pdfFile) {
        this.notifyError('copyReference')
        return
      }
      const rotationDegree = this.getSlideRotationDegree(pswp)
      const { source, matrix } = await this.resolveExportSource(
        imageDescriptor,
        rotationDegree,
      )
      const blobObject = await getBlob(source, matrix)
      const pageNumber = this.resolvePageNumber(imageDescriptor.docUrl ?? '')
      await stagePdfImageRefCopy({
        pngBlob: blobObject.data,
        pdfFile: linkSource.pdfFile,
        pageNumber,
        kind: 'embed',
        nameHint: imageDescriptor.imageRefId || imageDescriptor.imageUrl,
        rect: this.callbacks.resolveImageRect?.(imageDescriptor, pageNumber),
      })
      this.showToast(this.callbacks.texts.referenceCopied)
      this.callbacks.onCopyReferenceSuccess?.()
    } catch {
      this.notifyError('copyReference')
    }
  }

  private loadImage = async (imageDescriptor: ImageDescriptor) => {
    if (!imageDescriptor) return

    let requestImageUrl = imageDescriptor.accessibleImageUrl
    let width = imageDescriptor.width
    let height = imageDescriptor.height

    if (!requestImageUrl || !width || !height) {
      const imageData = await this.imageSource.getImage(
        this.resolvePageNumber(imageDescriptor.docUrl ?? ''),
        imageDescriptor.imageUrl
      )
      if (!imageData) {
        this.notifyError('load')
        return
      }

      const blobObject = await createBlobUrl(imageData)
      requestImageUrl = blobObject.url
      width = blobObject.width
      height = blobObject.height
    }

    if ((!width || !height) && requestImageUrl) {
      const imageSize = await getImageSize(requestImageUrl)
      width = imageSize.width
      height = imageSize.height
    }

    if (!requestImageUrl || !width || !height) {
      this.notifyError('load')
      return
    }

    imageDescriptor.accessibleImageUrl = requestImageUrl
    imageDescriptor.width = width
    imageDescriptor.height = height

    if (this.lightbox?.options?.dataSource) {
      this.lightbox.options.dataSource[0] = this.buildImageSource(imageDescriptor)
      this.lightbox.pswp?.refreshSlideContent(0)
    }
  }

  private disposeCurrentImage = () => {
    const imageDescriptor = this.imageDescriptors[0]
    if (!imageDescriptor?.accessibleImageUrl) return
    if (imageDescriptor.accessibleImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageDescriptor.accessibleImageUrl)
      imageDescriptor.accessibleImageUrl = undefined
    }
  }

  isOpen = () => !!this.lightbox?.pswp?.isOpen

  close = () => {
    this.lightbox?.pswp?.close()
  }

  private rotate = (pswp: PhotoSwipe, degree: number) => {
    const currSlide = pswp.currSlide
    if (!currSlide?.isActive || currSlide.content?.state !== 'loaded') return

    const img = currSlide.content.element as HTMLElement
    let existDegree = Number.parseInt(img.getAttribute('degree') ?? '0', 10)
    if (Number.isNaN(existDegree)) {
      existDegree = 0
    }

    degree = existDegree + degree
    img.setAttribute('degree', degree.toString())
    img.setAttribute(AnimationClassName, 'rotate-image-animation')
    img.addEventListener('transitionend', this.removeElementAnimation, { once: true })
    img.classList.add('rotate-image-animation')

    const h =
      degree % 180 === 0
        ? currSlide.content.displayedImageHeight
        : currSlide.content.displayedImageWidth
    const w =
      degree % 180 === 0
        ? currSlide.content.displayedImageWidth
        : currSlide.content.displayedImageHeight

    let scalePercentage = 1
    if (h > currSlide.panAreaSize.y) {
      scalePercentage = currSlide.panAreaSize.y / h
    } else if (w > currSlide.panAreaSize.x) {
      scalePercentage = currSlide.panAreaSize.x / w
    }

    const scale = degree === 180 ? '' : ` scale(${scalePercentage})`
    const flipTransform = img.dataset.pdfFlipTransform ?? ''
    img.style.transform = `${flipTransform} rotate(${degree}deg)${scale}`.trim()
  }

  private removeElementAnimation = (event: TransitionEvent) => {
    const className = (event.currentTarget as Element).getAttribute(AnimationClassName)
    if (!isNullOrWhiteSpace(className)) {
      ;(event.currentTarget as Element).classList.remove(className)
    }
  }

  private beforePointerMove = () => {
    const iframes = document.getElementsByTagName('iframe')
    for (let i = 0; i < iframes.length; i++) {
      iframes[i].classList.add('foxycape-pdf-iframe-no-pointer-events')
    }
  }

  private afterPointerMove = () => {
    const iframes = document.getElementsByTagName('iframe')
    for (let i = 0; i < iframes.length; i++) {
      iframes[i].classList.remove('foxycape-pdf-iframe-no-pointer-events')
    }
  }

  async show(imageDescriptor: ImageDescriptor): Promise<void> {
    if (!this.lightbox) {
      await this.initialize()
    }
    if (!this.lightbox) return

    this.disposeCurrentImage()
    this.imageDescriptors = [imageDescriptor]

    if (!this.lightbox.options.dataSource) {
      this.lightbox.options.dataSource = []
    }
    const dataSource = this.lightbox.options.dataSource as ImageSlideData[]
    dataSource.splice(0, dataSource.length, this.buildInitialSlideData(imageDescriptor))

    const loadTask = this.loadImage(imageDescriptor)

    if (this.lightbox.pswp?.isOpen) {
      this.lightbox.pswp.goTo(0)
    } else {
      this.lightbox.loadAndOpen(0)
    }

    await loadTask
  }

  async dispose(): Promise<void> {
    this.hideToast(true)
    this.disposeCurrentImage()
    window.removeEventListener('resize', this.onWindowResize)
    this.resizeObserver.disconnect()
    if (this.lightbox) {
      this.lightbox.destroy()
      this.lightbox = null
    }
    this.imageDescriptors = []
    this.initialized = false
  }
}
