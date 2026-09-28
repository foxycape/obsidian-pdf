import type { MarkStyleName } from '@/mark/types'

export type MarkWritingMode = 'horizontal-tb' | 'horizontal-bt' | 'vertical-lr' | 'vertical-rl'

type InkEdge = 'bottom' | 'left' | 'top' | 'right'

const INK_EDGES_CW: InkEdge[] = ['bottom', 'left', 'top', 'right']

const resolveInkEdge = (width: number, height: number): InkEdge =>
  width > height ? 'bottom' : 'right'

const rotateInkEdge = (edge: InkEdge, rotationDelta: number): InkEdge => {
  const steps = ((Math.round(rotationDelta / 90) % 4) + 4) % 4
  const index = INK_EDGES_CW.indexOf(edge)
  return INK_EDGES_CW[(index + steps) % 4] ?? edge
}

const inkEdgeToWritingMode = (edge: InkEdge): MarkWritingMode => {
  if (edge === 'left') {
    return 'vertical-rl'
  }
  if (edge === 'right') {
    return 'vertical-lr'
  }
  if (edge === 'top') {
    return 'horizontal-bt'
  }
  return 'horizontal-tb'
}

/** Writing mode follows stored glyph side, then rotates with the page. */
export const resolveWritingMode = (
  storedWidth: number,
  storedHeight: number,
  rotationDelta: number,
): MarkWritingMode =>
  inkEdgeToWritingMode(rotateInkEdge(resolveInkEdge(storedWidth, storedHeight), rotationDelta))

export const resolveMarkStyleType = (
  styleName: MarkStyleName,
  writingMode: MarkWritingMode = 'horizontal-tb',
): string => {
  if (writingMode === 'horizontal-tb') {
    return styleName
  }
  return `${styleName}-${writingMode}`
}

const encodeSvg = (svg: string): string => {
  if (typeof btoa === 'function') {
    return btoa(svg)
  }
  return ''
}

const wavySvg = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="4" viewBox="0 0 9 4"><path d="M0 2 Q 2.25 0 4.5 2 T 9 2" fill="none" stroke="${color}" stroke-width="1.2"/></svg>`
  return encodeSvg(svg)
}

const wavySvgVertical = (color: string, mode: 'vertical-lr' | 'vertical-rl') => {
  const path =
    mode === 'vertical-lr' ? 'M2 0 Q 4 2.25 2 4.5 T 2 9' : 'M2 0 Q 0 2.25 2 4.5 T 2 9'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="9" viewBox="0 0 4 9"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.2"/></svg>`
  return encodeSvg(svg)
}

const wavyBackground = (color: string, mode: MarkWritingMode = 'horizontal-tb') => {
  if (mode === 'vertical-lr') {
    return `url("data:image/svg+xml;base64,${wavySvgVertical(color, 'vertical-lr')}")`
  }
  if (mode === 'vertical-rl') {
    return `url("data:image/svg+xml;base64,${wavySvgVertical(color, 'vertical-rl')}")`
  }
  return `url("data:image/svg+xml;base64,${wavySvg(color)}")`
}

const straightSvg = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="3" viewBox="0 0 9 3"><path d="M0 1.5 H9" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`
  return encodeSvg(svg)
}

const straightSvgVertical = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3" height="9" viewBox="0 0 3 9"><path d="M1.5 0 V9" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`
  return encodeSvg(svg)
}

const straightBackground = (color: string, mode: MarkWritingMode = 'horizontal-tb') => {
  if (mode === 'vertical-lr' || mode === 'vertical-rl') {
    return `url("data:image/svg+xml;base64,${straightSvgVertical(color)}")`
  }
  return `url("data:image/svg+xml;base64,${straightSvg(color)}")`
}

const withAlpha = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '').trim()
  if (normalized.length !== 6) {
    return hex
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) {
    return hex
  }
  return `rgba(${r},${g},${b},${alpha})`
}

export const getCustomColorStyleText = (
  styleType: string,
  customColor?: string,
): string => {
  if (!customColor) {
    return ''
  }
  if (styleType === 'mark_pen' || styleType.startsWith('mark_pen')) {
    return `background-color:${withAlpha(customColor, 0.27)};`
  }
  if (styleType === 'wavy_line' || styleType.startsWith('wavy_line')) {
    const color = withAlpha(customColor, 0.85)
    let mode: MarkWritingMode = 'horizontal-tb'
    if (styleType.endsWith('vertical-lr')) {
      mode = 'vertical-lr'
    } else if (styleType.endsWith('vertical-rl')) {
      mode = 'vertical-rl'
    } else if (styleType.endsWith('horizontal-bt')) {
      mode = 'horizontal-bt'
    }
    return `background-image:${wavyBackground(color, mode)};`
  }
  if (styleType === 'underline_straight' || styleType.startsWith('underline_straight')) {
    const color = withAlpha(customColor, 0.6)
    let mode: MarkWritingMode = 'horizontal-tb'
    if (styleType.endsWith('vertical-lr')) {
      mode = 'vertical-lr'
    } else if (styleType.endsWith('vertical-rl')) {
      mode = 'vertical-rl'
    } else if (styleType.endsWith('horizontal-bt')) {
      mode = 'horizontal-bt'
    }
    return `background-image:${straightBackground(color, mode)};`
  }
  return ''
}

export { withAlpha, wavyBackground, straightBackground }
