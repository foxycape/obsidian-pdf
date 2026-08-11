import { endsWithCjkIdeograph, removeCJCharWhitespace, startsWithCjkIdeograph } from '../../../../kernal/common/text';
import type { TextItem, TextStyle } from '../../../../pdfjs/types/src/display/api';
import { TextFormatOptions } from '../../../../kernal';
import { computeSpanBoundsInViewport, computeViewport, mapBoundsToTargetSize, PdfAxisAlignedRect } from './bbox';

/** A single line of page text and its axis-aligned rect in render coordinates */
export type PdfPageTextLineItem = {
    text: string
    rect: PdfAxisAlignedRect
}

const splitos = ['.', '。', '？', '?', '!', '！'];
/** Adjacent CJK chars with a gap below this fraction of char width are treated as a PDF spurious space */
const cjkSpuriousSpaceGapRatio = 0.2;
/** Gaps between multi-char runs above this fraction of char width are treated as semantic spaces */
const cjkPhraseSpaceGapRatio = 0.15;
const cjkSentenceEndPattern = /[。！？；：」》）"'\]]$/;
/** When the smaller box overlap ratio reaches this threshold and texts are compatible, treat as a duplicate item (fake bold / overlaid text, etc.) */
const duplicateTextItemOverlapRatio = 0.85;

const isPdfTextItem = (item: unknown): item is TextItem => {
    return typeof item === 'object' && item !== null && typeof (item as TextItem).str === 'string';
};

const findAdjacentPdfTextItem = (items: unknown[], fromIndex: number, direction: -1 | 1): TextItem | null => {
    for (let i = fromIndex; i >= 0 && i < items.length; i += direction) {
        const item = items[i];
        if (isPdfTextItem(item) && item.str && !/^\s+$/.test(item.str)) {
            return item;
        }
    }
    return null;
};

const isSamePdfTextLine = (prev: TextItem, next: TextItem): boolean => {
    const lineTolerance = Math.max(prev.height, next.height, 1) * 0.5;
    return Math.abs(prev.transform[5] - next.transform[5]) <= lineTolerance;
};

const estimatePdfCharWidth = (item: TextItem): number => {
    return item.width / Math.max(item.str.length, 1);
};

const computePdfHorizontalGap = (prev: TextItem, next: TextItem, spaceItem?: TextItem): number => {
    const directGap = next.transform[4] - (prev.transform[4] + prev.width);
    if (spaceItem) {
        return Math.max(spaceItem.width, directGap, 0);
    }
    return Math.max(directGap, 0);
};

/**
 * Decide whether a space between two PDF text items should be kept (semantic separator vs layout spurious space).
 */
const shouldKeepPdfCjSpace = (prev: TextItem, next: TextItem, spaceItem?: TextItem): boolean => {
    const prevText = prev.str.trimEnd();
    const nextText = next.str.trimStart();
    if (!endsWithCjkIdeograph(prevText) || !startsWithCjkIdeograph(nextText)) {
        return true;
    }
    if (spaceItem?.str.includes('\u3000')) {
        return true;
    }
    if (prev.hasEOL) {
        return true;
    }
    if (prev.fontName !== next.fontName) {
        return true;
    }
    if (cjkSentenceEndPattern.test(prevText)) {
        return true;
    }
    if (!isSamePdfTextLine(prev, next)) {
        return false;
    }

    const charWidth = estimatePdfCharWidth(prev);
    const gap = computePdfHorizontalGap(prev, next, spaceItem);
    if (prevText.length > 1 && nextText.length > 1 && gap > charWidth * cjkPhraseSpaceGapRatio) {
        return true;
    }
    if (prevText.length === 1 && nextText.length === 1 && gap <= charWidth * cjkSpuriousSpaceGapRatio) {
        return false;
    }
    return gap > charWidth * cjkSpuriousSpaceGapRatio;
};

const trimSpuriousCjkTrailingSpace = (pageText: string, prev: TextItem, next: TextItem): string => {
    // Only strip CJK spurious spaces (regular spaces); do not touch newlines appended by appendPdfLineBreakIfNeeded
    if (!/ +$/.test(pageText)) {
        return pageText;
    }
    const textWithoutTrailingSpaces = pageText.replace(/ +$/, '');
    if (!endsWithCjkIdeograph(textWithoutTrailingSpaces) || !startsWithCjkIdeograph(next.str)) {
        return pageText;
    }
    if (shouldKeepPdfCjSpace(prev, next)) {
        return pageText;
    }
    return textWithoutTrailingSpaces;
};

const appendPdfTextItem = (pageText: string, str: string, hasEOL: boolean, allowCRLF: boolean): string => {
    if (allowCRLF && hasEOL && !pageText.endsWith('-')) {
        return pageText + str + '\n';
    }
    return pageText + str;
};

/** Text items that only carry an EOL marker with no visible characters (common in PDF.js) */
const appendPdfLineBreakIfNeeded = (pageText: string, item: TextItem, allowCRLF: boolean): string => {
    if (!allowCRLF || !item.hasEOL || pageText.endsWith('-')) {
        return pageText;
    }
    return pageText + '\n';
};

const buildPageTextWithCjWhitespaceHandling = (items: unknown[], allowCRLF: boolean): string => {
    let pageText = '';
    let lastTextItem: TextItem | null = null;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!isPdfTextItem(item)) {
            continue;
        }
        if (!item.str) {
            pageText = appendPdfLineBreakIfNeeded(pageText, item, allowCRLF);
            lastTextItem = item;
            continue;
        }

        if (/^\s+$/.test(item.str)) {
            const prev = lastTextItem ?? findAdjacentPdfTextItem(items, i - 1, -1);
            const next = findAdjacentPdfTextItem(items, i + 1, 1);
            if (!prev || !next) {
                pageText += item.str;
            }
            else if (shouldKeepPdfCjSpace(prev, next, item)) {
                pageText += ' ';
            }
            continue;
        }

        const str = removeCJCharWhitespace(item.str);
        if (lastTextItem) {
            pageText = trimSpuriousCjkTrailingSpace(pageText, lastTextItem, item);
        }
        pageText = appendPdfTextItem(pageText, str, item.hasEOL, allowCRLF);
        lastTextItem = item;
    }

    return pageText;
};

