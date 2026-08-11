/** Original ContentToolbar.predefineColorList (filler for quick slots) */
export const PREDEFINE_MARK_COLORS = [
  '#ff165d',
  '#ff9a00',
  '#3ec1d3',
  '#6a2c70',
  '#f08a5d',
] as const

/** Toolbar shows defaultColor + quick colors = this many swatches total */
export const TOOLBAR_MARK_COLOR_COUNT = 5
/** Quick slots excluding the style default color */
export const QUICK_MARK_COLOR_COUNT = TOOLBAR_MARK_COLOR_COUNT - 1

/** Original ContentToolbar.allColorList */
export const ALL_MARK_COLORS = [
  '#eaff56',
  '#fff143',
  '#faff72',
  '#ffa631',
  '#ffa400',
  '#fa8c35',
  '#ff8c31',
  '#ff8936',
  '#ff7500',
  '#ffb61e',
  '#ffc773',
  '#ffc64b',
  '#f2be45',
  '#f0c239',
  '#e9bb1d',
  '#d9b611',
  '#eacd76',
  '#eedeb0',
  '#d3b17d',
  '#e29c45',
  '#a78e44',
  '#c89b40',
  '#ae7000',
  '#ca6924',
  '#b25d25',
  '#b35c44',
  '#9b4400',
  '#9c5333',
  '#bce672',
  '#c9dd22',
  '#bddd22',
  '#afdd22',
  '#a3d900',
  '#9ed900',
  '#9ed048',
  '#96ce54',
  '#00bc12',
  '#0eb83a',
  '#0aa344',
  '#16a951',
  '#21a675',
  '#057748',
  '#0c8918',
  '#00e500',
  '#40de5a',
  '#00e079',
  '#00e09e',
  '#549688',
  '#789262',
  '#758a99',
  '#50616d',
  '#424c50',
  '#41555d',
  '#70f3ff',
  '#44cef6',
  '#3eede7',
  '#1685a9',
  '#177cb0',
  '#065279',
  '#003472',
  '#4b5cc4',
  '#2e4e7e',
  '#3b2e7e',
  '#4a4266',
  '#426666',
  '#425066',
  '#574266',
  '#8d4bbb',
  '#815463',
  '#815476',
  '#4c221b',
  '#003371',
  '#56004f',
  '#801dae',
  '#4c8dae',
  '#896c39',
  '#827100',
  '#6e511e',
  '#7c4b00',
  '#955539',
  '#845a33',
  '#60281e',
  '#622a1d',
  '#9d2933',
  '#c3272b',
  '#bf242a',
  '#c91f37',
  '#be002f',
  '#c32136',
  '#ff0097',
  '#ef7a82',
  '#cb3a56',
  '#ff3300',
  '#dc3023',
  '#f35336',
  '#ff4e20',
  '#ff4c00',
  '#c83c23',
  '#8c4356',
  '#f20c00',
  '#ff2121',
  '#f05654',
  '#f9906f',
  '#db5a6b',
  '#f47983',
  '#ffb3a7',
  '#f00056',
  '#ff4777',
  '#ed5736',
  '#ff2d51',
  '#ff461f',
  '#88ada6',
  '#6b6882',
  '#725e82',
  '#3d3b4f',
  '#392f41',
  '#75664d',
  '#5d513c',
  '#665757',
  '#493131',
  '#312520',
  '#161823',
  '#000000',
] as const

export const colorListStorageKey = (styleName: string) => `${styleName}_color_list`

/** Normalize to opaque #rrggbb lowercase */
export const normalizeMarkColor = (color: string): string => {
  const raw = color.trim()
  const hexMatch = raw.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
  if (hexMatch) {
    let hex = hexMatch[1]
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('')
    } else if (hex.length === 8) {
      hex = hex.slice(0, 6)
    }
    return `#${hex.toLowerCase()}`
  }
  const rgba = raw.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/i,
  )
  if (rgba) {
    const toHex = (n: string) =>
      Math.max(0, Math.min(255, Number.parseInt(n, 10)))
        .toString(16)
        .padStart(2, '0')
    return `#${toHex(rgba[1])}${toHex(rgba[2])}${toHex(rgba[3])}`
  }
  return raw.toLowerCase()
}

