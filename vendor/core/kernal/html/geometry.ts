import type { FlipMode, WritingMode } from "../types";
import type { Rect } from "../common/geometry";
import { findLastNode } from "./finder";

export type EdgeRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};

export type OrderedIntersectOptions = {
    writingMode?: WritingMode;
    fullVisible?: boolean;
    /** Stop after this many consecutive misses past the viewport (default 8). */
    missStreakToStop?: number;
};

export const getBaseState = (base: Range | Element[] | Element) => {
    let baseDocument: Document;
    let baseWindow: Window;
    let baseBoundingRect: { left: number, top: number, width: number, height: number, right: number, bottom: number };
    let baseRects: { left: number, top: number, width: number, height: number, right: number, bottom: number }[] = [];
    let firstBaseNode: Node;
    let lastBaseNode: Node;
    let baseType: 'elements' | 'element' | 'range'
    if (Array.isArray(base)) {
        baseType = 'elements';
        firstBaseNode = base[0];
        lastBaseNode = base[base.length - 1];
        baseDocument = firstBaseNode.ownerDocument;
        baseWindow = baseDocument.defaultView
        if (base.length > 1) {
            const range = baseWindow.document.createRange();
            range.setStart(firstBaseNode, 0)
            const endElement = base[base.length - 1];
            const lastNode = findLastNode(endElement);
            if (lastNode.nodeType == Node.TEXT_NODE) {
                range.setEnd(lastNode, lastNode.textContent.length)
            }
            else {
                range.setEnd(lastNode, 0)
            }
            const rangeBoundingRect = range.getBoundingClientRect();
            baseBoundingRect = { left: rangeBoundingRect.left, top: rangeBoundingRect.top, width: rangeBoundingRect.width, height: rangeBoundingRect.height, right: rangeBoundingRect.right, bottom: rangeBoundingRect.bottom };
            for (const el of base) {
                const rects = el.getClientRects();
                baseRects.push(...Array.from(rects).map(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom })));
            }
        }
        else {
            baseBoundingRect = base[0].getBoundingClientRect();
            baseRects = Array.from(base[0].getClientRects()).map(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }));
        }
    }
    else if (Object.prototype.hasOwnProperty.call(base, "tagName") || (base as any).tagName) {
        baseType = 'element';
        firstBaseNode = (base as Element)
        lastBaseNode = firstBaseNode;
        baseDocument = firstBaseNode.ownerDocument;
        baseWindow = baseDocument.defaultView;
        baseBoundingRect = (base as Element).getBoundingClientRect();
        baseRects = Array.from((base as Element).getClientRects()).map(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }));
    }
    else {
        baseType = 'range';
        firstBaseNode = (base as Range).startContainer;
        lastBaseNode = (base as Range).endContainer;
        baseDocument = firstBaseNode.ownerDocument;
        baseWindow = baseDocument.defaultView;
        baseBoundingRect = (base as Range).getBoundingClientRect();
        baseRects = Array.from((base as Range).getClientRects()).map(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }));
    }
    return {
        firstBaseNode,
        lastBaseNode,
        baseWindow,
        baseDocument,
        baseBoundingRect,
        baseType,
        baseRects
    }
};

export const hiddenToolbarPosition = { left: -100000, top: -100000, visible: false };

const isCompletelyVisible = (parent: Rect, child: Rect): boolean => {
    const parentRight = parent.left + parent.width;
    const parentBottom = parent.top + parent.height;
    const childRight = child.left + child.width;
    const childBottom = child.top + child.height;
    return (
        child.left >= parent.left &&
        child.top >= parent.top &&
        childRight <= parentRight &&
        childBottom <= parentBottom
    );
};

/** Intersection of a rect with the container's visible area; returns null if none */
export const intersectWithContainer = (container: Rect, rect: Rect): Rect | null => {
    const cRight = container.left + container.width;
    const cBottom = container.top + container.height;
    const rRight = rect.left + rect.width;
    const rBottom = rect.top + rect.height;
    const left = Math.max(container.left, rect.left);
    const top = Math.max(container.top, rect.top);
    const right = Math.min(cRight, rRight);
    const bottom = Math.min(cBottom, rBottom);
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0)
        return null;
    return { left, top, width, height };
};

