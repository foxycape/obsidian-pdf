import type { IDisposable, Reader, Theme } from '@foxycape/core/kernal'
import {
  asAugmentedCanvasContext,
  callOriginalDrawImage,
  type DrawImageArgs,
  type PdfAugmentedCanvasContext,
} from './canvasContextHooks'
import { getColorOptions } from './colorUtils'
import type { CustomPdfOptions } from './CustomPdfOptions'
import {
  buildImageDescriptors,
  markCanvasContextHandled,
} from './image/pdfImageHandler'
import { PdfRenderHandleOptions } from './image/PdfRenderHandleOptions'

type ThemeWithPdfFill = Theme & { pdfFillBackground?: string }

/**
 * Hooks canvas 2d drawing to remap PDF page colors to the reader theme.
 * Ported from linghuxiong PdfRenderHandler.
 */
export class PdfRenderHandler implements IDisposable {
  private theme: ThemeWithPdfFill | undefined
  private contentBgColors: number[] = []
  private contentTextColor = 'inherit'
  private readonly minWidth: number
  private readonly minHeight: number

  constructor(
    private readonly reader: Reader,
    private readonly options: CustomPdfOptions,
  ) {
    this.minWidth = Math.max(50, this.options.imageMinWidth ?? 100)
    this.minHeight = Math.max(50, this.options.imageMinHeight ?? 100)
  }

  async setTheme(theme: Theme) {
    this.theme = theme
    this.contentTextColor = theme.contentTextColor || 'inherit'
    const { r, g, b, alpha } = getColorOptions(theme.contentBackground)
    this.contentBgColors = [r * 255, g * 255, b * 255, alpha * 255]
  }

  async initialize() {
    const themeProvider = await this.reader.services.get('themeProvider', false)
    const theme = themeProvider?.getCurrentTheme?.()
    if (theme) {
      await this.setTheme(theme)
    }
  }

  private isColorRemapEnabled = () => {
    if (!this.theme || !this.options.enablePdfThemeColorRemap) {
      return false
    }
    if (this.theme.colorMode === 'light' && this.options.pdfThemeColorRemapMode === 'dark') {
      return false
    }
    return true
  }

  private resolvePdfFillBackground = () => {
    return (
      this.theme?.pdfFillBackground ||
      this.theme?.contentBackground ||
      '#fff'
    )
  }

  private resolveTextColor = () => {
    return this.contentTextColor === 'inherit' ? '#222222' : this.contentTextColor
  }

  handle(
    canvasContext: CanvasRenderingContext2D,
    pageOriginWidth: number,
    pageOriginHeight: number,
    handleOptions?: PdfRenderHandleOptions,
  ) {
    if (markCanvasContextHandled(canvasContext)) {
      return
    }
    const debug = false
    const colorThreshold = 0.9
    const opts = Object.assign(new PdfRenderHandleOptions(), handleOptions)
    const ctx = asAugmentedCanvasContext(canvasContext)

    if (opts.handleFillText) {
      ctx.originalFillText = canvasContext.fillText.bind(canvasContext)
      canvasContext.fillText = ((...args: Parameters<CanvasRenderingContext2D['fillText']>) => {
        if (!this.isColorRemapEnabled()) {
          ctx.originalFillText?.(...args)
          return
        }
        canvasContext.save()
        try {
          canvasContext.fillStyle = debug ? 'red' : this.resolveTextColor()
          ctx.originalFillText?.(...args)
        } finally {
          canvasContext.restore()
        }
      }) as typeof canvasContext.fillText
    }

    if (opts.handleStrokeText) {
      ctx.originalStrokeText = canvasContext.strokeText.bind(canvasContext)
      canvasContext.strokeText = ((
        ...args: Parameters<CanvasRenderingContext2D['strokeText']>
      ) => {
        if (!this.isColorRemapEnabled()) {
          ctx.originalStrokeText?.(...args)
          return
        }
        canvasContext.save()
        try {
          canvasContext.strokeStyle = debug ? 'purple' : this.resolveTextColor()
          ctx.originalStrokeText?.(...args)
        } finally {
          canvasContext.restore()
        }
      }) as typeof canvasContext.strokeText
    }

    if (opts.handleFill) {
      ctx.originalFill = canvasContext.fill.bind(canvasContext)
      canvasContext.fill = ((...args: Parameters<CanvasRenderingContext2D['fill']>) => {
        if (!this.isColorRemapEnabled()) {
          ctx.originalFill?.(...args)
          return
        }
        canvasContext.save()
        try {
          if (canvasContext.fillStyle == '#ffffff' || canvasContext.fillStyle == '#fff') {
            canvasContext.fillStyle = debug
              ? 'orange'
              : this.resolvePdfFillBackground()
          }
          ctx.originalFill?.(...args)
        } finally {
          canvasContext.restore()
        }
      }) as typeof canvasContext.fill
    }

    if (opts.handleFillRect) {
      ctx.originalFillRect = canvasContext.fillRect.bind(canvasContext)
      canvasContext.fillRect = ((
        ...args: Parameters<CanvasRenderingContext2D['fillRect']>
      ) => {
        if (!this.isColorRemapEnabled()) {
          ctx.originalFillRect?.(...args)
          return
        }
        canvasContext.save()
        try {
          if (canvasContext.fillStyle == '#ffffff' || canvasContext.fillStyle == '#fff') {
            canvasContext.fillStyle = debug
              ? 'pink'
              : (this.theme?.contentBackground ?? '#fff')
          }
          ctx.originalFillRect?.(...args)
        } finally {
          canvasContext.restore()
        }
      }) as typeof canvasContext.fillRect
    }

    if (opts.handleStroke) {
      ctx.originalStroke = canvasContext.stroke.bind(canvasContext)
      canvasContext.stroke = ((...args: Parameters<CanvasRenderingContext2D['stroke']>) => {
        if (!this.isColorRemapEnabled()) {
          ctx.originalStroke?.(...args)
          return
        }
        canvasContext.save()
        try {
          canvasContext.strokeStyle = debug
            ? 'blue'
            : this.resolvePdfFillBackground()
          ctx.originalStroke?.(...args)
        } finally {
          canvasContext.restore()
        }
      }) as typeof canvasContext.stroke
    }

    if (opts.handleStrokeRect) {
      ctx.originalStrokeRect = canvasContext.strokeRect.bind(canvasContext)
      canvasContext.strokeRect = ((
        ...args: Parameters<CanvasRenderingContext2D['strokeRect']>
      ) => {
        if (!this.isColorRemapEnabled()) {
          ctx.originalStrokeRect?.(...args)
          return
        }
        canvasContext.save()
        try {
          canvasContext.strokeStyle = debug
            ? 'green'
            : this.resolvePdfFillBackground()
          ctx.originalStrokeRect?.(...args)
        } finally {
          canvasContext.restore()
        }
      }) as typeof canvasContext.strokeRect
    }

    if (opts.handleDrawImage) {
      ctx.originalDrawImage = canvasContext.drawImage.bind(canvasContext)
      canvasContext.drawImage = ((...args: DrawImageArgs) => {
        this.handleImages(
          ctx,
          pageOriginWidth,
          pageOriginHeight,
          colorThreshold,
          opts,
          args,
        )
      }) as typeof canvasContext.drawImage
    }
  }

