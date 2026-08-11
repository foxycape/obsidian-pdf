import { getColorOptions } from '../colorUtils'

/**
 * Lightweight sRGB ↔ CIELAB color helper for PDF theme remapping.
 * Adapted from doq's color.js (MIT) / CSS Color 4 conversions.
 */
export class LabColor {
  private _rgb: number[] | undefined
  private _lab: number[] | undefined
  private _hex: string | undefined
  private _alpha = 1

  constructor(
    input?: string | number[] | LabColor,
    space: 'rgb' | 'lab' = 'rgb',
  ) {
    if (input instanceof LabColor) {
      this._rgb = [...input.rgb]
      this._lab = input._lab ? [...input._lab] : undefined
      this._hex = input._hex
      this._alpha = input.alpha
      return
    }
    if (Array.isArray(input)) {
      if (space === 'lab') {
        this._lab = input
      } else {
        this._rgb = input
      }
      return
    }
    if (typeof input === 'string') {
      const parsed = getColorOptions(input, '#000000')
      this._rgb = [parsed.r, parsed.g, parsed.b]
      this._alpha = parsed.alpha
      return
    }
    this._rgb = [0, 0, 0]
  }

  static readonly white = new LabColor([1, 1, 1])

  get rgb(): number[] {
    if (this._rgb == null) {
      this._rgb = sRGB.fromLab(this._lab ?? [0, 0, 0])
    }
    return this._rgb
  }

  get lab(): number[] {
    this._lab = this._lab ?? sRGB.toLab(this.rgb)
    return this._lab
  }

  get lightness(): number {
    return this.lab[0]
  }

  get chroma(): number {
    const [, a, b] = this.lab
    return Math.sqrt(a ** 2 + b ** 2)
  }

  get alpha(): number {
    return this._alpha
  }

  get hex(): string {
    this._hex = this._hex ?? this.toHex()
    return this._hex
  }

  deltaE = (other: LabColor): number => {
    return Math.sqrt(
      this.lab.reduce((sum, c, i) => {
        if (Number.isNaN(c) || Number.isNaN(other.lab[i])) {
          return sum
        }
        return sum + (other.lab[i] - c) ** 2
      }, 0),
    )
  }

  /** Lab interpolation from this → other; p in [0, 1]. */
  range = (other: LabColor): ((p: number) => LabColor) => {
    const interpolate = (start: number, end: number, p: number) => {
      if (Number.isNaN(start)) {
        return end
      }
      if (Number.isNaN(end)) {
        return start
      }
      return start + (end - start) * p
    }
    return (p: number) => {
      const coords = this.lab.map((start, i) =>
        interpolate(start, other.lab[i], p),
      )
      return new LabColor(coords, 'lab')
    }
  }

  toHex = (alpha = this._alpha): string => {
    let hex = this.rgb.map(compToHex).join('')
    if (alpha !== 1) {
      hex += compToHex(alpha)
    }
    return `#${hex}`
  }

  /** Try parse; returns null for gradients/patterns/unsupported. */
  static tryParse = (style: unknown): LabColor | null => {
    if (typeof style !== 'string' || !style) {
      return null
    }
    const trimmed = style.trim()
    if (
      trimmed.startsWith('url(') ||
      trimmed.includes('gradient') ||
      trimmed === 'none' ||
      trimmed === 'transparent'
    ) {
      return null
    }
    try {
      return new LabColor(trimmed)
    } catch {
      return null
    }
  }
}

const compToHex = (c: number) => {
  const n = Math.round(Math.min(Math.max(c * 255, 0), 255))
  return n.toString(16).padStart(2, '0')
}

