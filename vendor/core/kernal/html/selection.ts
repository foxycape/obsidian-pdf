import { isNullOrWhiteSpace } from "../common/text";
import { findLastNode, getDocumentBody } from "./finder";

/**
 * Get the current selection range.
 */
export const getRange = (ownerDocument: Document, allowEmptyRange?: boolean) => {
    if (!ownerDocument) {
        return null;
    }
    const selection = ownerDocument.getSelection();
    if (!selection || selection.isCollapsed)
        return null;
    const range = selection.getRangeAt(0);
    if (!range || range.collapsed) {
        return null;
    }
    if (allowEmptyRange) {
        return range;
    }
    if (!range.toString()) {
        return null;
    }
    return range;
};

export const checkHasValidRange = (ownerDocument: Document, allowEmptyRange?: boolean): boolean => {
    if (!ownerDocument)
        return false;
    const range = getRange(ownerDocument, true);

    if (!range) {
        return false;
    }

    if (allowEmptyRange) {
        return true
    }

    if (isNullOrWhiteSpace(range.toString())) {
        return false;
    }

    return true
};

const SENTENCE_END_CHARS = /[.。．\u06D4\u061F\u0964\u0965\u1362\u0589\n]/;

const BLOCK_TAG_NAMES = new Set(['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'section', 'article', 'header', 'footer', 'nav', 'aside', 'main', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'pre', 'address', 'details', 'dialog', 'fieldset', 'figure', 'figcaption', 'form', 'dl', 'dt', 'dd', 'ol', 'ul']);

const CLOSING_QUOTE_CHARS = /[\u201C\u201D\u0022\uFF02\u300D\u300F\u301D\u301E\u301F\u00BB\u2019\u02BA]/;

const ZERO_WIDTH_OR_INVISIBLE = /[\u200B\u200C\u200D\uFEFF\u2060]/;

const OPENING_QUOTE_CHARS = /[""\uFF02\u300C\u300E\u00AB'\u2018]/;

const DIGIT_CHARS = /[0-9０-９٠-٩\u0660-\u0669]/;

const LOWERCASE_LETTER = /[a-z\u00E0-\u024F\u0370-\u03FF]/;

const getBlockAncestor = (node: Node): Element | null => {
    let el: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
    while (el && el !== el.ownerDocument?.body) {
        if (el.nodeType === Node.ELEMENT_NODE && BLOCK_TAG_NAMES.has((el as Element).tagName?.toLowerCase())) {
            return el as Element;
        }
        el = el.parentElement;
    }
    return el as Element | null;
};

const isNewlineAtBlockBoundary = (fullText: string, index: number, textNodes: { node: Text; start: number; end: number }[]): boolean => {
    if (fullText[index] !== '\n') return false;
    const idx = textNodes.findIndex(t => index >= t.start && index < t.end);
    if (idx < 0) return false;
    const curr = textNodes[idx];
    if (index !== curr.start) return false;
    if (idx === 0) return false;
    const prev = textNodes[idx - 1];
    const prevBlock = getBlockAncestor(prev.node);
    const currBlock = getBlockAncestor(curr.node);
    return prevBlock !== currBlock;
};

const isSentenceBoundary = (text: string, index: number, textNodes?: { node: Text; start: number; end: number }[]): boolean => {
    const ch = text[index];
    if (!ch || !SENTENCE_END_CHARS.test(ch)) return false;
    if (ch === '\n') {
        if (!textNodes) return false;
        return isNewlineAtBlockBoundary(text, index, textNodes);
    }
    if (ch === '.' || ch === '．') {
        const prev = index > 0 ? text[index - 1] : '';
        const next = index + 1 < text.length ? text[index + 1] : '';
        if (DIGIT_CHARS.test(prev) && DIGIT_CHARS.test(next)) return false;
        if (DIGIT_CHARS.test(prev) && (next === ' ' || next === '\t' || next === '\n')) return false;
        let j = index + 1;
        while (j < text.length && (text[j] === ' ' || text[j] === '\t')) j++;
        if (j < text.length && LOWERCASE_LETTER.test(text[j])) return false;
    }
    return true;
};

/**
 * Expand the selection to a full sentence (ending at sentence punctuation such as `.` or `。`).
 */
export const expandSelectionToSentence = (ownerDocument: Document, rootElement?: Element): boolean => {
    if (!ownerDocument) return false;
    const selection = ownerDocument.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0).cloneRange();
    const root = rootElement ?? getDocumentBody(ownerDocument);
    if (!root) return false;
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return false;

    const textNodes: { node: Text; start: number; end: number }[] = [];
    let fullText = '';
    const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let currentNode: Text | null;
    while ((currentNode = walker.nextNode() as Text | null)) {
        const text = currentNode.textContent ?? '';
        if (text.length > 0) {
            textNodes.push({ node: currentNode, start: fullText.length, end: fullText.length + text.length });
            fullText += text;
        }
    }
    if (textNodes.length === 0) return false;

    const getCharOffset = (container: Node, offset: number): number => {
        try {
            const r = ownerDocument.createRange();
            r.setStart(root, 0);
            r.setEnd(container, offset);
            return r.toString().length;
        } catch {
            return 0;
        }
    };

    let startOffset = Math.max(0, Math.min(getCharOffset(range.startContainer, range.startOffset), fullText.length));
    let endOffset = Math.max(0, Math.min(getCharOffset(range.endContainer, range.endOffset), fullText.length));
    if (startOffset > endOffset) [startOffset, endOffset] = [endOffset, startOffset];

    let sentenceStart = 0;
    for (let i = startOffset - 1; i >= 0; i--) {
        if (isSentenceBoundary(fullText, i, textNodes)) {
            while (i > 0 && SENTENCE_END_CHARS.test(fullText[i - 1])) i--;
            sentenceStart = i + 1;
            break;
        }
    }

    let sentenceEnd = fullText.length;
    for (let i = endOffset; i < fullText.length; i++) {
        if (isSentenceBoundary(fullText, i, textNodes)) {
            while (i + 1 < fullText.length && SENTENCE_END_CHARS.test(fullText[i + 1])) i++;
            sentenceEnd = i + 1;
            break;
        }
    }
    if (sentenceStart > sentenceEnd) sentenceEnd = sentenceStart;
    while (sentenceStart > 0 && OPENING_QUOTE_CHARS.test(fullText[sentenceStart - 1])) sentenceStart--;
    while (sentenceEnd < fullText.length && (CLOSING_QUOTE_CHARS.test(fullText[sentenceEnd]) || ZERO_WIDTH_OR_INVISIBLE.test(fullText[sentenceEnd]))) sentenceEnd++;
    while (sentenceStart < sentenceEnd && fullText[sentenceStart] === '\n') sentenceStart++;
    while (sentenceEnd > sentenceStart && fullText[sentenceEnd - 1] === '\n') sentenceEnd--;

    const isSkipNode = (n: Text) => {
        const t = n.textContent?.trim() ?? '';
        return t === '\n' || t === '';
    };
    const setRangeToOffset = (charOffset: number, isStart: boolean) => {
        for (let i = 0; i < textNodes.length; i++) {
            const { node, start, end } = textNodes[i];
            if (charOffset >= start && charOffset <= end) {
                if (isSkipNode(node)) {
                    if (isStart) {
                        for (let j = i + 1; j < textNodes.length; j++) {
                            if (!isSkipNode(textNodes[j].node)) {
                                range.setStart(textNodes[j].node, 0);
                                return;
                            }
                        }
                    } else {
                        for (let j = i - 1; j >= 0; j--) {
                            const prev = textNodes[j].node;
                            if (!isSkipNode(prev)) {
                                range.setEnd(prev, (prev.textContent ?? '').length);
                                return;
                            }
                        }
                    }
                    const fallback = isStart ? textNodes[0] : textNodes[textNodes.length - 1];
                    const offset = isStart ? 0 : (fallback.node.textContent ?? '').length;
                    if (isStart) range.setStart(fallback.node, 0);
                    else range.setEnd(fallback.node, offset);
                    return;
                }
                const offsetInNode = Math.min(charOffset - start, (node.textContent ?? '').length);
                if (isStart) {
                    range.setStart(node, offsetInNode);
                } else {
                    range.setEnd(node, offsetInNode);
                }
                return;
            }
        }
        if (textNodes.length > 0) {
            const fallback = isStart ? textNodes[0] : textNodes[textNodes.length - 1];
            const offset = isStart ? 0 : (fallback.node.textContent ?? '').length;
            if (isStart) range.setStart(fallback.node, 0);
            else range.setEnd(fallback.node, offset);
        }
    };
    setRangeToOffset(sentenceStart, true);
    setRangeToOffset(sentenceEnd, false);

    selection.removeAllRanges();
    selection.addRange(range);
    return true;
};

const findFirstTextNode = (root: Node): Text | null => {
    if (root.nodeType === Node.TEXT_NODE) {
        return root as Text;
    }
    const walker = root.ownerDocument?.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    if (!walker) {
        return null;
    }
    return walker.nextNode() as Text | null;
};

const findLastTextNode = (root: Node): Text | null => {
    if (root.nodeType === Node.TEXT_NODE) {
        return root as Text;
    }
    const walker = root.ownerDocument?.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    if (!walker) {
        return null;
    }
    let last: Text | null = null;
    let current: Text | null;
    while ((current = walker.nextNode() as Text | null)) {
        last = current;
    }
    return last;
};

const mapCharOffsetToTextPosition = (root: Node, charOffset: number): { node: Text; offset: number } | null => {
    if (charOffset < 0) {
        return null;
    }
    const walker = root.ownerDocument?.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    if (!walker) {
        return null;
    }
    let accumulated = 0;
    let lastText: Text | null = null;
    let current: Text | null;
    while ((current = walker.nextNode() as Text | null)) {
        lastText = current;
        const length = (current.textContent ?? '').length;
        if (charOffset <= accumulated + length) {
            return { node: current, offset: charOffset - accumulated };
        }
        accumulated += length;
    }
    if (lastText) {
        return { node: lastText, offset: (lastText.textContent ?? '').length };
    }
    return null;
};

const setRangeStartFallback = (range: Range, node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
        range.setStart(node, 0);
        return;
    }
    if (node.hasChildNodes()) {
        range.setStart(node.firstChild!, 0);
        return;
    }
    range.setStart(node, 0);
};

const setRangeEndFallback = (range: Range, node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
        range.setEnd(node, (node.textContent ?? '').length);
        return;
    }
    const lastNode = findLastNode(node);
    if (lastNode.nodeType === Node.TEXT_NODE) {
        range.setEnd(lastNode, (lastNode.textContent ?? '').length);
        return;
    }
    range.setEnd(node, node.childNodes.length);
};

