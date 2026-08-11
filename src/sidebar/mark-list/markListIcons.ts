import type { MarkStyleName } from '@foxycape/core/kernal/mark/types'
import fontFillSvg from './icons/font-fill.svg?raw'
import fontStraightLineSvg from './icons/font-straight-line.svg?raw'
import fontWavyLineSvg from './icons/font-wavy-line.svg?raw'

export const getMarkListIconSvg = (styleName: MarkStyleName | string): string => {
  if (styleName === 'mark_pen') {
    return fontFillSvg
  }
  if (styleName === 'wavy_line') {
    return fontWavyLineSvg
  }
  return fontStraightLineSvg
}