const mergeRects = (rects: Rect[]): Rect => {
    return rects.reduce((acc, rect) => {
        const left = Math.min(acc.left, rect.left);
        const top = Math.min(acc.top, rect.top);
        const right = Math.max(acc.left + acc.width, rect.left + rect.width);
        const bottom = Math.max(acc.top + acc.height, rect.top + rect.height);
        return {
            left,
            top,
            width: right - left,
            height: bottom - top
        };
    });
};

/** Convert selection client rects into the viewport coordinates of displayElement's window */
export const normalizeBaseRectsInDisplayWindow = (base: Range | Element[] | Element, displayWindow: Window): { normalizedRects: Rect[]; inSameWindow: boolean } | null => {
    let { baseWindow, baseRects } = getBaseState(base);
    const normalizedRects = baseRects.map(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }));

    while (displayWindow != baseWindow) {
        const frameElement = baseWindow.frameElement;
        const parent = frameElement?.ownerDocument?.defaultView
        if (!parent)
            break;
        baseWindow = parent
        const frameElementRect = frameElement.getBoundingClientRect();
        normalizedRects.forEach(rect => {
            rect.left += frameElementRect.left;
            rect.top += frameElementRect.top;
        });
    }

    if (displayWindow != baseWindow)
        return { normalizedRects: [], inSameWindow: false };

    return { normalizedRects, inSameWindow: true };
};

/** Resolve a valid positioning rect for the selection within the container */
export const resolveVisibleBaseRectInContainer = (normalizedRects: Rect[], containerRect: Rect, allowPartialVisibility = true): Rect | null => {
    const visibleBaseRects = normalizedRects.filter(rect => isCompletelyVisible(containerRect, rect));
    if (visibleBaseRects.length > 0)
        return mergeRects(visibleBaseRects);

    if (!allowPartialVisibility)
        return null;

    const minVisibleArea = 4;
    const partials: { clipped: Rect; origArea: number }[] = [];
    for (const rect of normalizedRects) {
        const clipped = intersectWithContainer(containerRect, rect);
        if (!clipped)
            continue;
        const visArea = clipped.width * clipped.height;
        if (visArea < minVisibleArea)
            continue;
        partials.push({ clipped, origArea: rect.width * rect.height });
    }
    if (partials.length === 0)
        return null;

    partials.sort((a, b) => {
        const da = a.clipped.width * a.clipped.height;
        const db = b.clipped.width * b.clipped.height;
        if (db !== da)
            return db - da;
        return b.origArea - a.origArea;
    });
    return partials[0].clipped;
};

export const toRect = (rect: { left: number; top: number; width: number; height: number }): Rect => ({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
});

export const applyContainerInset = (containerRect: Rect, inset?: { top?: number; bottom?: number; left?: number; right?: number }): Rect => {
    if (!inset)
        return containerRect;
    return {
        left: containerRect.left + (inset.left ?? 0),
        top: containerRect.top + (inset.top ?? 0),
        width: containerRect.width - (inset.left ?? 0) - (inset.right ?? 0),
        height: containerRect.height - (inset.top ?? 0) - (inset.bottom ?? 0)
    };
};

export type ToolbarPreferPosition = "top" | "bottom" | "right";

/**
 * Compute toolbar left/top from a base rect and container.
 * @param containerRect Container rect
 * @param baseRect Base rect
 * @param displayElement Display element
 * @param toolbarPreferPosition Preferred toolbar position
 * @param bias Offset bias
 * @returns \{ left: number; top: number; visible: boolean \}
 */