const findRangeStart = (range: Range, startNode: Node, startTextOffset?: number) => {
    if (startTextOffset !== undefined) {
        const mapped = mapCharOffsetToTextPosition(startNode, startTextOffset);
        if (mapped) {
            range.setStart(mapped.node, mapped.offset);
            return;
        }
    }

    const firstText =
        startNode.nodeType === Node.TEXT_NODE ? (startNode as Text) : findFirstTextNode(startNode);
    if (firstText) {
        range.setStart(firstText, 0);
        return;
    }

    setRangeStartFallback(range, startNode);
};

const findRangeEnd = (range: Range, endNode: Node, endTextOffset?: number) => {
    if (endTextOffset !== undefined) {
        const mapped = mapCharOffsetToTextPosition(endNode, endTextOffset);
        if (mapped) {
            range.setEnd(mapped.node, mapped.offset);
            return;
        }
    }

    const lastText = endNode.nodeType === Node.TEXT_NODE ? (endNode as Text) : findLastTextNode(endNode);
    if (lastText) {
        range.setEnd(lastText, (lastText.textContent ?? '').length);
        return;
    }

    setRangeEndFallback(range, endNode);
};

/**
 * Create a selection range.
 * @param startNode Start node
 * @param endNode End node
 * @param startTextOffset Start text offset
 * @param endTextOffset End text offset
 * @returns The created range
 */
export const createRange = (startNode: Node, endNode: Node, startTextOffset?: number, endTextOffset?: number) => {
    const ownerDocument = startNode.ownerDocument;
    if (!ownerDocument) {
        return null;
    }
    const range = ownerDocument.createRange();
    try {
        findRangeStart(range, startNode, startTextOffset);
        findRangeEnd(range, endNode, endTextOffset);
    } catch {
        return null;
    }
    return range;
};