const mergeAxisAlignedRects = (a: PdfAxisAlignedRect, b: PdfAxisAlignedRect): PdfAxisAlignedRect => {
    return {
        x1: Math.min(a.x1, b.x1),
        y1: Math.min(a.y1, b.y1),
        x2: Math.max(a.x2, b.x2),
        y2: Math.max(a.y2, b.y2)
    };
};

const rectArea = (rect: PdfAxisAlignedRect): number => {
    return Math.max(0, rect.x2 - rect.x1) * Math.max(0, rect.y2 - rect.y1);
};

const intersectRect = (a: PdfAxisAlignedRect, b: PdfAxisAlignedRect): PdfAxisAlignedRect | null => {
    const x1 = Math.max(a.x1, b.x1);
    const y1 = Math.max(a.y1, b.y1);
    const x2 = Math.min(a.x2, b.x2);
    const y2 = Math.min(a.y2, b.y2);
    if (x2 <= x1 || y2 <= y1) {
        return null;
    }
    return { x1, y1, x2, y2 };
};

/** Ratio of intersection area to the smaller rectangle's area */
const overlapRatioOnSmaller = (a: PdfAxisAlignedRect, b: PdfAxisAlignedRect): number => {
    const intersection = intersectRect(a, b);
    if (!intersection) {
        return 0;
    }
    const overlapArea = rectArea(intersection);
    const minArea = Math.min(rectArea(a), rectArea(b));
    return minArea > 0 ? overlapArea / minArea : 0;
};

const normalizePdfTextForDedupe = (str: string): string => {
    return str.replace(/\s+/g, '');
};

/** Texts are equal, or one contains the other (overlay split/merge differences) */
const isCompatibleDuplicateText = (a: string, b: string): boolean => {
    const normalizedA = normalizePdfTextForDedupe(a);
    const normalizedB = normalizePdfTextForDedupe(b);
    if (!normalizedA || !normalizedB) {
        return false;
    }
    return normalizedA === normalizedB
        || normalizedA.includes(normalizedB)
        || normalizedB.includes(normalizedA);
};

