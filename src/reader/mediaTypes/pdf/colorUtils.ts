export type ColorComponents = {
  /** 0–1 */
  r: number
  /** 0–1 */
  g: number
  /** 0–1 */
  b: number
  /** 0–1 */
  alpha: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const parseHexChannel = (hex: string) => parseInt(hex, 16) / 255

const SENTINEL_RGB = 'rgb(1, 2, 3)'

/**
 * Resolve any CSS color the browser understands (hsl, hsla, oklch, var(), …)
 * into a computed `rgb()` / `rgba()` string via the live document cascade.
 */
export const resolveCssColor = (
  color: string,
  fallback: string,
  root: ParentNode = document.body,
): string => {
  const raw = (color || '').trim()
  if (!raw) {
    return fallback
  }
  if (typeof document === 'undefined') {
    return raw || fallback
  }

  const ownerDocument = root.instanceOf(Document) ? root : root.ownerDocument ?? document
  const mountParent =
    root.instanceOf(Element)
      ? root
      : ownerDocument.body ?? ownerDocument.documentElement
  if (!mountParent) {
    return raw || fallback
  }

  const probe = mountParent.createSpan()
  probe.classList.add('foxycape-pdf-offscreen-probe')
  probe.setCssStyles({ color: SENTINEL_RGB })

  try {
    const sentinel = ownerDocument.defaultView?.getComputedStyle(probe).color ?? ''
    probe.setCssStyles({ color: raw })
    const resolved = ownerDocument.defaultView?.getComputedStyle(probe).color ?? ''
    if (
      !resolved ||
      resolved === 'transparent' ||
      (resolved === sentinel && raw.replace(/\s+/g, '') !== SENTINEL_RGB.replace(/\s+/g, ''))
    ) {
      return fallback
    }
    return resolved
  } finally {
    probe.remove()
  }
}

const hueToRgb = (p: number, q: number, t: number) => {
  let tt = t
  if (tt < 0) tt += 1
  if (tt > 1) tt -= 1
  if (tt < 1 / 6) return p + (q - p) * 6 * tt
  if (tt < 1 / 2) return q
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
  return p
}

const hslToRgbComponents = (
  h: number,
  s: number,
  l: number,
  alpha: number,
): ColorComponents => {
  const hh = ((h % 360) + 360) % 360 / 360
  const ss = clamp01(s)
  const ll = clamp01(l)
  if (ss === 0) {
    return { r: ll, g: ll, b: ll, alpha }
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
  const p = 2 * ll - q
  return {
    r: hueToRgb(p, q, hh + 1 / 3),
    g: hueToRgb(p, q, hh),
    b: hueToRgb(p, q, hh - 1 / 3),
    alpha,
  }
}

const parsePercentOrNumber = (value: string, isAlpha = false) => {
  if (value.endsWith('%')) {
    return clamp01(parseFloat(value) / 100)
  }
  const num = parseFloat(value)
  if (isAlpha) {
    return num > 1 ? clamp01(num / 255) : clamp01(num)
  }
  return clamp01(num / 255)
}

const parseHue = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  if (trimmed.endsWith('turn')) {
    return parseFloat(trimmed) * 360
  }
  if (trimmed.endsWith('rad')) {
    return (parseFloat(trimmed) * 180) / Math.PI
  }
  if (trimmed.endsWith('grad')) {
    return parseFloat(trimmed) * 0.9
  }
  return parseFloat(trimmed)
}

const tryParseHsl = (raw: string): ColorComponents | null => {
  const classic = raw.match(
    /^hsla?\(\s*([+-]?\d*\.?\d+(?:deg|rad|grad|turn)?)\s*,\s*([+-]?\d*\.?\d+%)\s*,\s*([+-]?\d*\.?\d+%)(?:\s*,\s*([+-]?\d*\.?\d+%?))?\s*\)$/i,
  )
  if (classic) {
    return hslToRgbComponents(
      parseHue(classic[1]),
      parseFloat(classic[2]) / 100,
      parseFloat(classic[3]) / 100,
      classic[4] != null ? parsePercentOrNumber(classic[4], true) : 1,
    )
  }

  const modern = raw.match(
    /^hsla?\(\s*([+-]?\d*\.?\d+(?:deg|rad|grad|turn)?)\s+([+-]?\d*\.?\d+%)\s+([+-]?\d*\.?\d+%)(?:\s*\/\s*([+-]?\d*\.?\d+%?))?\s*\)$/i,
  )
  if (modern) {
    return hslToRgbComponents(
      parseHue(modern[1]),
      parseFloat(modern[2]) / 100,
      parseFloat(modern[3]) / 100,
      modern[4] != null ? parsePercentOrNumber(modern[4], true) : 1,
    )
  }

  return null
}

/**
 * Parse CSS color strings commonly returned by Obsidian / getComputedStyle.
 * Supports #rgb/#rrggbb(/aa), rgb(a), hsl(a); other forms are resolved via the browser.
 */
export const getColorOptions = (
  color: string,
  defaultColor = '#666666',
): ColorComponents => {
  const raw = (color || defaultColor).trim()
  const fallback = (): ColorComponents => {
    if (raw === defaultColor) {
      return { r: 0.4, g: 0.4, b: 0.4, alpha: 1 }
    }
    return getColorOptions(defaultColor, '#666666')
  }

  if (raw.startsWith('#')) {
    let hex = raw.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      const r = hex[0]
      const g = hex[1]
      const b = hex[2]
      const a = hex[3] ?? 'f'
      hex = `${r}${r}${g}${g}${b}${b}${a}${a}`
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseHexChannel(hex.slice(0, 2))
      const g = parseHexChannel(hex.slice(2, 4))
      const b = parseHexChannel(hex.slice(4, 6))
      const alpha = hex.length === 8 ? parseHexChannel(hex.slice(6, 8)) : 1
      if ([r, g, b, alpha].some((n) => Number.isNaN(n))) {
        return fallback()
      }
      return { r, g, b, alpha }
    }
    return fallback()
  }

  const rgbMatch = raw.match(
    /^rgba?\(\s*([+-]?\d*\.?\d+%?)\s*,\s*([+-]?\d*\.?\d+%?)\s*,\s*([+-]?\d*\.?\d+%?)(?:\s*,\s*([+-]?\d*\.?\d+%?))?\s*\)$/i,
  )
  if (rgbMatch) {
    return {
      r: parsePercentOrNumber(rgbMatch[1]),
      g: parsePercentOrNumber(rgbMatch[2]),
      b: parsePercentOrNumber(rgbMatch[3]),
      alpha: rgbMatch[4] != null ? parsePercentOrNumber(rgbMatch[4], true) : 1,
    }
  }

  // Obsidian may return space-separated modern syntax: rgb(30 30 30 / 0.5)
  const modernMatch = raw.match(
    /^rgba?\(\s*([+-]?\d*\.?\d+%?)\s+([+-]?\d*\.?\d+%?)\s+([+-]?\d*\.?\d+%?)(?:\s*\/\s*([+-]?\d*\.?\d+%?))?\s*\)$/i,
  )
  if (modernMatch) {
    return {
      r: parsePercentOrNumber(modernMatch[1]),
      g: parsePercentOrNumber(modernMatch[2]),
      b: parsePercentOrNumber(modernMatch[3]),
      alpha: modernMatch[4] != null ? parsePercentOrNumber(modernMatch[4], true) : 1,
    }
  }

  const hsl = tryParseHsl(raw)
  if (hsl) {
    return hsl
  }

  // Last resort: let the browser resolve hsl/oklch/var()/named colors → rgb().
  if (typeof document !== 'undefined') {
    const resolved = resolveCssColor(raw, '')
    if (resolved && resolved !== raw) {
      return getColorOptions(resolved, defaultColor)
    }
  }

  return fallback()
}

