export type OverlayRect = {
    x: number
    y: number
    width: number
    height: number
}

export type PaintRectSpec = {
    id: string
    className: string
    idAttr?: string
    attrs?: Record<string, string>
    extraStyle?: string
    /** When true (default), drop existing masks with this id before painting. */
    replace?: boolean
}

export type EnsureOverlayLayerOptions = {
    relativeClass?: string
    /** Size the layer to the host scroll box (HTML reflow). Default uses client box. */
    sizeToScroll?: boolean
    /** When set, size the layer to this element's client box (e.g. the iframe). */
    sizeElement?: HTMLElement
}

const DEFAULT_ID_ATTR = "data-highlight-id"

const createDiv = (ownerDocument: Document, className: string): HTMLElement => {
    const el = ownerDocument.createElement("div")
    el.className = className
    return el
}

export const ensureOverlayLayer = (
    host: HTMLElement,
    layerClass: string,
    options?: EnsureOverlayLayerOptions,
): HTMLElement => {
    let layer = host.querySelector<HTMLElement>(`:scope > .${layerClass}`)
    if (!layer) {
        layer = createDiv(host.ownerDocument, layerClass)
        host.appendChild(layer)
        const style = host.ownerDocument.defaultView?.getComputedStyle(host)
        if (style && style.position === "static") {
            if (options?.relativeClass) {
                host.classList.add(options.relativeClass)
            } else {
                host.style.position = "relative"
            }
        }
    }
    const sizeElement = options?.sizeElement
    const width = sizeElement
        ? sizeElement.clientWidth
        : options?.sizeToScroll
            ? Math.max(host.clientWidth, host.scrollWidth)
            : host.clientWidth
    const height = sizeElement
        ? sizeElement.clientHeight
        : options?.sizeToScroll
            ? Math.max(host.clientHeight, host.scrollHeight)
            : host.clientHeight
    const widthPx = `${width}px`
    const heightPx = `${height}px`
    if (layer.style.width !== widthPx) {
        layer.style.width = widthPx
    }
    if (layer.style.height !== heightPx) {
        layer.style.height = heightPx
    }
    return layer
}

export const removeOverlaysById = (
    root: ParentNode,
    ids: string[],
    idAttr = DEFAULT_ID_ATTR,
): void => {
    for (const id of ids) {
        if (!id) {
            continue
        }
        root.querySelectorAll(`[${idAttr}="${CSS.escape(id)}"]`).forEach((node) => node.remove())
    }
}

export const removeOverlayLayers = (root: ParentNode, layerClass: string): void => {
    root.querySelectorAll(`.${layerClass}`).forEach((layer) => layer.remove())
}

export const paintRects = (
    layer: HTMLElement,
    rects: OverlayRect[],
    spec: PaintRectSpec,
): void => {
    const idAttr = spec.idAttr ?? DEFAULT_ID_ATTR
    if (spec.replace !== false) {
        layer.querySelectorAll(`[${idAttr}="${CSS.escape(spec.id)}"]`).forEach((node) => node.remove())
    }
    const ownerDocument = layer.ownerDocument
    for (const rect of rects) {
        if (rect.width <= 0 || rect.height <= 0) {
            continue
        }
        const mask = createDiv(ownerDocument, spec.className)
        mask.setAttribute(idAttr, spec.id)
        if (spec.attrs) {
            for (const [key, value] of Object.entries(spec.attrs)) {
                mask.setAttribute(key, value)
            }
        }
        const extra = spec.extraStyle ?? ""
        mask.setAttribute(
            "style",
            `${extra}left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;`,
        )
        layer.appendChild(mask)
    }
}

const isPointInBox = (
    x: number,
    y: number,
    left: number,
    top: number,
    right: number,
    bottom: number,
    slop = 1,
): boolean =>
    x >= left - slop && x <= right + slop && y >= top - slop && y <= bottom + slop

export const findOverlayIdAtPoint = (
    host: HTMLElement,
    maskClass: string,
    offsetX: number,
    offsetY: number,
    idAttr = DEFAULT_ID_ATTR,
): string | undefined => {
    const masks = host.querySelectorAll<HTMLElement>(`.${maskClass}`)
    for (let i = masks.length - 1; i >= 0; i--) {
        const mask = masks[i]
        const left = Number.parseFloat(mask.style.left)
        const top = Number.parseFloat(mask.style.top)
        const width = Number.parseFloat(mask.style.width)
        const height = Number.parseFloat(mask.style.height)
        if (isPointInBox(offsetX, offsetY, left, top, left + width, top + height)) {
            return mask.getAttribute(idAttr) ?? undefined
        }
    }
    return undefined
}

export const findOverlayAtClientPoint = (
    root: ParentNode,
    maskClass: string,
    clientX: number,
    clientY: number,
): HTMLElement | undefined => {
    const masks = root.querySelectorAll<HTMLElement>(`.${maskClass}`)
    for (let i = masks.length - 1; i >= 0; i--) {
        const mask = masks[i]
        const box = mask.getBoundingClientRect()
        if (isPointInBox(clientX, clientY, box.left, box.top, box.right, box.bottom)) {
            return mask
        }
    }
    return undefined
}

