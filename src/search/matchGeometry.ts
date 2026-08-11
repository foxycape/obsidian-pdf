import type { TextItem, PDFPageProxy } from '@core/pdfjs/types/src/display/api'
import { getPageLayoutRef } from '@core/mediaTypes/pdf/shared/geometry/selectionToFixedContentRange'
import type { PdfSearchRect } from './types'

export type PdfMatchBoundary = {
    divIdx: number;
    offset: number;
};

export type PdfConvertedMatch = {
    begin: PdfMatchBoundary;
    end: PdfMatchBoundary;
};

export type PdfTextLayerMapping = {
    /** Same as pdf.js `textContentItemsStr` / FindController item.str join space. */
    texts: string[];
    /** textContent.items index for each texts[] entry. */
    itemIndexes: number[];
    /** FindController extractText string (item.str + `\n` for hasEOL). */
    findText: string;
};

type PageTextMappingSource = {
    textDivs?: Array<Node | null> | null;
    textContentItemsStr?: string[] | null;
};

const isTextItem = (item: unknown): item is TextItem =>
    typeof item === "object" && item !== null && typeof (item as TextItem).str === "string";

export const buildTextLayerMapping = (items: unknown[]): PdfTextLayerMapping => {
    const texts: string[] = [];
    const itemIndexes: number[] = [];
    const findParts: string[] = [];

    items.forEach((raw, itemIndex) => {
        if (!isTextItem(raw)) {
            return;
        }
        texts.push(raw.str);
        itemIndexes.push(itemIndex);
        findParts.push(raw.str);
        if (raw.hasEOL) {
            findParts.push("\n");
        }
    });

    return {
        texts,
        itemIndexes,
        findText: findParts.join(""),
    };
};

/**
 * Exact copy of pdf.js TextHighlighter._convertMatches.
 * `matches` / `matchesLength` are used directly against `texts` (item.str array).
 */
export const convertMatches = (
    matches: number[] | undefined,
    matchesLength: number[] | undefined,
    texts: string[],
): PdfConvertedMatch[] => {
    if (!matches?.length) {
        return [];
    }
    let i = 0;
    let iIndex = 0;
    const end = Math.max(texts.length - 1, 0);
    const result: PdfConvertedMatch[] = [];

    for (let m = 0; m < matches.length; m++) {
        let matchIdx = matches[m];
        while (i !== end && matchIdx >= iIndex + (texts[i]?.length ?? 0)) {
            iIndex += texts[i]?.length ?? 0;
            i++;
        }
        const begin = {
            divIdx: i,
            offset: matchIdx - iIndex,
        };
        matchIdx += matchesLength?.[m] ?? 0;
        while (i !== end && matchIdx > iIndex + (texts[i]?.length ?? 0)) {
            iIndex += texts[i]?.length ?? 0;
            i++;
        }
        result.push({
            begin,
            end: {
                divIdx: i,
                offset: matchIdx - iIndex,
            },
        });
    }
    return result;
};

const pageRelativeRects = (
    pageEl: HTMLElement,
    clientRects: ArrayLike<DOMRect | DOMRectReadOnly>,
): PdfSearchRect[] => {
    const layout = getPageLayoutRef(pageEl);
    if (!layout) {
        return [];
    }
    const rects: PdfSearchRect[] = [];
    for (let i = 0; i < clientRects.length; i++) {
        const r = clientRects[i];
        if (!r || r.width <= 0 || r.height <= 0) {
            continue;
        }
        rects.push({
            x: r.left - layout.contentLeft,
            y: r.top - layout.contentTop,
            width: r.width,
            height: r.height,
        });
    }
    return rects;
};