/** Resolve a CSS color to a stable rgb()/rgba() string for canvas / Lab remapping. */
export const toResolvedCssColor = (
  color: string,
  fallback: string,
  root: ParentNode = document.body,
): string => {
  const raw = (color || '').trim()
  if (!raw) {
    return fallback
  }
  // Fast path: already rgb(a) / hex — normalize via parser then emit rgb().
  if (raw.startsWith('#') || /^rgba?\(/i.test(raw) || /^hsla?\(/i.test(raw)) {
    const { r, g, b, alpha } = getColorOptions(raw, fallback)
    const R = Math.round(r * 255)
    const G = Math.round(g * 255)
    const B = Math.round(b * 255)
    if (alpha >= 1) {
      return `rgb(${R}, ${G}, ${B})`
    }
    return `rgba(${R}, ${G}, ${B}, ${Number(alpha.toFixed(4))})`
  }
  return resolveCssColor(raw, fallback, root)
}

/**
 * Ensure a CSS color has an alpha channel.
 * If the resolved color is fully opaque (or has no alpha), apply `defaultAlpha`.
 * Colors that already include transparency are left unchanged.
 */
export const ensureCssColorAlpha = (
  color: string,
  defaultAlpha = 0.5,
  fallback = 'rgba(255, 150, 50, 0.5)',
): string => {
  const { r, g, b, alpha } = getColorOptions(color, fallback)
  const outAlpha = alpha < 1 ? alpha : clamp01(defaultAlpha)
  const R = Math.round(r * 255)
  const G = Math.round(g * 255)
  const B = Math.round(b * 255)
  return `rgba(${R}, ${G}, ${B}, ${Number(outAlpha.toFixed(4))})`
}
