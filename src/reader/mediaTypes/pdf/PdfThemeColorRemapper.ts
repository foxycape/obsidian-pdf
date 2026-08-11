import type { IDisposable, Reader, Theme } from '@foxycape/core/kernal'
import { LabColor } from './color/LabColor'
import type { CustomPdfOptions } from './CustomPdfOptions'
import {
  buildImageDescriptors,
  markCanvasContextHandled,
} from './image/pdfImageHandler'
import { PdfRenderHandleOptions } from './image/PdfRenderHandleOptions'

const CHROMA_THRESHOLD = 10
/** ~10% uniform pixel sampling for grayscale detection. */
const IMAGE_SAMPLE_RATIO = 0.1
const GRAYSCALE_CHANNEL_TOLERANCE = 12
const GRAYSCALE_RATIO_THRESHOLD = 0.9
const DARK_GRAYSCALE_INVERT_FILTER = 'invert(87%)'
const DEFAULT_FG = '#222222'

type ToneGradient = (p: number) => LabColor

type CanvasContextHooks = CanvasRenderingContext2D & {
  originalFill?: typeof CanvasRenderingContext2D.prototype.fill
  originalFillRect?: typeof CanvasRenderingContext2D.prototype.fillRect
  originalFillText?: typeof CanvasRenderingContext2D.prototype.fillText
  originalStroke?: typeof CanvasRenderingContext2D.prototype.stroke
  originalStrokeRect?: typeof CanvasRenderingContext2D.prototype.strokeRect
  originalStrokeText?: typeof CanvasRenderingContext2D.prototype.strokeText
  originalDrawImage?: typeof CanvasRenderingContext2D.prototype.drawImage
}

/**
 * Remaps PDF page canvas colors to the reader theme (doq-inspired).
 * - Greyscale vector colors → CIELAB interpolate between content bg/fg
 * - Chromatic vector colors → kept as-is
 * - Color images → always original
 * - Grayscale images → invert in dark theme only
 */
export class PdfThemeColorRemapper implements IDisposable {
  private theme: Theme | undefined
  private isRemapActive = false
  private gradient: ToneGradient | undefined
  private readonly styleCache = new Map<string, string>()
  private readonly minWidth: number
  private readonly minHeight: number

  constructor(
    private readonly reader: Reader,
    private readonly options: CustomPdfOptions,
  ) {
    this.minWidth = Math.max(50, this.options.imageMinWidth ?? 100)
    this.minHeight = Math.max(50, this.options.imageMinHeight ?? 100)
  }

  initialize = async () => {
    const themeProvider = await this.reader.services.get('themeProvider', false)
    const theme = themeProvider?.getCurrentTheme?.()
    if (theme) {
      this.setTheme(theme)
    }
  }

  setTheme = (theme: Theme) => {
    this.theme = theme
    this.styleCache.clear()

    const bgRaw = theme.contentBackground || '#ffffff'
    let fgRaw = theme.contentTextColor || DEFAULT_FG
    if (fgRaw === 'inherit') {
      fgRaw = DEFAULT_FG
    }

    const bg = new LabColor(bgRaw)
    const fg = new LabColor(fgRaw)
    this.gradient = bg.range(fg)
    this.isRemapActive = this.resolveIsRemapActive()
  }

  /** Re-evaluate active state after options change (without a theme change). */
  refreshActiveState = () => {
    this.styleCache.clear()
    this.isRemapActive = this.resolveIsRemapActive()
  }