  private handleImages = (
    ctx: PdfAugmentedCanvasContext,
    pageOriginWidth: number,
    pageOriginHeight: number,
    colorThreshold: number,
    handleOptions: PdfRenderHandleOptions,
    args: DrawImageArgs,
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
    if (!this.isColorRemapEnabled()) {
      callOriginalDrawImage(ctx, args)
      return
    }
    ctx.save()
    try {
      let isGrayscale = false
      let isWhiteBackground = false
      const source = args[0]
      if (source instanceof HTMLCanvasElement) {
        const childCanvasContext = source.getContext('2d')
        if (childCanvasContext) {
          const imageData = childCanvasContext.getImageData(
            0,
            0,
            source.width,
            source.height,
          )
          const data = imageData.data
          const result = this.checkIsWhiteBlankImage(data, colorThreshold)
          isGrayscale = result.isGrayscale
          isWhiteBackground = result.isWhiteBackground
          if (isWhiteBackground && this.theme?.colorMode != 'dark') {
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i]
              const g = data[i + 1]
              const b = data[i + 2]
              if (r >= 250 && g >= 250 && b >= 250) {
                data[i] = this.contentBgColors[0]
                data[i + 1] = this.contentBgColors[1]
                data[i + 2] = this.contentBgColors[2]
                data[i + 3] = this.contentBgColors[3]
              }
            }
            childCanvasContext.putImageData(imageData, 0, 0)
          }
        }
      } else if (
        typeof OffscreenCanvas !== 'undefined' &&
        source instanceof OffscreenCanvas
      ) {
        const childCanvasContext = source.getContext('2d')
        if (childCanvasContext) {
          const imageData = childCanvasContext.getImageData(
            0,
            0,
            source.width,
            source.height,
          )
          const data = imageData.data
          const result = this.checkIsWhiteBlankImage(data, colorThreshold)
          isGrayscale = result.isGrayscale
          isWhiteBackground = result.isWhiteBackground
          if (isWhiteBackground && this.theme?.colorMode != 'dark') {
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i]
              const g = data[i + 1]
              const b = data[i + 2]
              if (r > 250 && g > 250 && b > 250) {
                data[i + 3] = 0
              }
            }
            childCanvasContext.putImageData(imageData, 0, 0)
          }
        }
      }

      if (isGrayscale && this.theme?.colorMode == 'dark') {
        ctx.filter = 'invert(87%)'
      }
      callOriginalDrawImage(ctx, args)
    } finally {
      ctx.restore()
    }
  }

  private checkIsWhiteBlankImage(
    data: Uint8ClampedArray,
    threshold: number,
  ): { isGrayscale: boolean; isWhiteBackground: boolean } {
    let colorCount = data.length / 4
    let step = 1
    if (colorCount > 100) {
      step = Math.floor(colorCount / 100)
      colorCount = 100
    }
    let grayscalePointCount = 0
    let whiteBgPointCount = 0
    for (let i = 0; i < colorCount; i++) {
      const start = Math.round(i * 4 * step)
      const rgb = data[start] + data[start + 1] + data[start + 2]
      if (rgb <= 255) {
        grayscalePointCount++
      } else if (rgb >= 750) {
        grayscalePointCount++
        whiteBgPointCount++
      }
    }
    return {
      isGrayscale: grayscalePointCount / colorCount > threshold,
      isWhiteBackground: whiteBgPointCount / colorCount > threshold,
    }
  }

  async dispose() {
    if (this.contentBgColors) {
      this.contentBgColors.splice(0)
    }
    this.theme = undefined
  }
}
