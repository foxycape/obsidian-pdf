import * as pdfjsLib from '../../../../pdfjs/legacy/build/pdf.mjs';
import type { TextItem, TextMarkedContent, TextStyle } from '../../../../pdfjs/types/src/display/api'

/** Axis-aligned rectangle (pixel or 0~1 normalized coordinates) */
export type PdfAxisAlignedRect = {
    x1: number
    y1: number
    x2: number
    y2: number
}

/** PDF text span (already mapped to the target page image coordinate system) */
export type PdfTextSpan = {
    /** Sequential index within the page */
    index: number
    text: string
    /** Pixel coordinates in the target page image (e.g. OCR screenshot width × height) */
    bounds: PdfAxisAlignedRect
    /** 0~1 normalized coordinates relative to the target page image */
    normalizedBounds: PdfAxisAlignedRect
    hasEOL: boolean
    dir: string
    fontName: string
    /** Clockwise angle in degrees relative to the horizontal axis */
    angleDeg: number
}

export type PdfTextSpanExtractOptions = {
    /** Target page image width (consistent with OCR / screenshot) */
    targetWidth: number
    /** Target page image height (consistent with OCR / screenshot) */
    targetHeight: number
    /** Page rotation; defaults to page.rotate */
    rotation?: number
    /**
     * When the viewport aspect ratio does not exactly match the target image,
     * whether to scale X and Y independently.
     * Default false: use a single scale aligned to width.
     */
    independentAxisScale?: boolean
}

export type PdfTextSpanCollectOptions = {
    /** Minimum ratio of query area covered by the span (default 0.05; used when a small query falls inside a large span) */
    minOverlapRatio?: number
    /** Minimum ratio of span area intersecting the query (default 0.4; used when a small span falls inside a large query) */
    minSpanCoverage?: number
}

const DEFAULT_ASCENT_RATIO = 0.8

const isTextItem = (item: TextItem | TextMarkedContent): item is TextItem =>
    typeof (item as TextItem).str === 'string'

const transformPoint = (matrix: number[], x: number, y: number) => ({
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5]
})

const boundsFromPoints = (points: Array<{ x: number; y: number }>): PdfAxisAlignedRect => {
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    return {
        x1: Math.min(...xs),
        y1: Math.min(...ys),
        x2: Math.max(...xs),
        y2: Math.max(...ys)
    }
}

const resolveFontAscent = (style: TextStyle | undefined, fontHeight: number): number => {
    if (!style || fontHeight <= 0) {
        return fontHeight * DEFAULT_ASCENT_RATIO
    }

    const ascent = style.ascent
    const descent = Math.abs(style.descent ?? 0)
    if (ascent > 0 && ascent <= 1) {
        return fontHeight * ascent
    }
    if (ascent > 1) {
        return ascent
    }
    if (descent > 0 && descent <= 1) {
        return fontHeight * (1 - descent)
    }
    return fontHeight * DEFAULT_ASCENT_RATIO
}

const resolveFontDescent = (style: TextStyle | undefined, fontHeight: number, fontAscent: number): number => {
    if (!style) {
        return fontHeight - fontAscent
    }

    const descent = Math.abs(style.descent ?? 0)
    if (descent > 0 && descent <= 1) {
        return fontHeight * descent
    }
    if (descent > 1) {
        return descent
    }
    return Math.max(fontHeight - fontAscent, 0)
}

const normalizeRect = (rect: PdfAxisAlignedRect, width: number, height: number): PdfAxisAlignedRect => {
    if (width <= 0 || height <= 0) {
        return { x1: 0, y1: 0, x2: 0, y2: 0 }
    }

    return {
        x1: rect.x1 / width,
        y1: rect.y1 / height,
        x2: rect.x2 / width,
        y2: rect.y2 / height
    }
}

const rectArea = (rect: PdfAxisAlignedRect): number => {
    return Math.max(0, rect.x2 - rect.x1) * Math.max(0, rect.y2 - rect.y1)
}

const intersectRect = (a: PdfAxisAlignedRect, b: PdfAxisAlignedRect): PdfAxisAlignedRect | null => {
    const x1 = Math.max(a.x1, b.x1)
    const y1 = Math.max(a.y1, b.y1)
    const x2 = Math.min(a.x2, b.x2)
    const y2 = Math.min(a.y2, b.y2)
    if (x2 <= x1 || y2 <= y1) {
        return null
    }
    return { x1, y1, x2, y2 }
}