  handle = (
    canvasContext: CanvasRenderingContext2D,
    pageOriginWidth: number,
    pageOriginHeight: number,
    handleOptions?: PdfRenderHandleOptions,
  ) => {
    if (markCanvasContextHandled(canvasContext)) {
      return
    }
    const opts = Object.assign(new PdfRenderHandleOptions(), handleOptions)
    const ctx = canvasContext as CanvasContextHooks

    if (opts.handleFillText) {
      this.wrapPaint(ctx, 'fillText', 'fillStyle')
    }
    if (opts.handleStrokeText) {
      this.wrapPaint(ctx, 'strokeText', 'strokeStyle')
    }
    if (opts.handleFill) {
      this.wrapPaint(ctx, 'fill', 'fillStyle')
    }
    if (opts.handleFillRect) {
      this.wrapPaint(ctx, 'fillRect', 'fillStyle')
    }
    if (opts.handleStroke) {
      this.wrapPaint(ctx, 'stroke', 'strokeStyle')
    }
    if (opts.handleStrokeRect) {
      this.wrapPaint(ctx, 'strokeRect', 'strokeStyle')
    }
    if (opts.handleDrawImage) {
      ctx.originalDrawImage = canvasContext.drawImage.bind(canvasContext)
      canvasContext.drawImage = ((...args: any[]) => {
        this.handleDrawImage(
          ctx,
          pageOriginWidth,
          pageOriginHeight,
          opts,
          args,
        )
      }) as typeof canvasContext.drawImage
    }
  }

  dispose = async () => {
    this.theme = undefined
    this.gradient = undefined
    this.isRemapActive = false
    this.styleCache.clear()
  }

  private resolveIsRemapActive = (): boolean => {
    if (!this.theme || !this.options.enablePdfThemeColorRemap || !this.gradient) {
      return false
    }
    const mode = this.options.pdfThemeColorRemapMode ?? 'both'
    if (mode === 'both') {
      return true
    }
    if (mode === 'dark') {
      return this.theme.colorMode === 'dark'
    }
    if (mode === 'light') {
      return this.theme.colorMode === 'light'
    }
    return true
  }

  private remapStyle = (style: string | CanvasGradient | CanvasPattern): string | null => {
    if (typeof style !== 'string') {
      return null
    }
    const cached = this.styleCache.get(style)
    if (cached != null) {
      return cached
    }
    const color = LabColor.tryParse(style)
    if (!color || !this.gradient) {
      return null
    }
    // Chromatic colors stay original.
    if (color.chroma > CHROMA_THRESHOLD) {
      this.styleCache.set(style, style)
      return style
    }
    const whiteL = LabColor.white.lightness || 100
    const remapped = this.gradient(1 - color.lightness / whiteL)
    const result = remapped.toHex(color.alpha)
    this.styleCache.set(style, result)
    return result
  }

  private wrapPaint = (
    ctx: CanvasContextHooks,
    methodName:
      | 'fill'
      | 'fillRect'
      | 'fillText'
      | 'stroke'
      | 'strokeRect'
      | 'strokeText',
    styleProp: 'fillStyle' | 'strokeStyle',
  ) => {
    const originalKey = `original${methodName[0].toUpperCase()}${methodName.slice(1)}` as
      | 'originalFill'
      | 'originalFillRect'
      | 'originalFillText'
      | 'originalStroke'
      | 'originalStrokeRect'
      | 'originalStrokeText'
    const original = (ctx[methodName] as Function).bind(ctx)
    ;(ctx as any)[originalKey] = original

    ;(ctx as any)[methodName] = (...args: any[]) => {
      if (!this.isRemapActive) {
        return original(...args)
      }
      const current = ctx[styleProp]
      const remapped = this.remapStyle(current)
      if (remapped == null || remapped === current) {
        return original(...args)
      }
      ctx.save()
      try {
        ctx[styleProp] = remapped
        return original(...args)
      } finally {
        ctx.restore()
      }
    }
  }

