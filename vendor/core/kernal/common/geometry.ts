
/** Axis-aligned rectangle (uses left / top). */
export type Rect = {
    left: number
    top: number
    width: number
    height: number
}


/**
 * Check whether two rectangles intersect (left / top / width / height).
 */
export const intersect = (source: Rect, target: Rect) => {
    return target.left + target.width > source.left
        && target.left < source.left + source.width
        && target.top < source.top + source.height
        && target.top + target.height > source.top;
};

export const toRectBounds = (rect: Rect) => {
    return {
        left: rect.left,
        top: rect.top,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height
    }
}

export const rectToPath = (rect: Rect) => {
    const { left, top, right, bottom } = toRectBounds(rect)
    return [
        { X: left, Y: top },
        { X: left, Y: bottom },
        { X: right, Y: bottom },
        { X: right, Y: top }
    ]
}