export const calcToolbarPositionFromRect = (
    containerRect: Rect,
    baseRect: Rect,
    displayElement: Element,
    toolbarPreferPosition: ToolbarPreferPosition = "bottom",
    bias = 5
): { left: number; top: number; visible: boolean } => {
    const displayElementRect = displayElement.getBoundingClientRect();
    const toolbarWidth = displayElementRect.width;
    const toolbarHeight = displayElementRect.height;
    const selectionRight = baseRect.left + baseRect.width;
    const selectionBottom = baseRect.top + baseRect.height;
    const containerBottom = containerRect.top + containerRect.height;
    const spaceBelow = containerBottom - selectionBottom;
    const spaceAbove = baseRect.top - containerRect.top;
    const spaceRequired = toolbarHeight + bias;
    const containerLeft = containerRect.left;
    const containerRight = containerRect.left + containerRect.width;

    if (toolbarPreferPosition === "right") {
        let left = selectionRight + bias;
        const maxLeft = containerRight - toolbarWidth - bias;
        if (left > maxLeft) {
            left = maxLeft;
        }

        const centerY = baseRect.top + baseRect.height / 2;
        const top = centerY - toolbarHeight / 2;
        return { left, top, visible: true };
    }

    const centerX = baseRect.left + baseRect.width / 2;
    const preferredLeft = centerX - toolbarWidth / 2;
    let left: number;
    if (preferredLeft < containerLeft + bias) {
        left = containerLeft + bias;
    }
    else if (preferredLeft + toolbarWidth > containerRight - bias) {
        left = containerRight - toolbarWidth - bias;
    }
    else {
        left = preferredLeft;
    }

    const preferTop = toolbarPreferPosition === "top";

    if (spaceBelow >= spaceRequired && spaceAbove >= spaceRequired) {
        const top = preferTop
            ? baseRect.top - toolbarHeight - bias
            : selectionBottom + bias;
        return { left, top, visible: true };
    }
    if (spaceBelow >= spaceRequired) {
        return { left, top: selectionBottom + bias, visible: true };
    }
    if (spaceAbove >= spaceRequired) {
        return { left, top: baseRect.top - toolbarHeight - bias, visible: true };
    }
    const centerY = baseRect.top + baseRect.height / 2;
    return { left, top: centerY - toolbarHeight / 2, visible: true };
};

/** Compute toolbar position within a container (multi-rect visibility + placement) */
export const calcToolbarPositionInContainer = (
    containerElement: HTMLElement,
    base: Range | Element[] | Element,
    displayElement: Element,
    toolbarPreferPosition?: ToolbarPreferPosition,
    containerInset?: { top?: number; bottom?: number; left?: number; right?: number }
): { left: number; top: number; visible: boolean } => {
    if (!displayElement || !base)
        return hiddenToolbarPosition;

    const displayWindow = displayElement.ownerDocument.defaultView;
    const normalized = normalizeBaseRectsInDisplayWindow(base, displayWindow);
    if (!normalized?.inSameWindow)
        return hiddenToolbarPosition;

    const containerRect = applyContainerInset(toRect(containerElement.getBoundingClientRect()), containerInset);
    const baseRect = resolveVisibleBaseRectInContainer(normalized.normalizedRects, containerRect, true);
    if (!baseRect)
        return hiddenToolbarPosition;

    return calcToolbarPositionFromRect(containerRect, baseRect, displayElement, toolbarPreferPosition ?? "bottom");
};

export const checkRangeOrElementIsVisible = (rendererContainer: Element, base: Range | Element[] | Element, displayWindow: Window, margin?: { left?: number, right?: number, top?: number, bottom?: number }): { left: number, top: number, visible: boolean } => {
    if (!base)
        return hiddenToolbarPosition;

    const normalized = normalizeBaseRectsInDisplayWindow(base, displayWindow);
    if (!normalized?.inSameWindow)
        return hiddenToolbarPosition;

    let normalizedRects = normalized.normalizedRects;
    const rendererContainerRect = toRect(rendererContainer.getBoundingClientRect());
    const visibleContainerRect = applyContainerInset(rendererContainerRect, margin);

    if (margin?.left != null || margin?.right != null || margin?.top != null || margin?.bottom != null) {
        normalizedRects = normalizedRects.map(rect => ({
            left: rect.left + (margin?.left ?? 0),
            top: rect.top + (margin?.top ?? 0),
            width: rect.width - (margin?.left ?? 0) - (margin?.right ?? 0),
            height: rect.height - (margin?.top ?? 0) - (margin?.bottom ?? 0)
        }));
    }

    const finalBaseBoundingRect = resolveVisibleBaseRectInContainer(normalizedRects, visibleContainerRect, false);
    if (!finalBaseBoundingRect)
        return hiddenToolbarPosition;

    return { left: finalBaseBoundingRect.left, top: finalBaseBoundingRect.top, visible: true };
};