const rectCenter = (rect: PdfAxisAlignedRect) => ({
    x: (rect.x1 + rect.x2) / 2,
    y: (rect.y1 + rect.y2) / 2
})

const isPointInRect = (point: { x: number; y: number }, rect: PdfAxisAlignedRect): boolean =>
    point.x >= rect.x1 && point.x <= rect.x2 && point.y >= rect.y1 && point.y <= rect.y2


    /**
     * Compute viewport for the target page image size (width-aligned, scale = targetWidth / pageWidth).
     */
    export const computeViewport = (
        page: pdfjsLib.PDFPageProxy,
        targetWidth: number,
        rotation?: number
    ): pdfjsLib.PageViewport => {
        const pageRotation = rotation ?? page.rotate
        const unitViewport = page.getViewport({ scale: 1, rotation: pageRotation })
        const scale = targetWidth / unitViewport.width
        return page.getViewport({ scale, rotation: pageRotation })
    }

    /**
     * Compute the axis-aligned bbox of a single text item in viewport pixel coordinates.
     * Consistent with pdf.js TextLayer:
     * - Horizontal: local X is writing direction, Y is upward (ascent positive, descent negative)
     * - Vertical (style.vertical): TextLayer adds +90°; writing direction along local -Y,
     *   thickness along X (ascent on +X, descent on -X); advance uses geom.height
     */
    export const computeSpanBoundsInViewport = (
        textItem: TextItem,
        style: TextStyle | undefined,
        viewportTransform: number[]
    ): PdfAxisAlignedRect => {
        const tx = pdfjsLib.Util.transform(viewportTransform, textItem.transform)
        const fontHeight = Math.hypot(tx[2], tx[3])
        if (fontHeight <= 0) {
            return {
                x1: tx[4],
                y1: tx[5],
                x2: tx[4],
                y2: tx[5]
            }
        }

        const fontAscent = resolveFontAscent(style, fontHeight)
        const fontDescent = resolveFontDescent(style, fontHeight, fontAscent)
        // width/height come from getTextContent in PDF user space; convert to local advance in text matrix space
        const tm = textItem.transform
        const isVertical = !!style?.vertical
        const userSpaceAdvance = isVertical ? textItem.height : textItem.width
        const dirScale = isVertical
            ? Math.hypot(tm[2], tm[3])
            : Math.hypot(tm[0], tm[1])
        const localAdvance = dirScale > 0 ? userSpaceAdvance / dirScale : userSpaceAdvance

        if (isVertical) {
            // Vertical: thickness along local X, writing advance along local -Y (maps to screen-down after viewport Y flip)
            const sx = Math.hypot(tx[0], tx[1]) || fontHeight
            const xRight = fontAscent / sx
            const xLeft = -fontDescent / sx
            const corners = [
                transformPoint(tx, xLeft, 0),
                transformPoint(tx, xRight, 0),
                transformPoint(tx, xRight, -localAdvance),
                transformPoint(tx, xLeft, -localAdvance)
            ]
            return boundsFromPoints(corners)
        }

        const sy = fontHeight
        // Text local space: baseline at 0, Y upward → ascent positive, descent negative
        const yTop = fontAscent / sy
        const yBottom = -fontDescent / sy
        const corners = [
            transformPoint(tx, 0, yTop),
            transformPoint(tx, localAdvance, yTop),
            transformPoint(tx, localAdvance, yBottom),
            transformPoint(tx, 0, yBottom)
        ]

        return boundsFromPoints(corners)
    }

    export const computeSpanAngleDeg = (textItem: TextItem, style: TextStyle | undefined, viewportTransform: number[]): number => {
        const tx = pdfjsLib.Util.transform(viewportTransform, textItem.transform)
        let angle = Math.atan2(tx[1], tx[0])
        if (style?.vertical) {
            angle += Math.PI / 2
        }
        return angle * (180 / Math.PI)
    }

    /**
     * Map a viewport-coordinate bbox to the target page image size.
     */
    export const mapBoundsToTargetSize = (
        bounds: PdfAxisAlignedRect,
        viewportWidth: number,
        viewportHeight: number,
        targetWidth: number,
        targetHeight: number,
        independentAxisScale = false
    ): PdfAxisAlignedRect => {
        if (viewportWidth <= 0 || viewportHeight <= 0) {
            return bounds
        }

        if (independentAxisScale) {
            const scaleX = targetWidth / viewportWidth
            const scaleY = targetHeight / viewportHeight
            return {
                x1: bounds.x1 * scaleX,
                y1: bounds.y1 * scaleY,
                x2: bounds.x2 * scaleX,
                y2: bounds.y2 * scaleY
            }
        }

        const scale = targetWidth / viewportWidth
        return {
            x1: bounds.x1 * scale,
            y1: bounds.y1 * scale,
            x2: bounds.x2 * scale,
            y2: bounds.y2 * scale
        }
    }

    /**
     * Extract all text spans from a PDF page, with bboxes mapped to targetWidth × targetHeight.
     */
    export const extractFromPage = async (
        page: pdfjsLib.PDFPageProxy,
        options: PdfTextSpanExtractOptions
    ): Promise<PdfTextSpan[]> => {
        const { targetWidth, targetHeight, rotation, independentAxisScale = false } = options
        const viewport = computeViewport(page, targetWidth, rotation)
        const textContent = await page.getTextContent()
        const spans: PdfTextSpan[] = []

        let index = 0
        for (const rawItem of textContent.items) {
            if (!isTextItem(rawItem)) {
                continue
            }

            const textItem = rawItem
            if (!textItem.str && textItem.width <= 0 && textItem.height <= 0) {
                continue
            }

            const style = textContent.styles[textItem.fontName]
            const viewportBounds = computeSpanBoundsInViewport(textItem, style, viewport.transform)
            const bounds = mapBoundsToTargetSize(
                viewportBounds,
                viewport.width,
                viewport.height,
                targetWidth,
                targetHeight,
                independentAxisScale
            )

            spans.push({
                index,
                text: textItem.str,
                bounds,
                normalizedBounds: normalizeRect(bounds, targetWidth, targetHeight),
                hasEOL: textItem.hasEOL,
                dir: textItem.dir,
                fontName: textItem.fontName,
                angleDeg: computeSpanAngleDeg(textItem, style, viewport.transform)
            })
            index++
        }

        return spans
    }

    /**
     * Sort spans by reading order (Y then X), with tolerance on normalized coordinates.
     */
    export const sortByReadingOrder = (spans: PdfTextSpan[], lineTolerance = 0.005): PdfTextSpan[] => {
        return [...spans].sort((a, b) => {
            const yDiff = a.normalizedBounds.y1 - b.normalizedBounds.y1
            if (Math.abs(yDiff) > lineTolerance) {
                return yDiff
            }
            return a.normalizedBounds.x1 - b.normalizedBounds.x1
        })
    }

    /**
     * Collect span text that overlaps the query region.
     * query and spans[].bounds must share the same coordinate system (typically OCR page image pixels).
     */
    export const collectTextInBounds = (
        spans: PdfTextSpan[],
        query: PdfAxisAlignedRect,
        options?: PdfTextSpanCollectOptions
    ): string => {
        const minOverlapRatio = options?.minOverlapRatio ?? 0.05
        const minSpanCoverage = options?.minSpanCoverage ?? 0.4
        const queryArea = rectArea(query)
        if (queryArea <= 0) {
            return ''
        }

        const matched = spans.filter((span) => {
            if (!span.text) {
                return false
            }

            // If the span center falls inside the query, treat the character as included
            // (even when the area overlap ratio is below the threshold).
            if (isPointInRect(rectCenter(span.bounds), query)) {
                return true
            }

            const intersection = intersectRect(span.bounds, query)
            if (!intersection) {
                return false
            }

            const overlapArea = rectArea(intersection)
            const spanArea = rectArea(span.bounds)
            const queryCoverage = overlapArea / queryArea
            const spanCoverage = spanArea > 0 ? overlapArea / spanArea : 0

            // Large query / small span and small query / large span need queryCoverage and
            // spanCoverage respectively; either threshold is enough (AND would wrongly reject
            // spans that are fully contained in the query).
            if (queryCoverage < minOverlapRatio && spanCoverage < minSpanCoverage) {
                return false
            }
            return true
        })

        return matched.map((span) => span.text).join('')
    }
