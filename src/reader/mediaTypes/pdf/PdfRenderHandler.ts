import type { IDisposable, Reader, Theme } from '@core/kernal'
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
    handleOptions = Object.assign(new PdfRenderHandleOptions(), handleOptions)

    if (handleOptions.handleFillText) {
      ; (canvasContext as any)['originalFillText'] = canvasContext.fillText
      canvasContext.fillText = (...args: any[]) => {
        if (!this.isColorRemapEnabled()) {
          ; (canvasContext as any)['originalFillText'](...args)
          return
        }
        canvasContext.save()
        try {
          canvasContext.fillStyle = debug ? 'red' : this.resolveTextColor()
            ; (canvasContext as any)['originalFillText'](...args)
        } finally {
          canvasContext.restore()
        }
      }
    }

    if (handleOptions.handleStrokeText) {
      ; (canvasContext as any)['originalStrokeText'] = canvasContext.strokeText
      canvasContext.strokeText = (...args: any[]) => {
        if (!this.isColorRemapEnabled()) {
          ; (canvasContext as any)['originalStrokeText'](...args)
          return
        }
        canvasContext.save()
        try {
          canvasContext.strokeStyle = debug ? 'purple' : this.resolveTextColor()
            ; (canvasContext as any)['originalStrokeText'](...args)
        } finally {
          canvasContext.restore()
        }
      }
    }

    if (handleOptions.handleFill) {
      ; (canvasContext as any)['originalFill'] = canvasContext.fill
      canvasContext.fill = (...args: any[]) => {
        if (!this.isColorRemapEnabled()) {
          ; (canvasContext as any)['originalFill'](...args)
          return
        }
        canvasContext.save()
        try {
          if (canvasContext.fillStyle == '#ffffff' || canvasContext.fillStyle == '#fff') {
            canvasContext.fillStyle = debug
              ? 'orange'
              : this.resolvePdfFillBackground()
          }
          ; (canvasContext as any)['originalFill'](...args)
        } finally {
          canvasContext.restore()
        }
      }
    }

    if (handleOptions.handleFillRect) {
      ; (canvasContext as any)['originalFillRect'] = canvasContext.fillRect
      canvasContext.fillRect = (...args: any[]) => {
        if (!this.isColorRemapEnabled()) {
          ; (canvasContext as any)['originalFillRect'](...args)
          return
        }
        canvasContext.save()
        try {
          if (canvasContext.fillStyle == '#ffffff' || canvasContext.fillStyle == '#fff') {
            canvasContext.fillStyle = debug
              ? 'pink'
              : (this.theme?.contentBackground ?? '#fff')
          }
          ; (canvasContext as any)['originalFillRect'](...args)
        } finally {
          canvasContext.restore()
        }
      }
    }

    if (handleOptions.handleStroke) {
      ; (canvasContext as any)['originalStroke'] = canvasContext.stroke
      canvasContext.stroke = (...args: any[]) => {
        if (!this.isColorRemapEnabled()) {
          ; (canvasContext as any)['originalStroke'](...args)
          return
        }
        canvasContext.save()
        try {
          canvasContext.strokeStyle = debug
            ? 'blue'
            : this.resolvePdfFillBackground()
            ; (canvasContext as any)['originalStroke'](...args)
        } finally {
          canvasContext.restore()
        }
      }
    }

    if (handleOptions.handleStrokeRect) {
      ; (canvasContext as any)['originalStrokeRect'] = canvasContext.strokeRect
      canvasContext.strokeRect = (...args: any[]) => {
        if (!this.isColorRemapEnabled()) {
          ; (canvasContext as any)['originalStrokeRect'](...args)
          return
        }
        canvasContext.save()
        try {
          canvasContext.strokeStyle = debug
            ? 'green'
            : this.resolvePdfFillBackground()
            ; (canvasContext as any)['originalStrokeRect'](...args)
        } finally {
          canvasContext.restore()
        }
      }
    }

    if (handleOptions.handleDrawImage) {
      ; (canvasContext as any)['originalDrawImage'] = canvasContext.drawImage
      canvasContext.drawImage = (...args: any[]) => {
        this.handleImages(
          canvasContext,
          pageOriginWidth,
          pageOriginHeight,
          colorThreshold,
          handleOptions!,
          ...args,
        )
      }
    }
  }

  private handleImages = (
    canvasContext: CanvasRenderingContext2D,
    pageOriginWidth: number,
    pageOriginHeight: number,
    colorThreshold: number,
    handleOptions: PdfRenderHandleOptions,
    ...args: any[]
  ) => {
    if (!handleOptions.imageMinWidth) {
      handleOptions.imageMinWidth = this.minWidth
    }
    if (!handleOptions.imageMinHeight) {
      handleOptions.imageMinHeight = this.minHeight
    }
    buildImageDescriptors(
      canvasContext,
      pageOriginWidth,
      pageOriginHeight,
      handleOptions,
      ...args,
    )
    if (!this.isColorRemapEnabled()) {
      ; (canvasContext as any)['originalDrawImage'](...args)
      return
    }
    canvasContext.save()
    try {
      let isGrayscale = false
      let isWhiteBackground = false
      if (args[0] instanceof HTMLCanvasElement) {
        const childCanvas = args[0] as HTMLCanvasElement
        const childCanvasContext = childCanvas.getContext('2d')
        if (childCanvasContext) {
          const imageData = childCanvasContext.getImageData(
            0,
            0,
            args[0].width,
            args[0].height,
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
        args[0] instanceof OffscreenCanvas
      ) {
        const childCanvas = args[0] as OffscreenCanvas
        const childCanvasContext = childCanvas.getContext('2d')
        if (childCanvasContext) {
          const imageData = childCanvasContext.getImageData(
            0,
            0,
            childCanvas.width,
            childCanvas.height,
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
        canvasContext.filter = 'invert(87%)'
          ; (canvasContext as any)['originalDrawImage'](...args)
      } else {
        ; (canvasContext as any)['originalDrawImage'](...args)
      }
    } finally {
      canvasContext.restore()
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
