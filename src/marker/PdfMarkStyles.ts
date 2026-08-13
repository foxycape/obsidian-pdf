import type { MarkStyle, MarkStyleName } from '@foxycape/core/kernal/mark/types'
import { DEFAULT_MARK_COLORS } from './PdfMarkConstants'

export type MarkWritingMode = 'horizontal-tb' | 'horizontal-bt' | 'vertical-lr' | 'vertical-rl'

const encodeSvg = (svg: string): string => {
  if (typeof btoa === 'function') {
    return btoa(svg)
  }
  return ''
}

/** Horizontal wavy underline tile (9x4) */
const wavySvg = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="4" viewBox="0 0 9 4"><path d="M0 2 Q 2.25 0 4.5 2 T 9 2" fill="none" stroke="${color}" stroke-width="1.2"/></svg>`
  return encodeSvg(svg)
}

/** Vertical wavy tile (4x9); lr waves toward right edge, rl toward left */
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

/** Horizontal straight underline tile (~1.5px stroke), same tiling pattern as wavy. */
const straightSvg = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="3" viewBox="0 0 9 3"><path d="M0 1.5 H9" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`
  return encodeSvg(svg)
}

/** Vertical straight tile (3x9) */
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

export const resolveMarkStyleType = (
  styleName: MarkStyleName,
  writingMode: MarkWritingMode = 'horizontal-tb',
): string => {
  if (writingMode === 'horizontal-tb') {
    return styleName
  }
  return `${styleName}-${writingMode}`
}

export const buildMarkStylesCss = (): string => {
  const wavy = DEFAULT_MARK_COLORS.wavy_line
  const underline = withAlpha(DEFAULT_MARK_COLORS.underline_straight, 0.6)
  // Scope drawline look to overlay masks only — bare `.underline_straight` etc. must not
  // leak into mark-list text (which uses the same styleName as a class).
  const m = '.foxycape-pdf-mark-mask'
  return [
    // Layer / mask: content-box so padding offsets extend outside geometry (match original)
    '.foxycape-pdf-mark-layer{position:absolute;left:0;top:0;pointer-events:none;z-index:3;overflow:visible;}',
    `${m}{position:absolute;pointer-events:auto;cursor:pointer;box-sizing:content-box;border:0 !important;background-color:transparent;}`,

    // mark_pen (horizontal)
    `${m}.mark_pen{background-color:rgba(255,255,0,0.27);padding-block:2px !important;border-radius:0 !important;}`,
    `${m}.mark_pen:first-of-type{border-start-start-radius:3px !important;border-end-start-radius:3px !important;}`,
    `${m}.mark_pen:last-of-type{border-start-end-radius:3px !important;border-end-end-radius:3px !important;}`,

    // wavy_line — physical padding follows rotated ink edge (not doc RTL)
    `${m}.wavy_line{background-image:${wavyBackground(wavy)};background-size:9px 4px !important;background-position:0 100% !important;background-repeat:repeat-x !important;padding:0 !important;padding-block-end:4px !important;}`,
    `${m}.wavy_line-horizontal-bt{background-image:${wavyBackground(wavy, 'horizontal-bt')};background-size:9px 4px !important;background-position:0 0 !important;background-repeat:repeat-x !important;padding:0 !important;padding-block-start:4px !important;}`,
    `${m}.wavy_line-vertical-lr{background-image:${wavyBackground(wavy, 'vertical-lr')};background-size:4px 9px !important;background-position:100% 0 !important;background-repeat:repeat-y !important;padding:0 !important;padding-right:4px !important;}`,
    `${m}.wavy_line-vertical-rl{background-image:${wavyBackground(wavy, 'vertical-rl')};background-size:4px 9px !important;background-position:0 100% !important;background-repeat:repeat-y !important;padding:0 !important;padding-left:4px !important;}`,

    // underline_straight — SVG tile (~1.5px), no CSS border
    `${m}.underline_straight{background-image:${straightBackground(underline)};background-size:9px 3px !important;background-position:0 100% !important;background-repeat:repeat-x !important;padding:0 !important;padding-block-end:3px !important;}`,
    `${m}.underline_straight-horizontal-bt{background-image:${straightBackground(underline, 'horizontal-bt')};background-size:9px 3px !important;background-position:0 0 !important;background-repeat:repeat-x !important;padding:0 !important;padding-block-start:3px !important;}`,
    `${m}.underline_straight-vertical-lr{background-image:${straightBackground(underline, 'vertical-lr')};background-size:3px 9px !important;background-position:100% 0 !important;background-repeat:repeat-y !important;padding:0 !important;padding-right:3px !important;}`,
    `${m}.underline_straight-vertical-rl{background-image:${straightBackground(underline, 'vertical-rl')};background-size:3px 9px !important;background-position:0 100% !important;background-repeat:repeat-y !important;padding:0 !important;padding-left:3px !important;}`,
  ].join('')
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

/**
 * Inline custom-color overrides.
 * `styleType` may be base name or vertical variant (`wavy_line-vertical-lr`).
 */
export const getCustomColorStyleText = (
  styleType: MarkStyleName,
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

/**
 * Softer inline styles for mark-list text preview (multi-line friendly when
 * applied on an `display: inline` span with `box-decoration-break: clone`).
 */
export const getMarkListTextStyle = (
  styleType: MarkStyleName,
  color: string,
): Record<string, string> => {
  if (styleType === 'mark_pen' || styleType.startsWith('mark_pen')) {
    return {
      backgroundColor: withAlpha(color, 0.22),
      paddingBlock: '2px',
      paddingInline: '6px',
    }
  }
  if (styleType === 'wavy_line' || styleType.startsWith('wavy_line')) {
    return {
      backgroundImage: wavyBackground(withAlpha(color, 0.5)),
      backgroundSize: '9px 4px',
      backgroundPosition: '0 100%',
      backgroundRepeat: 'repeat-x',
      paddingBlock: '0 3px',
      paddingInline: '4px',
    }
  }
  if (styleType === 'underline_straight' || styleType.startsWith('underline_straight')) {
    return {
      backgroundImage: straightBackground(withAlpha(color, 0.45)),
      backgroundSize: '9px 3px',
      backgroundPosition: '0 100%',
      backgroundRepeat: 'repeat-x',
      paddingBlock: '0 3px',
      paddingInline: '4px',
    }
  }
  return {}
}

export const getDefaultMarkStyles = (): MarkStyle[] => {
  const items: Array<{
    styleName: MarkStyleName
    displayTextKey: string
    defaultDisplayText: string
    order: number
  }> = [
    {
      styleName: 'mark_pen',
      displayTextKey: 'mark_style_mark_pen',
      defaultDisplayText: 'Highlighter',
      order: 0,
    },
    {
      styleName: 'wavy_line',
      displayTextKey: 'mark_style_wavy_line',
      defaultDisplayText: 'Wavy',
      order: 1,
    },
    {
      styleName: 'underline_straight',
      displayTextKey: 'mark_style_underline',
      defaultDisplayText: 'Underline',
      order: 2,
    },
  ]
  return items.map((item) => ({
    markType: 'drawline',
    styleName: item.styleName,
    classValue: '',
    displayColor: DEFAULT_MARK_COLORS[item.styleName],
    defaultColor: DEFAULT_MARK_COLORS[item.styleName],
    displayTextKey: item.displayTextKey,
    defaultDisplayText: item.defaultDisplayText,
    order: item.order,
  }))
}