/** Whitespace / EOL-only structural items are excluded from geometric dedupe */
const shouldSkipDedupeCandidate = (item: TextItem): boolean => {
    if (!item.str || /^\s+$/.test(item.str)) {
        return true;
    }
    if (item.width <= 0 && item.height <= 0) {
        return true;
    }
    return false;
};

/**
 * Rough axis-aligned bounds in PDF user space (for getPageText dedupe; relative comparison within a page is enough).
 */
const computeTextItemBoundsInUserSpace = (textItem: TextItem): PdfAxisAlignedRect => {
    const x = textItem.transform[4];
    const y = textItem.transform[5];
    const w = Math.max(textItem.width, 0);
    const h = Math.max(textItem.height, 0);
    return {
        x1: Math.min(x, x + w),
        y1: Math.min(y, y + h),
        x2: Math.max(x, x + w),
        y2: Math.max(y, y + h)
    };
};

/**
 * Drop heavily overlapping, text-compatible duplicate text items, keeping the first in reading order;
 * replace the earlier one if a later item has a clearly larger area or more complete text.
 */
const dedupeOverlappingTextItemsWithBounds = <T extends { item: TextItem; bounds: PdfAxisAlignedRect }>(
    entries: T[]
): T[] => {
    const kept: T[] = [];
    for (const entry of entries) {
        if (shouldSkipDedupeCandidate(entry.item)) {
            kept.push(entry);
            continue;
        }

        const entryArea = rectArea(entry.bounds);
        let duplicateIndex = -1;
        for (let i = 0; i < kept.length; i++) {
            const existing = kept[i]!;
            if (shouldSkipDedupeCandidate(existing.item)) {
                continue;
            }
            if (!isCompatibleDuplicateText(existing.item.str, entry.item.str)) {
                continue;
            }
            if (overlapRatioOnSmaller(existing.bounds, entry.bounds) < duplicateTextItemOverlapRatio) {
                continue;
            }
            duplicateIndex = i;
            break;
        }

        if (duplicateIndex < 0) {
            kept.push(entry);
            continue;
        }

        const existing = kept[duplicateIndex]!;
        const existingArea = rectArea(existing.bounds);
        const preferNew = entryArea > existingArea * 1.01
            || (Math.abs(entryArea - existingArea) <= existingArea * 0.01
                && entry.item.str.length > existing.item.str.length);
        if (preferNew) {
            kept[duplicateIndex] = entry;
        }
    }
    return kept;
};

const dedupePdfTextContentItems = (items: unknown[]): unknown[] => {
    type Entry = { item: TextItem; bounds: PdfAxisAlignedRect; sourceIndex: number };
    const textEntries: Entry[] = [];
    for (let i = 0; i < items.length; i++) {
        const raw = items[i];
        if (!isPdfTextItem(raw)) {
            continue;
        }
        textEntries.push({
            item: raw,
            bounds: computeTextItemBoundsInUserSpace(raw),
            sourceIndex: i
        });
    }
    const keptSourceIndexes = new Set(
        dedupeOverlappingTextItemsWithBounds(textEntries).map((entry) => entry.sourceIndex)
    );
    return items.filter((raw, index) => !isPdfTextItem(raw) || keptSourceIndexes.has(index));
};

const buildLineTextFromItems = (items: TextItem[], textFormat?: TextFormatOptions): string => {
    const allowCRLF = false;
    let lineText = '';
    if (textFormat?.removeCJWhitespace) {
        lineText = buildPageTextWithCjWhitespaceHandling(items, allowCRLF);
    }
    else {
        for (const item of items) {
            if (!item.str) {
                continue;
            }
            lineText = appendPdfTextItem(lineText, item.str, false, allowCRLF);
        }
    }
    if (textFormat?.removeConsecutiveWhitespaceCharacters) {
        lineText = lineText.trim();
        lineText = lineText.replace(/[\f\t\v]+/g, '');
    }
    return lineText;
};

const computeTextItemBoundsInRenderSpace = (
    textItem: TextItem,
    style: TextStyle | undefined,
    viewport: { width: number; height: number; transform: number[] },
    targetWidth: number,
    targetHeight: number
): PdfAxisAlignedRect => {
    const viewportBounds = computeSpanBoundsInViewport(textItem, style, viewport.transform);
    return mapBoundsToTargetSize(
        viewportBounds,
        viewport.width,
        viewport.height,
        targetWidth,
        targetHeight
    );
};