export const isSameMarkColor = (a: string, b: string) =>
  normalizeMarkColor(a) === normalizeMarkColor(b)

/**
 * Build quick colors for a style (excludes defaultColor).
 * Toolbar total = 1 default + up to {@link QUICK_MARK_COLOR_COUNT} quick = 5.
 */
export const buildQuickColorList = (options: {
  storedList?: string[] | null
  currentColor?: string
  customColor?: string
  defaultColor?: string
}): string[] => {
  let colorList = (options.storedList?.length
    ? [...options.storedList]
    : [...PREDEFINE_MARK_COLORS]
  ).map(normalizeMarkColor)

  colorList = colorList.filter(
    (color, index) => colorList.indexOf(color) === index,
  )
  if (colorList.length < QUICK_MARK_COLOR_COUNT) {
    colorList = [...PREDEFINE_MARK_COLORS].map(normalizeMarkColor)
  }

  const defaultColor = options.defaultColor
    ? normalizeMarkColor(options.defaultColor)
    : ''
  const currentColor = options.currentColor
    ? normalizeMarkColor(options.currentColor)
    : ''
  const customColor = options.customColor
    ? normalizeMarkColor(options.customColor)
    : ''

  if (currentColor && currentColor !== defaultColor && !colorList.includes(currentColor)) {
    colorList.unshift(currentColor)
  }
  if (customColor && customColor !== defaultColor && !colorList.includes(customColor)) {
    colorList.unshift(customColor)
  }

  if (defaultColor) {
    colorList = colorList.filter((c) => c !== defaultColor)
  }
  return colorList.slice(0, QUICK_MARK_COLOR_COUNT)
}

/**
 * Insert selected color at front of the quick list (for "more colors").
 * Quick list excludes default; total toolbar swatches stay at {@link TOOLBAR_MARK_COLOR_COUNT}.
 * If the color is already in the list, keep its position — do not jump to front.
 */
export const insertQuickColor = (list: string[], color: string, defaultColor?: string) => {
  const normalized = normalizeMarkColor(color)
  const defaultNormalized = defaultColor ? normalizeMarkColor(defaultColor) : ''
  const existing = list
    .map(normalizeMarkColor)
    .filter((c, index, arr) => arr.indexOf(c) === index)
    .filter((c) => !defaultNormalized || c !== defaultNormalized)

  if (defaultNormalized && normalized === defaultNormalized) {
    return existing.slice(0, QUICK_MARK_COLOR_COUNT)
  }

  // Already on the toolbar: keep order stable (avoid jumping when re-clicked).
  if (existing.includes(normalized)) {
    return existing.slice(0, QUICK_MARK_COLOR_COUNT)
  }

  return [normalized, ...existing].slice(0, QUICK_MARK_COLOR_COUNT)
}

/** Original getDarkenColor: clamp very bright swatches for readability */
export const getDisplayMarkColor = (color: string): string => {
  const hex = normalizeMarkColor(color).replace('#', '')
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return color
  }
  let r = Number.parseInt(hex.slice(0, 2), 16) / 255
  let g = Number.parseInt(hex.slice(2, 4), 16) / 255
  let b = Number.parseInt(hex.slice(4, 6), 16) / 255
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  let luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  if (luminance <= 0.82) {
    return `#${hex}`
  }
  // Simple darken toward black until luminance ~0.82
  const factor = 0.82 / luminance
  r = Math.round(Math.min(255, Number.parseInt(hex.slice(0, 2), 16) * factor))
  g = Math.round(Math.min(255, Number.parseInt(hex.slice(2, 4), 16) * factor))
  b = Math.round(Math.min(255, Number.parseInt(hex.slice(4, 6), 16) * factor))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`
}