export const recalculateRect = (baseBoundingRect: { left: number; top: number; width: number; height: number; right: number; bottom: number; }, firstBaseNode: Node, lastBaseNode: Node, baseWindow: Window) => {
    const baseWindowInnerWidth = baseWindow.innerWidth;
    const baseWindowInnerHeight = baseWindow.innerHeight;
    if (baseBoundingRect.left < 0 || Math.floor(baseBoundingRect.right) > baseWindowInnerWidth) {
        if (baseBoundingRect.left >= 0) {
            const firstBaseNodeRects = firstBaseNode.nodeType != Node.ELEMENT_NODE ? firstBaseNode.parentElement.getClientRects() : (firstBaseNode as Element).getClientRects();
            const firstBaseNodeRect = firstBaseNodeRects[0];
            const visibleWidth = baseWindowInnerWidth - firstBaseNodeRect.left;
            const visibleHeight = baseWindowInnerHeight - firstBaseNodeRect.top;
            baseBoundingRect = {
                left: firstBaseNodeRect.left,
                top: firstBaseNodeRect.top,
                width: visibleWidth,
                height: visibleHeight,
                right: firstBaseNodeRect.left + visibleWidth,
                bottom: firstBaseNodeRect.top + visibleHeight
            };
        }
        else {
            const lastBaseNodeRects = lastBaseNode.nodeType != Node.ELEMENT_NODE ? lastBaseNode.parentElement.getClientRects() : (lastBaseNode as Element).getClientRects();
            const lastBaseNodeRect = lastBaseNodeRects[lastBaseNodeRects.length - 1];
            const remainRightWidth = Math.floor(baseBoundingRect.width + baseBoundingRect.left);
            if (remainRightWidth < baseWindowInnerWidth || (remainRightWidth == baseWindowInnerWidth && lastBaseNodeRect.bottom < baseWindowInnerHeight)) {
                let maxRemainWidth = lastBaseNodeRect.right;
                let minRemainLeft = lastBaseNodeRect.left;
                let minRemainTop = lastBaseNodeRect.top;
                for (let i = 0; i < lastBaseNodeRects.length; i++) {
                    if (lastBaseNodeRects[i].left < 0)
                        continue;
                    const currentRect = lastBaseNodeRects[i];
                    if (maxRemainWidth < currentRect.width) {
                        maxRemainWidth = currentRect.width;
                    }
                    if (minRemainLeft > currentRect.left) {
                        minRemainLeft = currentRect.left;
                    }
                    if (minRemainTop > currentRect.top) {
                        minRemainTop = currentRect.top;
                    }
                }
                const visibleWidth = maxRemainWidth;
                const visibleHeight = lastBaseNodeRect.bottom;
                baseBoundingRect = {
                    left: minRemainLeft,
                    top: minRemainTop,
                    width: visibleWidth,
                    height: visibleHeight,
                    right: minRemainLeft + visibleWidth,
                    bottom: minRemainTop + visibleHeight
                };

            }
            else {
                baseBoundingRect = {
                    left: 0,
                    top: 0,
                    width: baseWindowInnerWidth,
                    height: baseWindowInnerHeight,
                    right: baseWindowInnerWidth,
                    bottom: baseWindowInnerHeight
                };
            }
        }
    }
    return baseBoundingRect;
};