const Matrices = {
  lin_sRGB_to_XYZ: [
    [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
    [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
    [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
  ],
  XYZ_to_lin_sRGB: [
    [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
    [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
    [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
  ],
  D65_to_D50: [
    [1.0479298208405488, 0.022946793341019088, -0.05019222954313557],
    [0.029627815688159344, 0.990434484573249, -0.01707382502938514],
    [-0.009243058152591178, 0.015055144896577895, 0.7518742899580008],
  ],
  D50_to_D65: [
    [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
    [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
    [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
  ],
}

function multiplyMatrices(A: number[], B: number[]): number[]
function multiplyMatrices(A: number[][], B: number[]): number[]
function multiplyMatrices(A: number[][], B: number[][]): number[][]
function multiplyMatrices(
  A: number[] | number[][],
  B: number[] | number[][],
): number[] | number[][] {
  let a: number[][]
  let b: number[][]
  const m = Array.isArray(A[0]) ? A.length : 1
  if (!Array.isArray(A[0])) {
    a = [A as number[]]
  } else {
    a = A as number[][]
  }
  if (!Array.isArray(B[0])) {
    b = (B as number[]).map((x) => [x])
  } else {
    b = B as number[][]
  }
  const p = b[0].length
  const bCols = b[0].map((_, i) => b.map((row) => row[i]))
  let product: number[][] = a.map((row) =>
    bCols.map((col) =>
      row.reduce((sum, c, i) => sum + c * (col[i] || 0), 0),
    ),
  )
  if (m === 1) {
    product = [product[0]]
    const flat = product[0]
    if (p === 1) {
      return [flat[0]]
    }
    return flat
  }
  if (p === 1) {
    return product.map((row) => row[0])
  }
  return product
}

const multiplyMatrixVector = (matrix: number[][], vector: number[]): number[] => {
  return multiplyMatrices(matrix, vector)
}

const CIE_FRACS = {
  ε: 216 / 24389,
  ε3: 24 / 116,
  κ: 24389 / 27,
} as const

const D50_WHITE: readonly number[] = [
  0.3457 / 0.3585,
  1.0,
  (1.0 - 0.3457 - 0.3585) / 0.3585,
]

const toXYZ_M = multiplyMatrices(
  Matrices.D65_to_D50,
  Matrices.lin_sRGB_to_XYZ,
)

const fromXYZ_M = multiplyMatrices(
  Matrices.XYZ_to_lin_sRGB,
  Matrices.D50_to_D65,
)

const toLinear = (RGB: number[]): number[] => {
  return RGB.map((val) => {
    const sign = val < 0 ? -1 : 1
    const abs = Math.abs(val)
    if (abs < 0.04045) {
      return val / 12.92
    }
    return sign * ((abs + 0.055) / 1.055) ** 2.4
  })
}

const toXYZ = (linRGB: number[]): number[] => multiplyMatrixVector(toXYZ_M, linRGB)

const XYZtoLab = (XYZ: number[]): number[] => {
  const { κ, ε } = CIE_FRACS
  const xyz = XYZ.map((value, i) => value / (D50_WHITE[i] ?? 1))
  const f = xyz.map((value) =>
    value > ε ? Math.cbrt(value) : (κ * value + 16) / 116,
  )
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])]
}

const toLab = (RGB: number[]): number[] => XYZtoLab(toXYZ(toLinear(RGB)))

const LabToXYZ = (Lab: number[]): number[] => {
  const { κ, ε3 } = CIE_FRACS
  const f: number[] = []
  f[1] = (Lab[0] + 16) / 116
  f[0] = Lab[1] / 500 + f[1]
  f[2] = f[1] - Lab[2] / 200
  const xyz = [
    f[0] > ε3 ? f[0] ** 3 : (116 * f[0] - 16) / κ,
    Lab[0] > 8 ? ((Lab[0] + 16) / 116) ** 3 : Lab[0] / κ,
    f[2] > ε3 ? f[2] ** 3 : (116 * f[2] - 16) / κ,
  ]
  return xyz.map((value, i) => value * (D50_WHITE[i] ?? 1))
}

const fromXYZ = (XYZ: number[]): number[] => multiplyMatrixVector(fromXYZ_M, XYZ)

const toGamma = (RGB: number[]): number[] => {
  return RGB.map((val) => {
    const sign = val < 0 ? -1 : 1
    const abs = Math.abs(val)
    if (abs > 0.0031308) {
      return sign * (1.055 * abs ** (1 / 2.4) - 0.055)
    }
    return 12.92 * val
  })
}

const fromLab = (Lab: number[]): number[] => toGamma(fromXYZ(LabToXYZ(Lab)))

const sRGB = {
  toLab,
  fromLab,
}
