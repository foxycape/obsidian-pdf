export type PdfClientRect = {
    x: number;
    y: number;
    width: number;
    height: number;
    endX: number;
    endY: number;
};

export type PdfPageClientRect = PdfClientRect & {
    pageNumber: number;
};

type AlignType = "horizontal" | "vertical" | "unknown";

type OverlayKind = "N" | "XY" | "X" | "Y";

type RectGroup = {
    currentRects: PdfClientRect[];
    isVertical: boolean;
};

const findPageElement = (node: Node | null): HTMLElement | null => {
    let el: Node | null = node;
    while (el) {
        if (
            el.nodeType === Node.ELEMENT_NODE &&
            (el as Element).classList?.contains("page") &&
            (el as Element).hasAttribute("data-page-number")
        ) {
            return el as HTMLElement;
        }
        el = el.parentElement ?? (el.parentNode as Node | null);
    }
    return null;
};

const getPageNumberFromElement = (pageEl: Element): number | undefined => {
    const raw = pageEl.getAttribute("data-page-number");
    if (!raw) {
        return undefined;
    }
    const pageNumber = Number.parseInt(raw, 10);
    return Number.isFinite(pageNumber) ? pageNumber : undefined;
};

/**
 * Resolve page number for a client rect by containment against `.page` elements.
 */
export const resolvePageNumberForRect = (
    rect: DOMRect | PdfClientRect,
    pageElements: HTMLElement[],
): number | undefined => {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    for (const pageEl of pageElements) {
        const pageRect = pageEl.getBoundingClientRect();
        if (
            cx >= pageRect.left &&
            cx <= pageRect.right &&
            cy >= pageRect.top &&
            cy <= pageRect.bottom
        ) {
            return getPageNumberFromElement(pageEl);
        }
    }
    return undefined;
};

/**
 * Collect page elements under the PDF viewer container.
 */
export const collectPageElements = (root: ParentNode): HTMLElement[] => {
    return Array.from(root.querySelectorAll<HTMLElement>("div.page[data-page-number]"));
};

const normalizeRect = <T extends PdfClientRect>(rect: T): T => {
    const endX = Number.isFinite(rect.endX) ? rect.endX : rect.x + rect.width;
    const endY = Number.isFinite(rect.endY) ? rect.endY : rect.y + rect.height;
    return {
        ...rect,
        x: rect.x,
        y: rect.y,
        width: endX - rect.x,
        height: endY - rect.y,
        endX,
        endY,
    };
};

const getCenter = (rect: PdfClientRect) => ({
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
});

const distanceToLine = (
    point: { x: number; y: number },
    comparePoint: { x: number; y: number },
) => ({
    verticalDistance: Math.abs(comparePoint.x - point.x),
    horizontalDistance: Math.abs(comparePoint.y - point.y),
});

const getOverlayPart = (current: PdfClientRect, target: PdfClientRect) => {
    const x = Math.max(current.x, target.x);
    const y = Math.max(current.y, target.y);
    const x2 = Math.min(current.endX, target.endX);
    const y2 = Math.min(current.endY, target.endY);
    const width = x2 - x;
    const height = y2 - y;
    let overlay: OverlayKind = "N";
    if (width > 0 && height > 0) {
        overlay = "XY";
    } else if (width > 0) {
        overlay = "X";
    } else if (height > 0) {
        overlay = "Y";
    }
    return { overlay, rect: { x, y, width, height } };
};

/**
 * Port of PdfTextAssistant.checkInLine (geometry-only; no DOM char wrapping).
 */