export const calcToolbarPosition = (ownerPanel: HTMLElement, base: Range | Element[] | Element, displayElement: Element, toolbarPreferPosition?: ToolbarPreferPosition, flipMode?: FlipMode): { left: number, top: number, visible: boolean } => {
    if (!displayElement || !base)
        return hiddenToolbarPosition;

    const topContainerHeight = 50;
    const bottomContainerHeight = 50;
    const containerInset = { top: topContainerHeight, bottom: bottomContainerHeight };
    const preferPosition = toolbarPreferPosition ?? "bottom";

    if (flipMode == "page") {
        let { firstBaseNode, lastBaseNode, baseWindow, baseBoundingRect } = getBaseState(base);

        const baseWindowInnerWidth = baseWindow.innerWidth;
        const baseWindowInnerHeight = baseWindow.innerHeight;
        const baseBoundingRectLeft = Math.round(baseBoundingRect.left);
        if (baseBoundingRect.right < 0)
            return hiddenToolbarPosition;

        if (baseBoundingRectLeft > baseWindowInnerWidth)
            return hiddenToolbarPosition;

        if (baseBoundingRect.bottom < 0)
            return hiddenToolbarPosition;

        if (baseBoundingRect.top > baseWindowInnerHeight)
            return hiddenToolbarPosition;

        baseBoundingRect = recalculateRect(baseBoundingRect, firstBaseNode, lastBaseNode, baseWindow);

        let left = baseBoundingRect.left;
        let top = baseBoundingRect.top;
        const displayWindow = displayElement.ownerDocument.defaultView;
        while (displayWindow != baseWindow) {
            const frameElement = baseWindow.frameElement;
            const parent = frameElement?.ownerDocument?.defaultView
            if (!parent)
                break;
            baseWindow = parent
            const frameElementRect = frameElement.getBoundingClientRect();
            left += frameElementRect.left;
            top += frameElementRect.top;
        }
        if (displayWindow != baseWindow)
            return hiddenToolbarPosition;

        const containerRect = applyContainerInset(toRect(ownerPanel.getBoundingClientRect()), containerInset);
        const baseRect: Rect = { left, top, width: baseBoundingRect.width, height: baseBoundingRect.height };
        return calcToolbarPositionFromRect(containerRect, baseRect, displayElement, preferPosition);
    }

    return calcToolbarPositionInContainer(ownerPanel, base, displayElement, preferPosition, containerInset);
};

export const containsRect = (source: { left: number, top: number, right: number, bottom: number }, target: { left: number, top: number, right: number, bottom: number }) => {
    return target.left >= source.left
        && target.top >= source.top
        && target.right <= source.right
        && target.bottom <= source.bottom;
};

export const intersectRect = (source: { left: number, top: number, right: number, bottom: number }, target: { left: number, top: number, right: number, bottom: number }) => {
    return target.right > source.left
        && target.left < source.right
        && target.top < source.bottom
        && target.bottom > source.top;
};

const isVerticalWritingMode = (writingMode?: WritingMode) =>
    writingMode == "vertical-lr" || writingMode == "vertical-rl";

const toEdgeRect = (rect: { left: number; top: number; right: number; bottom: number }): EdgeRect => ({
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom
});

/** Whether the rect is completely before the viewport along reading flow. */
const isCompletelyBeforeViewport = (rect: EdgeRect, viewport: EdgeRect, writingMode?: WritingMode) => {
    if (isVerticalWritingMode(writingMode)) {
        if (writingMode == "vertical-rl") {
            return rect.left >= viewport.right || rect.bottom <= viewport.top;
        }
        return rect.right <= viewport.left || rect.bottom <= viewport.top;
    }
    return rect.bottom <= viewport.top || rect.right <= viewport.left;
};

/** Whether the rect is completely after the viewport along reading flow. */
const isCompletelyAfterViewport = (rect: EdgeRect, viewport: EdgeRect, writingMode?: WritingMode) => {
    if (isVerticalWritingMode(writingMode)) {
        if (writingMode == "vertical-rl") {
            return rect.right <= viewport.left || rect.top >= viewport.bottom;
        }
        return rect.left >= viewport.right || rect.top >= viewport.bottom;
    }
    return rect.top >= viewport.bottom || rect.left >= viewport.right;
};

/**
 * Resolve the visually visible area inside contentWindow coordinates.
 * When content lives in an iframe, clips by the parent window (and optional top inset).
 */
