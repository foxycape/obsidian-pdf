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

const HANDLED_KEY: keyof Pick<PdfAugmentedCanvasContext, 'handled'> = 'handled'

export const asAugmentedCanvasContext = (
  ctx: CanvasRenderingContext2D,
): PdfAugmentedCanvasContext => ctx

export const markCanvasContextHandled = (
  canvasContext: CanvasRenderingContext2D,
): boolean => {
  const ctx = asAugmentedCanvasContext(canvasContext)
  if (ctx[HANDLED_KEY]) {
    return true
  }
  ctx[HANDLED_KEY] = 1
  return false
}

type OriginalMethodKey =
  | 'originalFill'
  | 'originalFillRect'
  | 'originalFillText'
  | 'originalStroke'
  | 'originalStrokeRect'
  | 'originalStrokeText'
  | 'originalDrawImage'

const ORIGINAL_METHOD_NAMES = {
  originalFill: 'fill',
  originalFillRect: 'fillRect',
  originalFillText: 'fillText',
  originalStroke: 'stroke',
  originalStrokeRect: 'strokeRect',
  originalStrokeText: 'strokeText',
  originalDrawImage: 'drawImage',
} as const satisfies Record<OriginalMethodKey, keyof CanvasRenderingContext2D>

/** Capture a canvas method onto `ctx` already bound to that context. */
export const storeBoundOriginal = (
  ctx: PdfAugmentedCanvasContext,
  originalKey: OriginalMethodKey,
): void => {
  const methodName = ORIGINAL_METHOD_NAMES[originalKey]
  ;(ctx as unknown as Record<string, unknown>)[originalKey] =
    CanvasRenderingContext2D.prototype[methodName].bind(ctx)
}

export const callOriginalDrawImage = (
  ctx: PdfAugmentedCanvasContext,
  args: DrawImageArgs,
): void => {
  const original = ctx.originalDrawImage
  if (!original) {
    return
  }
  original.apply(ctx, args)
}