/**
 * Get each line of PDF page text and its rect (coordinates are based on the rendered page pixel size).
 * @param page
 * @param width Rendered page width in pixels; rect coordinates are relative to this
 * @param options Text formatting options, same as getPageText
 */
export const getPageTextItems = async (page: any, width: number, options?: TextFormatOptions): Promise<PdfPageTextLineItem[]> => {
    const viewport = computeViewport(page, width);
    const targetHeight = viewport.height;
    const textContent = await page.getTextContent();

    type TextItemWithBounds = {
        item: TextItem
        bounds: PdfAxisAlignedRect
    };

    const itemsWithBounds: TextItemWithBounds[] = [];
    for (const rawItem of textContent.items) {
        if (!isPdfTextItem(rawItem)) {
            continue;
        }
        const textItem = rawItem;
        if (!textItem.str && textItem.width <= 0 && textItem.height <= 0 && !textItem.hasEOL) {
            continue;
        }
        const style = textContent.styles[textItem.fontName];
        const bounds = computeTextItemBoundsInRenderSpace(
            textItem,
            style,
            viewport,
            width,
            targetHeight
        );
        itemsWithBounds.push({ item: textItem, bounds });
    }
    const dedupedItemsWithBounds = dedupeOverlappingTextItemsWithBounds(itemsWithBounds);

    const lines: PdfPageTextLineItem[] = [];
    let currentLineItems: TextItemWithBounds[] = [];
    let lastItem: TextItem | null = null;

    const flushCurrentLine = () => {
        if (currentLineItems.length === 0) {
            return;
        }
        const text = buildLineTextFromItems(currentLineItems.map((entry) => entry.item), options);
        const rect = currentLineItems
            .map((entry) => entry.bounds)
            .reduce((merged, bounds) => mergeAxisAlignedRects(merged, bounds));
        if (text) {
            lines.push({ text, rect });
        }
        currentLineItems = [];
    };

    for (const entry of dedupedItemsWithBounds) {
        if (lastItem?.hasEOL) {
            flushCurrentLine();
        }
        currentLineItems.push(entry);
        lastItem = entry.item;
    }
    flushCurrentLine();

    return lines;
};

/**
 * Get PDF page text
 * @param page
 * @param options
 * @returns
 */
export const getPageText = async (page: any, options?: TextFormatOptions) => {
    let pageText = '';
    const textContent = await page.getTextContent();
    const items = dedupePdfTextContentItems(textContent.items);
    const allowCRLF = options?.combineLines || options?.convertEOLToCRLF || options?.removeConsecutiveBlankLine || options?.removeConsecutiveWhitespaceCharacters || options?.convertLFToWhitespace || options?.removeCJWhitespace;
    if (options?.removeCJWhitespace) {
        pageText = buildPageTextWithCjWhitespaceHandling(items, allowCRLF);
    }
    else {
        items.forEach((v) => {
            if (!isPdfTextItem(v)) {
                return;
            }
            if (!v.str) {
                pageText = appendPdfLineBreakIfNeeded(pageText, v, allowCRLF);
                return;
            }
            // Do not insert a space when an English word is hyphenated across a line break with '-'
            pageText = appendPdfTextItem(pageText, v.str, v.hasEOL, allowCRLF);
        });
    }
    if (options?.combineLines) {
        let newPageText = '';
        const texts = pageText.split('\n');
        for (const text of texts) {
            const newText = text.trim();
            if (!newText) {
                continue;
            }

            newPageText += newText;
            const lastChar = newText.substring(newText.length - 1);
            if (splitos.includes(lastChar)) {
                newPageText += '\n';
            }
        }
        pageText = newPageText;
    }
    if (options?.removeConsecutiveWhitespaceCharacters) {
        pageText = pageText.trim();
        pageText = pageText.replace(/[\f\t\v]+/g, '');
        pageText = pageText.replace(/^\s*[\r\n]\s*/gm, '');
    }
    return pageText;
};
