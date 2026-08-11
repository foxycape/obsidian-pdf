import { compareTagName, findLastNode, getAllNodes, getDocumentBody, nodeContainsDescendant, findLastPreorderIndexInSubtree } from "./finder";

/** Parent has only this text node — LF inside is treated as soft wrap → space. */
const isSoleTextChild = (textNode: Text) => {
    const parentEl = textNode.parentElement;
    return !!parentEl && parentEl.childNodes.length === 1 && parentEl.firstChild === textNode;
};

const appendTextNodeContent = (parts: string[], textNode: Text) => {
    const nodeText = textNode.nodeValue ?? "";
    if (isSoleTextChild(textNode) && nodeText.includes("\n")) {
        parts.push(nodeText.replace(/\n/g, " "));
        return;
    }
    parts.push(nodeText);
};

/**
 * Collect text with selective LF→space for sole text children.
 * Uses TreeWalker instead of flattening the whole subtree + repeated textContent reads.
 */
const getTextContentConvertingSoleTextLF = (node: Node) => {
    const parts: string[] = [];
    if (node.nodeType === Node.TEXT_NODE) {
        appendTextNodeContent(parts, node as Text);
        return parts.join("");
    }

    const ownerDocument = node.nodeType === Node.DOCUMENT_NODE
        ? node as Document
        : node.ownerDocument;
    if (!ownerDocument) {
        return node.textContent ?? "";
    }

    const walker = ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
        appendTextNodeContent(parts, current as Text);
        current = walker.nextNode();
    }
    return parts.join("");
};

export const getPureTextContent = (
    node: Node,
    removeHtmlWhitespace?: boolean,
    whitespaceRegex?: RegExp,
    /** Whether to convert line feeds to spaces */
    convertLFToWhitespace?: boolean
) => {
    if (convertLFToWhitespace) {
        return getTextContentConvertingSoleTextLF(node);
    }
    const content = node.textContent;
    if (!removeHtmlWhitespace || !whitespaceRegex) {
        return content;
    }
    return content.replace(whitespaceRegex, '');
};

export const getPureInnerTextLength = (
    node: Node,
    removeHtmlWhitespace?: boolean,
    whitespaceRegex?: RegExp
) => {
    const content = getPureTextContent(node, removeHtmlWhitespace, whitespaceRegex);
    return content.length;
};

/**
 * Get the text content between two nodes.
 */
export const getTextBetweenNodes = (
    startNode: Node,
    endNode: Node | undefined,
    excludeStartNodeText: boolean | undefined,
    excludeEndNodeText: boolean | undefined,
    removeHtmlWhitespace: boolean | undefined,
    whitespaceRegex: RegExp | undefined,
    /** Whether to convert line feeds to spaces */
    convertLFToWhitespace?: boolean
) => {
    const getPure = (node: Node) => getPureTextContent(node, removeHtmlWhitespace, whitespaceRegex, convertLFToWhitespace);
    if (!startNode) {
        return ""
    }
    const body = getDocumentBody(startNode.ownerDocument)
    if (compareTagName(startNode.nodeName, "BODY")) {
        if (body.childNodes.length == 0) {
            return ""
        }
        startNode = body.childNodes[0];
    }
    if (!endNode) {
        endNode = findLastNode(body);
    }
    // When start and end are the same node: matches the degenerate case below
    // (advance startIndex / retreat endIndex, then scan TEXT_NODEs) —
    // excluding either end yields an empty range (e.g. excludeEnd with FlowTextBuilder
    // using (false, true) for body length before an anchor: if the first body child is
    // the anchor then start === end, and the result must be "" rather than the whole subtree textContent).
    if (startNode == endNode) {
        if (excludeStartNodeText || excludeEndNodeText) {
            return "";
        }
        return getPure(startNode);
    }
    const nodes = getAllNodes(body);
    let i = 0;
    let startNodeIndex = nodes.findIndex(x => x == startNode);
    let endNodeIndex = nodes.findIndex(x => x == endNode);
    if (startNodeIndex < 0 || endNodeIndex < 0) {
        return ""
    }
    let expandedEndForContainingAncestor = false;
    if (startNodeIndex > endNodeIndex && nodeContainsDescendant(endNode, startNode)) {
        endNodeIndex = findLastPreorderIndexInSubtree(nodes, endNodeIndex, endNode);
        expandedEndForContainingAncestor = true;
    }
    if (excludeStartNodeText) {
        startNodeIndex += 1;
    }
    if (excludeEndNodeText && !expandedEndForContainingAncestor) {
        endNodeIndex -= 1
    }
    let text = ""
    for (i = startNodeIndex; i <= endNodeIndex; i++) {
        const node = nodes[i]
        if (node.nodeType == Node.TEXT_NODE) {
            text += getPure(node)
        }
    }
    return text;
};

/** Trim text between `>` and `<` (aggressive mode). */
const TRIM_BETWEEN_TAGS = />([^>]*)</g;

/** Whitespace between close→open / open→open / close→close (not open→close). */
const COLLAPSE_END_START = /(<\/[^>]*>)\s+(<[^\/>]*>)/g;
const COLLAPSE_START_START = /(<[^\/>]*>)\s+(<[^\/>]*>)/g;
const COLLAPSE_END_END = /(<\/[^>]*>)\s+(<\/[^>]*>)/g;

/**
 * Remove whitespace between HTML tags.
 * Note: this removes all inter-tag whitespace, including spaces.
 * It may be unsuitable for inline tags, where whitespace can be significant.
 */
export const removeWhiteSpaceBetweenTags = (html: string, removeHtmlWhitespace?: boolean) => {
    if (!html) {
        return html;
    }
    if (removeHtmlWhitespace) {
        return html.replace(TRIM_BETWEEN_TAGS, (match, between: string) => {
            if (!between) {
                return match;
            }
            const trimmed = between.trim();
            return trimmed.length === between.length ? match : `>${trimmed}<`;
        });
    }

    // Three passes: a single left-to-right replace can miss cascading gaps
    // (e.g. `</a>\n</b>\n<div>` needs both end-end and end-start cleanup).
    return html
        .replace(COLLAPSE_END_START, "$1$2")
        .replace(COLLAPSE_START_START, "$1$2")
        .replace(COLLAPSE_END_END, "$1$2");
};