const measureSubstringInElement = (
    el: Element,
    start: number,
    end: number,
    pageEl: HTMLElement,
): PdfSearchRect[] => {
    if (end <= start) {
        return [];
    }

    // Prefer a dedicated text node; fall back to first text node under el.
    let textNode: Text | null = null;
    for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && (node.textContent?.length ?? 0) > 0) {
            textNode = node as Text;
            break;
        }
    }
    if (!textNode && el instanceof SVGTextElement) {
        // Some browsers expose text via textContent without a child Text node until layout.
        textNode = el.firstChild as Text | null;
    }
    if (!textNode?.textContent) {
        const rects = pageRelativeRects(pageEl, [el.getBoundingClientRect()]);
        return rects;
    }

    const max = textNode.textContent.length;
    const from = Math.max(0, Math.min(start, max));
    const to = Math.max(from, Math.min(end, max));
    if (to <= from) {
        return [];
    }

    if (el instanceof SVGTextElement && typeof el.getExtentOfChar === "function") {
        try {
            const layout = getPageLayoutRef(pageEl);
            const ctm = el.getScreenCTM();
            if (layout && ctm) {
                const merged: PdfSearchRect[] = [];
                for (let i = from; i < to; i++) {
                    const ext = el.getExtentOfChar(i);
                    const pts = [
                        { x: ext.x, y: ext.y },
                        { x: ext.x + ext.width, y: ext.y },
                        { x: ext.x + ext.width, y: ext.y + ext.height },
                        { x: ext.x, y: ext.y + ext.height },
                    ].map((p) => ({
                        x: ctm.a * p.x + ctm.c * p.y + ctm.e,
                        y: ctm.b * p.x + ctm.d * p.y + ctm.f,
                    }));
                    const xs = pts.map((p) => p.x);
                    const ys = pts.map((p) => p.y);
                    const rect = {
                        x: Math.min(...xs) - layout.contentLeft,
                        y: Math.min(...ys) - layout.contentTop,
                        width: Math.max(...xs) - Math.min(...xs),
                        height: Math.max(...ys) - Math.min(...ys),
                    };
                    if (rect.width <= 0 || rect.height <= 0) {
                        continue;
                    }
                    const last = merged[merged.length - 1];
                    if (
                        last &&
                        Math.abs(last.y - rect.y) < 1 &&
                        Math.abs(last.height - rect.height) < 1 &&
                        Math.abs(last.x + last.width - rect.x) < 1.5
                    ) {
                        last.width = rect.x + rect.width - last.x;
                    } else {
                        merged.push(rect);
                    }
                }
                if (merged.length > 0) {
                    return merged;
                }
            }
        } catch {
            // Fall through to Range.
        }
    }

    try {
        const range = pageEl.ownerDocument.createRange();
        range.setStart(textNode, from);
        range.setEnd(textNode, to);
        const rects = pageRelativeRects(pageEl, range.getClientRects());
        if (rects.length > 0) {
            return rects;
        }
    } catch {
        // ignore
    }
    return pageRelativeRects(pageEl, [el.getBoundingClientRect()]);
};

/**
 * Collect DOM nodes aligned with `mapping.texts`.
 * Prefers pdf.js TextHighlighter mapping when span text layer is active.
 */
export const collectPageTextElements = (
    pageEl: HTMLElement,
    mapping: PdfTextLayerMapping,
    pageNumber: number,
    pageView?: { _textHighlighter?: PageTextMappingSource; textLayer?: { highlighter?: PageTextMappingSource } },
): {
    texts: string[];
    elements: Array<Element | null>;
} => {
    const highlighter =
        pageView?._textHighlighter ??
        pageView?.textLayer?.highlighter ??
        null;

    if (highlighter?.textDivs?.length && highlighter.textContentItemsStr?.length) {
        return {
            texts: highlighter.textContentItemsStr,
            elements: highlighter.textDivs.map((n) =>
                n && n.nodeType === Node.ELEMENT_NODE
                    ? (n as Element)
                    : ((n as Node | null)?.parentElement ?? null),
            ),
        };
    }

    const elements: Array<Element | null> = new Array(mapping.texts.length).fill(null);
    const svgRoot = pageEl.querySelector("svg.custom-text-layer");
    if (svgRoot) {
        for (let i = 0; i < mapping.texts.length; i++) {
            const itemIndex = mapping.itemIndexes[i];
            elements[i] =
                svgRoot.querySelector(`[data-text-index="${itemIndex}"]`) ||
                pageEl.querySelector(`[data-text-index="${itemIndex}"]`) ||
                pageEl.querySelector(`[id$="-${pageNumber}-t-${itemIndex}"]`);
        }
        return { texts: mapping.texts, elements };
    }

    // Fallback span collection: only direct textual spans pdf.js appended (str !== "").
    const textSpans = Array.from(pageEl.querySelectorAll(".textLayer span")).filter((span) => {
        // Exclude highlight wrappers created by native TextHighlighter if any.
        if (span.classList.contains("highlight") || span.classList.contains("appended")) {
            return false;
        }
        return (span.textContent?.length ?? 0) > 0;
    });
    let spanIdx = 0;
    for (let i = 0; i < mapping.texts.length; i++) {
        if (!mapping.texts[i]) {
            elements[i] = null;
            continue;
        }
        elements[i] = textSpans[spanIdx] ?? null;
        spanIdx++;
    }
    return { texts: mapping.texts, elements };
};