  private handleDrawImage = (
    ctx: CanvasContextHooks,
    pageOriginWidth: number,
    pageOriginHeight: number,
    handleOptions: PdfRenderHandleOptions,
    args: any[],
  ) => {
    if (!handleOptions.imageMinWidth) {
      handleOptions.imageMinWidth = this.minWidth
    }
    if (!handleOptions.imageMinHeight) {
      handleOptions.imageMinHeight = this.minHeight
    }
    buildImageDescriptors(
      ctx,
      pageOriginWidth,
      pageOriginHeight,
      handleOptions,
      ...args,
    )

    const original = ctx.originalDrawImage as
      | ((...drawArgs: any[]) => void)
      | undefined
    if (!original) {
      return
    }
    if (!this.isRemapActive) {
      original(...args)
      return
    }

    const isDark = this.theme?.colorMode === 'dark'
    if (!isDark) {
      original(...args)
      return
    }

    const source = args[0]
    const isGrayscale = this.isGrayscaleImageSource(source)
    if (!isGrayscale) {
      // Color images always stay original.
      original(...args)
      return
    }

    ctx.save()
    try {
      ctx.filter = DARK_GRAYSCALE_INVERT_FILTER
      original(...args)
    } finally {
      ctx.restore()
    }
  }

  private isGrayscaleImageSource = (source: unknown): boolean => {
    const size = this.getImageSourceSize(source)
    if (!size) {
      return false
    }
    const { width, height } = size
    if (width <= 0 || height <= 0) {
      return false
    }

    try {
      const imageData = this.readImageData(source, width, height)
      if (!imageData) {
        return false
      }
      return this.sampleIsGrayscale(imageData.data)
    } catch {
      // Tainted / unsupported source — treat as color (do not invert).
      return false
    }
  }

  private getImageSourceSize = (
    source: unknown,
  ): { width: number; height: number } | null => {
    if (source instanceof HTMLCanvasElement) {
      return { width: source.width, height: source.height }
    }
    if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
      return { width: source.width, height: source.height }
    }
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
      return { width: source.width, height: source.height }
    }
    if (source instanceof HTMLImageElement) {
      return {
        width: source.naturalWidth || source.width,
        height: source.naturalHeight || source.height,
      }
    }
    return null
  }

  private readImageData = (
    source: unknown,
    width: number,
    height: number,
  ): ImageData | null => {
    if (source instanceof HTMLCanvasElement) {
      const c = source.getContext('2d')
      return c?.getImageData(0, 0, width, height) ?? null
    }
    if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
      const c = source.getContext('2d')
      if (!c || typeof (c as OffscreenCanvasRenderingContext2D).getImageData !== 'function') {
        return null
      }
      return (c as OffscreenCanvasRenderingContext2D).getImageData(0, 0, width, height)
    }

    // ImageBitmap / HTMLImageElement: copy to a temp canvas for sampling.
    const temp = document.createElement('canvas')
    temp.width = width
    temp.height = height
    const tempCtx = temp.getContext('2d')
    if (!tempCtx) {
      return null
    }
    tempCtx.drawImage(source as CanvasImageSource, 0, 0)
    return tempCtx.getImageData(0, 0, width, height)
  }

  /**
   * Uniformly sample ~10% of pixels; grayscale if most samples have
   * near-equal RGB channels (low chroma).
   */
  private sampleIsGrayscale = (data: Uint8ClampedArray): boolean => {
    const pixelCount = data.length / 4
    if (pixelCount <= 0) {
      return false
    }
    const step = pixelCount <= 10 ? 1 : Math.max(1, Math.floor(1 / IMAGE_SAMPLE_RATIO))
    let sampled = 0
    let grayscaleCount = 0

    for (let i = 0; i < pixelCount; i += step) {
      const offset = i * 4
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      const a = data[offset + 3]
      sampled++
      // Skip fully transparent pixels.
      if (a < 8) {
        grayscaleCount++
        continue
      }
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (max - min <= GRAYSCALE_CHANNEL_TOLERANCE) {
        grayscaleCount++
      }
    }

    if (sampled === 0) {
      return false
    }
    return grayscaleCount / sampled >= GRAYSCALE_RATIO_THRESHOLD
  }
}
