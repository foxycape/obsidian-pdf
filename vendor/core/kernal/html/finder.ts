import { ElementInitialNumberName } from "../Constants";
import { parseNumber } from "../common/number";
import type { ElementRangeType } from "./types";

export const compareTagName = (sourceTagName: string, targetTagName: string) => {
    if (!sourceTagName || !targetTagName) {
        return false;
    }
    if (sourceTagName == targetTagName)
        return true;
    if (sourceTagName?.toLowerCase() == targetTagName?.toLowerCase())
        return true;
    return false;
};

export const getDocumentHead = (ownerDocument: Document) => {
    let head = ownerDocument.head;
    if (!head)
        head = ownerDocument.querySelector("head");
    return head;
};

export const getDocumentBody = (ownerDocument: Document) => {
    if (!ownerDocument)
        return null;
    let body = ownerDocument.body;
    if (!body)
        body = ownerDocument.querySelector("body");
    return body;
};

const getTagIndex = (tags: HTMLCollectionOf<Element>, tag: Element) => {
    let i = 0;
    for (i = 0; i < tags.length; i++) {
        const currentTag = tags.item(i)
        if (currentTag == tag) {
            return i;
        }
    }
    for (i = 0; i < tags.length; i++) {
        const currentTag = tags.item(i)
        if (currentTag.tagName == tag.tagName) {
            const currentTagIndexNumber = currentTag.getAttribute(ElementInitialNumberName)
            if (currentTagIndexNumber && currentTagIndexNumber == tag.getAttribute(ElementInitialNumberName)) {
                return i;
            }
        }
    }

    return -1;
};

export const getAllNodes = (node: Node) => {
    const nodes: Node[] = [];
    nodes.push(node);
    if (node.hasChildNodes()) {
        node.childNodes.forEach(childNode => {
            nodes.push(...getAllNodes(childNode))
        })
    }
    return nodes;
};

/** Index of the last node in root's subtree within a preorder flat list (inclusive of root) */
export const findLastPreorderIndexInSubtree = (nodes: Node[], rootIndex: number, root: Node): number => {
    if (rootIndex < 0 || rootIndex >= nodes.length || nodes[rootIndex] !== root) {
        return rootIndex;
    }
    if (root.nodeType != Node.ELEMENT_NODE && root.nodeType != Node.DOCUMENT_NODE) {
        return rootIndex;
    }
    const container = root as Element | Document;
    let last = rootIndex;
    for (let j = rootIndex + 1; j < nodes.length; j++) {
        if (!container.contains(nodes[j])) {
            break;
        }
        last = j;
    }
    return last;
};

export const nodeContainsDescendant = (ancestor: Node, descendant: Node): boolean => {
    if (ancestor.nodeType == Node.ELEMENT_NODE || ancestor.nodeType == Node.DOCUMENT_NODE) {
        return (ancestor as Element | Document).contains(descendant);
    }
    return false;
};

/**
 * Get the index of an element among matching tags.
 */
export const getElementIndex = (rootElement: Document | Element, element: Element, range?: ElementRangeType) => {
    const rootElementType = rootElement.ownerDocument ? (compareTagName((rootElement as Element).tagName, "BODY") ? 'body' : 'element') : 'document';
    const rootElementOwnerDocument = rootElement.ownerDocument ?? rootElement as Document;
    const elementOwnerDocument = element.ownerDocument;
    if (!range || range == "similar") {
        const tagName = element.tagName;
        if (rootElementOwnerDocument != elementOwnerDocument) {
            const body = getDocumentBody(elementOwnerDocument);
            return getTagIndex(body.getElementsByTagName(tagName), element)
        }
        else {
            return getTagIndex(rootElement.getElementsByTagName(tagName), element)
        }

    }
    else {
        if (rootElementOwnerDocument != elementOwnerDocument) {
            const body = getDocumentBody(elementOwnerDocument);
            return getTagIndex(body.getElementsByTagName("*"), element)
        }
        else {
            const elementIndex = parseNumber(element.getAttribute(ElementInitialNumberName), -1, 'parseInt');

            if (elementIndex > 0) {
                if (rootElementType == 'body') {
                    const body = rootElement as Element
                    const bodyIndex = parseNumber(body.getAttribute(ElementInitialNumberName), -1, 'parseInt');
                    let svgElementCount = 0;
                    if (body.firstElementChild && compareTagName(body.firstElementChild.tagName, 'SVG')) {
                        const svgWidth = parseNumber((body.firstElementChild as HTMLElement).style?.width, 0, 'parseInt');
                        if (svgWidth == 0) {
                            svgElementCount = body.firstElementChild.getElementsByTagName('*').length + 1;
                        }
                    }
                    if (bodyIndex > 0 && elementIndex > bodyIndex) {
                        const allElements = rootElementOwnerDocument.getElementsByTagName("*")
                        const headerElementCount = getDocumentHead(rootElementOwnerDocument).getElementsByTagName("*").length + 1;
                        const nowBodyIndex = headerElementCount + 1;
                        const nowElementIndex = elementIndex + svgElementCount - bodyIndex + (nowBodyIndex - bodyIndex);
                        const checkElement = allElements.item(nowElementIndex);
                        if (checkElement && checkElement == element) {
                            return nowElementIndex;
                        }
                    }
                }
                else if (rootElementType == 'document') {
                    const body = getDocumentBody(rootElementOwnerDocument)

                    let svgElementCount = 0;
                    if (body.firstElementChild && compareTagName(body.firstElementChild.tagName, 'SVG')) {
                        const svgWidth = parseNumber((body.firstElementChild as HTMLElement).style?.width, 0, 'parseInt');
                        if (svgWidth == 0) {
                            svgElementCount = body.firstElementChild.getElementsByTagName('*').length + 1;
                        }
                    }
                    const allElements = rootElementOwnerDocument.getElementsByTagName("*")
                    const bodyIndex = parseNumber(body.getAttribute(ElementInitialNumberName), -1, 'parseInt');
                    const headerElementCount = getDocumentHead(rootElementOwnerDocument).getElementsByTagName("*").length + 1;
                    const nowBodyIndex = headerElementCount + 1;
                    const nowElementIndex = elementIndex + svgElementCount + (nowBodyIndex - bodyIndex);
                    const checkElement = allElements.item(nowElementIndex);
                    if (checkElement && checkElement == element) {
                        return nowElementIndex;
                    }
                }
            }
            const elements = rootElement.getElementsByTagName("*");
            return getTagIndex(elements, element)
        }
    }
};