const checkInLine = (
    current: PdfClientRect,
    target: PdfClientRect,
    checkAlignType: AlignType,
): { isMatch: boolean; alignType: AlignType } => {
    if (checkAlignType === "unknown") {
        const currentCenter = getCenter(current);
        const targetCenter = getCenter(target);
        const { horizontalDistance, verticalDistance } = distanceToLine(
            targetCenter,
            currentCenter,
        );
        const preferVertical = horizontalDistance > verticalDistance;
        const bothLineLike =
            current.width >= current.height && target.width >= target.height;
        const bothColumnLike =
            current.height > current.width && target.height > target.width;

        // Side-by-side line boxes → try horizontal grouping.
        if (current.x > target.endX || current.endX < target.x) {
            // Two tall column boxes sitting side by side should not glue horizontally.
            if (bothColumnLike) {
                return { isMatch: false, alignType: "unknown" };
            }
            return checkInLine(current, target, "horizontal");
        }
        // Stacked boxes → only treat as vertical run when they look like columns.
        // Wide line boxes stacked (multi-line paragraph) must start a new group.
        if (current.y > target.endY || current.endY < target.y) {
            if (bothLineLike) {
                return { isMatch: false, alignType: "unknown" };
            }
            return checkInLine(current, target, "vertical");
        }
        // Overlapping / nested boxes (common getClientRects near-duplicates with 1px drift):
        // wide line boxes must stay horizontal — center-distance preferVertical is unreliable
        // when Δx≈0 and Δy is a 1px duplicate offset, and would lock the whole group vertical.
        if (bothLineLike) {
            return checkInLine(current, target, "horizontal");
        }
        return checkInLine(current, target, preferVertical ? "vertical" : "horizontal");
    }

    if (checkAlignType === "horizontal") {
        if (current.y > target.endY || current.endY < target.y) {
            return { isMatch: false, alignType: "unknown" };
        }
        const overlayPart = getOverlayPart(current, target);
        if (
            (overlayPart.overlay === "Y" || overlayPart.overlay === "XY") &&
            overlayPart.rect.height / current.height < 1 / 5
        ) {
            return { isMatch: false, alignType: "unknown" };
        }
        return { isMatch: true, alignType: "horizontal" };
    }

    // vertical
    if (current.x > target.endX || current.endX < target.x) {
        return { isMatch: false, alignType: "unknown" };
    }
    const overlayPart = getOverlayPart(current, target);
    if (
        (overlayPart.overlay === "X" || overlayPart.overlay === "XY") &&
        overlayPart.rect.width / current.width < 1 / 5
    ) {
        return { isMatch: false, alignType: "unknown" };
    }
    return { isMatch: true, alignType: "vertical" };
};

const groupRects = (
    rects: PdfClientRect[],
): { group: RectGroup; leftRects: PdfClientRect[] } => {
    if (rects.length === 0) {
        return { group: { currentRects: [], isVertical: false }, leftRects: [] };
    }
    const group: RectGroup = {
        currentRects: [rects[0]],
        isVertical: false,
    };
    let alignType: AlignType = "unknown";
    for (let i = 1; i < rects.length; i++) {
        const check = checkInLine(rects[i], rects[i - 1], alignType);
        if (!check.isMatch) {
            return { group, leftRects: rects.slice(i) };
        }
        alignType = check.alignType;
        group.isVertical = check.alignType === "vertical";
        group.currentRects.push(rects[i]);
    }
    return { group, leftRects: [] };
};

const calcMaxRect = (rects: PdfClientRect[]): PdfClientRect => {
    const x = Math.min(...rects.map((r) => r.x));
    const y = Math.min(...rects.map((r) => r.y));
    const endX = Math.max(...rects.map((r) => r.endX));
    const endY = Math.max(...rects.map((r) => r.endY));
    return {
        x,
        y,
        endX,
        endY,
        width: endX - x,
        height: endY - y,
    };
};

/** Prefer a representative line height once covered width ≥ 50% (original getActualHeight). */
const getActualHeight = (totalWidth: number, relatedRects: PdfClientRect[]) => {
    const sorted = [...relatedRects].sort((a, b) => a.height - b.height);
    let percentage = 0;
    let maxHeight = 0;
    let fixedY = sorted[0]?.y ?? 0;
    const safeTotal = totalWidth > 0 ? totalWidth : 1;
    for (const rect of sorted) {
        percentage += rect.width / safeTotal;
        maxHeight = Math.max(maxHeight, rect.height);
        fixedY = rect.y;
        if (percentage >= 0.5) {
            return { fixedY, maxHeight };
        }
    }
    return { fixedY, maxHeight };
};

/** Prefer a representative column width once covered height ≥ 50% (original getActualWidth). */
const getActualWidth = (totalHeight: number, relatedRects: PdfClientRect[]) => {
    const sorted = [...relatedRects].sort((a, b) => a.width - b.width);
    let percentage = 0;
    let maxWidth = 0;
    let fixedX = sorted[0]?.x ?? 0;
    const safeTotal = totalHeight > 0 ? totalHeight : 1;
    for (const rect of sorted) {
        percentage += rect.height / safeTotal;
        maxWidth = Math.max(maxWidth, rect.width);
        fixedX = rect.x;
        if (percentage >= 0.5) {
            return { fixedX, maxWidth };
        }
    }
    return { fixedX, maxWidth };
};

const containRect = (source: PdfClientRect, target: PdfClientRect) =>
    target.x >= source.x &&
    target.y >= source.y &&
    target.endX <= source.endX &&
    target.endY <= source.endY;