export const resolveVisibleViewportInContentWindow = (
    contentWindow: Window,
    options?: { topInset?: number; bottomInset?: number; leftInset?: number; rightInset?: number }
): EdgeRect | null => {
    let viewport: EdgeRect = {
        left: 0,
        top: 0,
        right: contentWindow.innerWidth,
        bottom: contentWindow.innerHeight
    };

    const frameElement = contentWindow.frameElement as Element | null;
    const parentWindow = frameElement?.ownerDocument?.defaultView;
    if (frameElement && parentWindow) {
        const frameRect = frameElement.getBoundingClientRect();
        const parentViewport: EdgeRect = {
            left: 0,
            top: 0,
            right: parentWindow.innerWidth,
            bottom: parentWindow.innerHeight
        };
        const clippedLeft = Math.max(frameRect.left, parentViewport.left);
        const clippedTop = Math.max(frameRect.top, parentViewport.top);
        const clippedRight = Math.min(frameRect.right, parentViewport.right);
        const clippedBottom = Math.min(frameRect.bottom, parentViewport.bottom);
        if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) {
            return null;
        }
        viewport = {
            left: clippedLeft - frameRect.left,
            top: clippedTop - frameRect.top,
            right: clippedRight - frameRect.left,
            bottom: clippedBottom - frameRect.top
        };
    }

    const left = viewport.left + (options?.leftInset ?? 0);
    const top = viewport.top + (options?.topInset ?? 0);
    const right = viewport.right - (options?.rightInset ?? 0);
    const bottom = viewport.bottom - (options?.bottomInset ?? 0);
    if (right <= left || bottom <= top) {
        return null;
    }
    return { left, top, right, bottom };
};

/**
 * Find visible elements among reading-order candidates via binary search + linear scan.
 * Only calls getBoundingClientRect on O(log n + k) elements in typical single-column flow.
 */
export const getOrderedElementsIntersectingRect = (
    candidates: Element[],
    viewport: EdgeRect,
    options?: OrderedIntersectOptions
): Element[] => {
    if (!candidates.length) {
        return [];
    }

    const writingMode = options?.writingMode;
    const fullVisible = options?.fullVisible ?? false;
    const missStreakToStop = options?.missStreakToStop ?? 8;
    const matches = (rect: EdgeRect) =>
        fullVisible ? containsRect(viewport, rect) : intersectRect(viewport, rect);

    let low = 0;
    let high = candidates.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        const midRect = toEdgeRect(candidates[mid].getBoundingClientRect());
        if (isCompletelyBeforeViewport(midRect, viewport, writingMode)) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }

    const visible: Element[] = [];
    let missStreak = 0;
    let hasVisible = false;
    for (let i = low; i < candidates.length; i++) {
        const rect = toEdgeRect(candidates[i].getBoundingClientRect());
        if (matches(rect)) {
            visible.push(candidates[i]);
            hasVisible = true;
            missStreak = 0;
            continue;
        }
        if (hasVisible && isCompletelyAfterViewport(rect, viewport, writingMode)) {
            missStreak++;
            if (missStreak >= missStreakToStop) {
                break;
            }
        }
    }
    return visible;
};

/**
 * Get a Range from x,y coordinates.
 * @param x X coordinate
 * @param y Y coordinate
 * @returns Range | null
 */
export const getRangeFromPoint = (doc: Document, x: number, y: number) => {
    // WebKit / Blink
    if (doc.caretRangeFromPoint) {
        return doc.caretRangeFromPoint(x, y);
    }
    // Firefox / standard
    if (doc.caretPositionFromPoint) {
        const pos = doc.caretPositionFromPoint(x, y);
        if (pos) {
            const range = doc.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.setEnd(pos.offsetNode, pos.offset);
            return range;
        }
    }
    return null;
}

/**
 * Get a Range covering the last line of an element range.
 * @param elementRange Element range
 * @returns Range | null
 */
export const getLastLineRangeFromElementRange = (elementRange: Range) => {
    // Client rects for each line (elementRange on a block element yields one rect per line)
    const rects = elementRange.getClientRects();
    if (rects.length === 0)
        return null;
    let lastRect: DOMRect;
    for (let i = rects.length - 1; i >= 0; i--) {
        if (rects[i].height > 0) {
            lastRect = rects[i];
            break;
        }
    }
    if (!lastRect)
        return null;
    const ownerDocument = elementRange.startContainer.ownerDocument;
    // Start of the last line (top-left)
    const startRange = getRangeFromPoint(ownerDocument, lastRect.left, lastRect.top);
    // End of the last line (near bottom-right, inset to avoid landing on the next line)
    const endRange = getRangeFromPoint(ownerDocument, lastRect.right - 1, lastRect.bottom - 1);

    if (!startRange || !endRange) return null;

    const newRange = ownerDocument.createRange();
    newRange.setStart(startRange.startContainer, startRange.startOffset);
    newRange.setEnd(endRange.startContainer, endRange.startOffset);
    return newRange;
}