export const findOverlayIdAtClientPoint = (
    root: ParentNode,
    maskClass: string,
    clientX: number,
    clientY: number,
    idAttr = DEFAULT_ID_ATTR,
): string | undefined => {
    return findOverlayAtClientPoint(root, maskClass, clientX, clientY)?.getAttribute(idAttr) ?? undefined
}

export type OverlayWritingAxis = 'horizontal' | 'vertical'

const textOffsetsInRange = (range: Range, text: Text) => {
    const start = range.startContainer === text ? range.startOffset : 0
    const end = range.endContainer === text ? range.endOffset : text.data.length
    return { start, end }
}

/**
 * Line boxes of text inside a Range. Avoids Range#getClientRects adding the
 * border box of a fully enclosed middle paragraph (including a one-line p).
 */
export const rangeTextClientRects = (range: Range): DOMRect[] => {
    const doc = range.startContainer.ownerDocument
    if (!doc) {
        return Array.from(range.getClientRects())
    }
    const ancestor = range.commonAncestorContainer
    if (ancestor.nodeType === Node.TEXT_NODE) {
        return Array.from(range.getClientRects())
    }
    const walker = doc.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT)
    const rects: DOMRect[] = []
    let node = walker.nextNode()
    while (node) {
        const text = node as Text
        if (text.data.length > 0 && range.intersectsNode(text)) {
            const { start, end } = textOffsetsInRange(range, text)
            if (end > start) {
                const sub = doc.createRange()
                sub.setStart(text, start)
                sub.setEnd(text, end)
                rects.push(...Array.from(sub.getClientRects()))
            }
        }
        node = walker.nextNode()
    }
    return rects.length > 0 ? rects : Array.from(range.getClientRects())
}

const containsRect = (outer: OverlayRect, inner: OverlayRect, slop = 1) =>
    outer.x <= inner.x + slop &&
    outer.y <= inner.y + slop &&
    outer.x + outer.width >= inner.x + inner.width - slop &&
    outer.y + outer.height >= inner.y + inner.height - slop

const blockSizeOf = (rect: OverlayRect, writingAxis: OverlayWritingAxis) =>
    writingAxis === 'vertical' ? rect.width : rect.height

/**
 * Drop block-element border boxes that Range#getClientRects adds when a
 * middle paragraph is fully enclosed by a multi-paragraph selection.
 * Keep line boxes that merely wrap a same-height inline span.
 */
export const dropContainingRects = (
    rects: OverlayRect[],
    writingAxis: OverlayWritingAxis = 'horizontal',
): OverlayRect[] => {
    if (rects.length <= 1) {
        return rects
    }
    return rects.filter((rect, i) => {
        const outerBlock = blockSizeOf(rect, writingAxis)
        return !rects.some((inner, j) => {
            if (i === j) {
                return false
            }
            if (!containsRect(rect, inner)) {
                return false
            }
            const innerBlock = blockSizeOf(inner, writingAxis)
            return outerBlock > innerBlock + Math.max(4, innerBlock * 0.25)
        })
    })
}

/** Merge adjacent boxes on the same line to cut overlay node count. */
export const mergeOverlayRects = (
    rects: OverlayRect[],
    gap = 1,
    writingAxis: OverlayWritingAxis = 'horizontal',
): OverlayRect[] => {
    const valid = rects.filter((rect) => rect.width > 0 && rect.height > 0)
    if (valid.length <= 1) {
        return valid
    }
    const isVertical = writingAxis === 'vertical'
    const sorted = [...valid].sort((a, b) => {
        if (isVertical) {
            return a.x === b.x ? a.y - b.y : a.x - b.x
        }
        return a.y === b.y ? a.x - b.x : a.y - b.y
    })
    const merged: OverlayRect[] = []
    for (const rect of sorted) {
        const last = merged[merged.length - 1]
        if (!last) {
            merged.push({ ...rect })
            continue
        }
        const sameLine = isVertical
            ? Math.abs(rect.x - last.x) <= gap &&
              Math.abs(rect.width - last.width) <= Math.max(2, last.width * 0.35)
            : Math.abs(rect.y - last.y) <= gap &&
              Math.abs(rect.height - last.height) <= Math.max(2, last.height * 0.35)
        const adjacent = isVertical
            ? rect.y <= last.y + last.height + gap
            : rect.x <= last.x + last.width + gap
        if (sameLine && adjacent) {
            const right = Math.max(last.x + last.width, rect.x + rect.width)
            const bottom = Math.max(last.y + last.height, rect.y + rect.height)
            last.x = Math.min(last.x, rect.x)
            last.y = Math.min(last.y, rect.y)
            last.width = right - last.x
            last.height = bottom - last.y
            continue
        }
        merged.push({ ...rect })
    }
    return merged
}

export const clientRectsToOverlayRects = (
    layer: HTMLElement,
    clientRects: ArrayLike<DOMRect>,
    writingAxis: OverlayWritingAxis = 'horizontal',
    originRect?: Pick<DOMRect, 'left' | 'top'>,
): OverlayRect[] => {
    const origin = originRect ?? layer.getBoundingClientRect()
    const rects: OverlayRect[] = []
    for (let i = 0; i < clientRects.length; i++) {
        const rect = clientRects[i]
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            continue
        }
        rects.push({
            x: rect.left - origin.left,
            y: rect.top - origin.top,
            width: rect.width,
            height: rect.height,
        })
    }
    return mergeOverlayRects(dropContainingRects(rects, writingAxis), 1, writingAxis)
}