const buildGroupBox = (group: RectGroup): PdfClientRect => {
    let box = calcMaxRect(group.currentRects);
    if (group.currentRects.length <= 1) {
        return box;
    }
    if (group.isVertical) {
        const { maxWidth, fixedX } = getActualWidth(box.height, group.currentRects);
        box = {
            ...box,
            x: fixedX,
            width: maxWidth,
            endX: fixedX + maxWidth,
        };
    } else {
        const { maxHeight, fixedY } = getActualHeight(box.width, group.currentRects);
        box = {
            ...box,
            y: fixedY,
            height: maxHeight,
            endY: fixedY + maxHeight,
        };
    }
    return box;
};

export type PdfTextLineRect = PdfClientRect & {
    text?: string;
    isVertical?: boolean;
};

const groupAllRects = <T extends PdfClientRect>(rects: T[]): RectGroup[] => {
    let leftRects = rects
        .map((r) => normalizeRect(r))
        .filter((r) => r.width > 0.5 && r.height > 0.5);

    const groups: RectGroup[] = [];
    while (leftRects.length > 0) {
        const { group, leftRects: rest } = groupRects(leftRects);
        if (group.currentRects.length === 0) {
            break;
        }
        groups.push(group);
        leftRects = rest as T[];
    }
    return groups;
};

/**
 * Merge client rects into line/column boxes.
 * Geometry-only path used by mark overlay.
 * Preserves input order (typically Range#getClientRects order) — do not sort by y/x,
 * or vertical multi-column selections will fragment.
 */
export const mergeClientRects = (rects: PdfClientRect[]): PdfClientRect[] => {
    if (rects.length === 0) {
        return [];
    }

    const merged: PdfClientRect[] = [];
    for (const group of groupAllRects(rects)) {
        const box = buildGroupBox(group);
        if (merged.some((existing) => containRect(existing, box))) {
            continue;
        }
        merged.push(box);
    }
    return merged;
};

/**
 * Merge item rects into visual line boxes, keeping joined text + writing direction.
 * Used by copy / PdfTextAssistant (geometry shared with {@link mergeClientRects}).
 */
export const mergeClientRectsToLines = (
    rects: Array<PdfClientRect & { text?: string }>,
    joinText: (texts: string[]) => string = (texts) => texts.join(""),
): PdfTextLineRect[] => {
    if (rects.length === 0) {
        return [];
    }

    const merged: PdfTextLineRect[] = [];
    for (const group of groupAllRects(rects)) {
        const box = buildGroupBox(group);
        if (merged.some((existing) => containRect(existing, box))) {
            continue;
        }
        const texts = group.currentRects
            .map((r) => (r as PdfClientRect & { text?: string }).text ?? "")
            .filter((t) => t.length > 0);
        merged.push({
            ...box,
            isVertical: group.isVertical,
            text: joinText(texts),
        });
    }
    return merged;
};

/**
 * Extract selection client rects and assign each to a page (supports multi-page).
 */
export const getPagedSelectionRects = (range: Range): PdfPageClientRect[] => {
    if (!range || range.collapsed) {
        return [];
    }
    const ownerDocument = range.startContainer.ownerDocument;
    if (!ownerDocument) {
        return [];
    }

    const startPage = findPageElement(range.startContainer);
    const root =
        startPage?.closest(".pdfViewer") ??
        startPage?.parentElement ??
        ownerDocument.body;
    const pageElements = collectPageElements(root);

    const raw = Array.from(range.getClientRects()).filter(
        (r) => r.width > 0.5 && r.height > 0.5,
    );
    const paged: PdfPageClientRect[] = [];
    for (const rect of raw) {
        const pageNumber =
            resolvePageNumberForRect(rect, pageElements) ??
            (startPage ? getPageNumberFromElement(startPage) : undefined);
        if (pageNumber == null) {
            continue;
        }
        paged.push({
            pageNumber,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            endX: rect.x + rect.width,
            endY: rect.y + rect.height,
        });
    }

    // Keep document / getClientRects order within each page (required for vertical groups).
    const byPage = new Map<number, PdfClientRect[]>();
    for (const item of paged) {
        const list = byPage.get(item.pageNumber) ?? [];
        list.push(item);
        byPage.set(item.pageNumber, list);
    }

    const result: PdfPageClientRect[] = [];
    for (const [pageNumber, list] of byPage) {
        for (const merged of mergeClientRects(list)) {
            result.push({ ...merged, pageNumber });
        }
    }
    return result.sort((a, b) =>
        a.pageNumber === b.pageNumber ? a.y - b.y || a.x - b.x : a.pageNumber - b.pageNumber,
    );
};

export const getSelectionText = (range: Range): string => {
    if (!range) {
        return "";
    }
    return (range.toString() || "").replace(/\s+/g, " ").trim();
};