export const checkIsOtherNonWhiteSpaceSymbol = (elementName: string, nonWhiteSpaceSymbolTagNames?: string[]) => {
    if (!nonWhiteSpaceSymbolTagNames || nonWhiteSpaceSymbolTagNames.length == 0)
        return false;
    return nonWhiteSpaceSymbolTagNames.indexOf(elementName.toLowerCase()) >= 0
};

export const getElementByNameAndIndex = (rootElement: Document | Element, tagName: string, tagIndex: number) => {
    if (!tagName) {
        return null;
    }
    if (compareTagName(tagName, "BODY")) {
        const rootElementOwnerDocument = rootElement.ownerDocument ?? rootElement as Document;
        return getDocumentBody(rootElementOwnerDocument);
    }
    let index = tagIndex ?? 0;
    const tags = rootElement.getElementsByTagName(tagName);
    if (index > tags.length - 1) {
        index = tags.length - 1;
    }
    const tag = tags[index];
    return tag;
};

export const getElementByElementNumber = (rootElement: Document | Element, elementNumber: number) => {
    if (!(elementNumber >= 0)) {
        return null;
    }
    const tag = rootElement.querySelector("[" + ElementInitialNumberName + "='" + elementNumber + "']");
    return tag;
};

export const getHtmlNode = (rootElement: Element, tagName: string, tagIndex: number, nodeIndex: number) => {
    const el = rootElement.tagName == tagName && tagIndex == 0 ? rootElement : getElementByNameAndIndex(rootElement, tagName, tagIndex);
    if (el.hasChildNodes() && el.childNodes.length > nodeIndex) {
        return el.childNodes[nodeIndex];
    }
    return el.childNodes[0]
};

const getHtmlChildNodeIndexAndOffset = (nodes: NodeListOf<ChildNode>, leftTagTextOffset: number): { node: ChildNode, offset: number } => {
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].hasChildNodes()) {
            const result = getHtmlChildNodeIndexAndOffset(nodes[i].childNodes, leftTagTextOffset)
            if (result.node) {
                return result
            }
        }
        else {
            if (nodes[i].textContent.length >= leftTagTextOffset) {
                return { node: nodes[i], offset: leftTagTextOffset };
            }
            else {
                leftTagTextOffset -= nodes[i].textContent.length
            }
        }
    }
    return { node: null, offset: leftTagTextOffset }
};

export const getHtmlNodeIndexAndOffset = (rootElement: Element, tagName: string, tagIndex: number, tagTextOffset: number): { node: ChildNode, offset: number } => {
    const el = rootElement.tagName == tagName && tagIndex == 0 ? rootElement : getElementByNameAndIndex(rootElement, tagName, tagIndex);
    let leftTagTextOffset = tagTextOffset;
    if (el.hasChildNodes()) {
        return getHtmlChildNodeIndexAndOffset(el.childNodes, leftTagTextOffset)
    }
    else {
        return { node: el, offset: tagTextOffset }
    }
};

/**
 * Find the last descendant node of the given element.
 */
export const findLastNode = (element: Element | Node) => {
    if (!element.hasChildNodes())
        return element;
    let lastNode: Node = element;
    while (lastNode.hasChildNodes()) {
        lastNode = lastNode.lastChild;
    }
    return lastNode
};

export const getElementsByTagName = (root: Document | Element, nodeName: string, allowNSQuery?: boolean) => {
    let elements = root.getElementsByTagName(nodeName)
    if (elements.length == 0 && allowNSQuery) {
        elements = root.getElementsByTagNameNS("*", nodeName)
    }
    return elements;
};