export const measureConvertedMatchRects = (
    pageEl: HTMLElement,
    texts: string[],
    elements: Array<Element | null>,
    match: PdfConvertedMatch,
): PdfSearchRect[] => {
    const rects: PdfSearchRect[] = [];
    for (let divIdx = match.begin.divIdx; divIdx <= match.end.divIdx; divIdx++) {
        const el = elements[divIdx];
        const text = texts[divIdx] ?? "";
        if (!el || !text) {
            continue;
        }
        const start = divIdx === match.begin.divIdx ? match.begin.offset : 0;
        const end = divIdx === match.end.divIdx ? match.end.offset : text.length;
        rects.push(...measureSubstringInElement(el, start, end, pageEl));
    }
    return rects;
};

/**
 * Resolve overlay rects for one FindController match.
 * Uses the same match→div mapping as pdf.js TextHighlighter, then measures real DOM glyphs.
 */
export const resolveMatchRectsFromDom = async (
    pageEl: HTMLElement,
    page: PDFPageProxy,
    pageNumber: number,
    matchStart: number,
    matchLength: number,
    pageView?: { _textHighlighter?: PageTextMappingSource; textLayer?: { highlighter?: PageTextMappingSource } },
): Promise<{
    rects: PdfSearchRect[];
    mapping: PdfTextLayerMapping;
    texts: string[];
}> => {
    const textContent = await page.getTextContent({ disableNormalization: true });
    const mapping = buildTextLayerMapping(textContent.items);
    const { texts, elements } = collectPageTextElements(pageEl, mapping, pageNumber, pageView);

    // Same as TextHighlighter: pageMatches index into textContentItemsStr join, not findText.
    const converted = convertMatches([matchStart], [matchLength], texts)[0];
    if (!converted) {
        return { rects: [], mapping, texts };
    }
    const rects = measureConvertedMatchRects(pageEl, texts, elements, converted);
    return { rects, mapping, texts };
};

/**
 * Snippet for result list. Uses the same character space as TextHighlighter
 * (`texts.join("")` + pageMatches offsets).
 */
export const buildShowTextSnippet = (
    layerText: string,
    start: number,
    length: number,
    keywordColor = "var(--text-accent)",
    contextChars = 40,
): string => {
    const safeStart = Math.max(0, Math.min(start, layerText.length));
    const safeEnd = Math.max(safeStart, Math.min(start + length, layerText.length));
    const before = layerText.slice(Math.max(0, safeStart - contextChars), safeStart);
    const match = layerText.slice(safeStart, safeEnd);
    const after = layerText.slice(safeEnd, Math.min(layerText.length, safeEnd + contextChars));
    const escape = (value: string) =>
        value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\s+/g, " ");
    return `${escape(before)}<span style="color:${keywordColor}">${escape(match)}</span>${escape(after)}`;
};

/** Layer string used by TextHighlighter / showText (no FindController EOL `\n`). */
export const buildLayerText = (texts: string[]): string => texts.join("");
