import type { ImageDescriptor } from '@foxycape/core/kernal'

/** Canvas bag fields used by PDF render / image extraction monkeypatches. */
export type PdfAugmentedCanvasContext = CanvasRenderingContext2D & {
  originalFill?: typeof CanvasRenderingContext2D.prototype.fill
  originalFillRect?: typeof CanvasRenderingContext2D.prototype.fillRect
  originalFillText?: typeof CanvasRenderingContext2D.prototype.fillText
  originalStroke?: typeof CanvasRenderingContext2D.prototype.stroke
  originalStrokeRect?: typeof CanvasRenderingContext2D.prototype.strokeRect
  originalStrokeText?: typeof CanvasRenderingContext2D.prototype.strokeText
  originalDrawImage?: typeof CanvasRenderingContext2D.prototype.drawImage
  objId?: string
  page?: number | string
  originalWidth?: number
  originalHeight?: number
  imageDescriptors?: ImageDescriptor[] | null
  handled?: number | boolean
}

/** Rest args for hooked drawImage (overloads collapse poorly under Parameters<>). */
export type DrawImageArgs = [CanvasImageSource, ...number[]]

const HANDLED_KEY = 'handled' as const

export const asAugmentedCanvasContext = (
  ctx: CanvasRenderingContext2D,
): PdfAugmentedCanvasContext => ctx as PdfAugmentedCanvasContext

export const markCanvasContextHandled = (
  canvasContext: CanvasRenderingContext2D,
): boolean => {
  const ctx = asAugmentedCanvasContext(canvasContext)
  if (ctx.handled) {
    return true
  }
  ctx.handled = 1
  return false
}

export const storeBoundOriginal = <K extends keyof PdfAugmentedCanvasContext>(
  ctx: PdfAugmentedCanvasContext,
  originalKey: K,
  method: PdfAugmentedCanvasContext[K],
): void => {
  if (typeof method !== 'function') {
    return
  }
  ;(ctx as unknown as Record<string, unknown>)[originalKey as string] = (
    method as (...args: unknown[]) => unknown
  ).bind(ctx)
}

export const callOriginalDrawImage = (
  ctx: PdfAugmentedCanvasContext,
  args: DrawImageArgs,
): void => {
  const original = ctx.originalDrawImage
  if (!original) {
    return
  }
  ;(original as (...drawArgs: DrawImageArgs) => void)(...args)
}
