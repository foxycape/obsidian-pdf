import { ElementInitialNumberName, ROOT_IDX } from "../Constants";
import { getUuid } from "../common/uuid";
import type { SymbolType, TextSymbolOptions } from "../types";
import { checkIsOtherNonWhiteSpaceSymbol, compareTagName, getAllNodes, getDocumentBody, getElementByNameAndIndex, getElementIndex } from "./finder";
import { getFormatDocument } from "./parser";
import { getPureInnerTextLength, removeWhiteSpaceBetweenTags } from "./text";
import { SymbolOffset } from "./types";

const symbolOffsetsIdMap = new Map<Document | Element, string>();
const symbolOffsetsMap = new Map<string, SymbolOffset[]>();

export const clearSymbolOffsetCache = () => {
    symbolOffsetsMap.clear();
    symbolOffsetsIdMap.clear();
};

export const checkContainsPureTextNode = (rootElement: Document | HTMLElement) => {
    const element = rootElement instanceof Document ? rootElement.body : rootElement as HTMLElement;
    const nodes = element.childNodes;
    for (const node of nodes) {
        if (node.nodeType == Node.TEXT_NODE && node.textContent?.trim()) {
            return true;
        }
    }
    return false;
};

const getOtherNonWhiteSpaceSymbolCount = (element: Element, nonWhiteSpaceSymbolTagNames?: string[]) => {
    let otherSymbolCount = 0;
    if (!nonWhiteSpaceSymbolTagNames || nonWhiteSpaceSymbolTagNames.length == 0)
        return otherSymbolCount;
    nonWhiteSpaceSymbolTagNames.forEach((tagName) => {
        otherSymbolCount += element.getElementsByTagName(tagName).length;
    });
    return otherSymbolCount;
};

export const calcSymbolOffsets = (
    rootElement: Document | Element,
    symbolType: SymbolType,
    options?: TextSymbolOptions
) => {
    const { removeHtmlWhitespace, whitespaceRegex, nonWhiteSpaceSymbolTagNames } = options ?? {};
    let rootElementId = symbolOffsetsIdMap.get(rootElement)
    if (!rootElementId) {
        rootElementId = getUuid();
        symbolOffsetsIdMap.set(rootElement, rootElementId)
    }
    let key = symbolType.toString()
    if (whitespaceRegex?.source) {
        key += whitespaceRegex.source
    }
    if (nonWhiteSpaceSymbolTagNames) {
        key += nonWhiteSpaceSymbolTagNames.join("-")
    }
    key += rootElementId

    const element = rootElement.ownerDocument ? rootElement as Element : getDocumentBody((rootElement as Document))
    const existSymbolOffsets = symbolOffsetsMap.get(key)
    if (existSymbolOffsets) {
        if (existSymbolOffsets.length == element.getElementsByTagName("*").length + 1) {
            return existSymbolOffsets;
        }
    }

    const symbolOffsets: SymbolOffset[] = [];

    let startOffset: number = 0

    const nodes = getAllNodes(element);
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.nodeType == Node.ELEMENT_NODE) {
            const currentElement = node as Element
            symbolOffsets.push(new SymbolOffset(currentElement, startOffset))
            if (symbolType == "custom") {
                if (checkIsOtherNonWhiteSpaceSymbol(currentElement.tagName, nonWhiteSpaceSymbolTagNames)) {
                    startOffset += 1
                }
            }
        }
        else if (node.nodeType == Node.TEXT_NODE) {
            startOffset += getPureInnerTextLength(node, removeHtmlWhitespace, whitespaceRegex);
        }
    }
    const newSymbolOffsets = symbolOffsets.reverse()
    symbolOffsetsMap.set(key, newSymbolOffsets)
    return newSymbolOffsets
};

const getElementToTargetSymbolCount = (
    rootElement: Document | Element,
    element: Element,
    symbolType: SymbolType,
    options?: TextSymbolOptions
): number => {
    const symbolOffsets = calcSymbolOffsets(rootElement, symbolType, options);
    const symbolOffset = symbolOffsets.find(x => x.element == element);
    if (symbolOffset)
        return symbolOffset.offset
    return -1;
};

export const getTotalSymbolCount = (target: string | Document | Element, symbolType: SymbolType, options?: TextSymbolOptions) => {
    const { removeHtmlWhitespace, whitespaceRegex, nonWhiteSpaceSymbolTagNames } = options ?? {};
    let element: Element;
    if (typeof target === "string") {
        const newHtml = removeWhiteSpaceBetweenTags(target, removeHtmlWhitespace)
        const ownerDocument = getFormatDocument(newHtml, true)
        element = getDocumentBody(ownerDocument);
    }
    else if (!target.ownerDocument) {
        element = getDocumentBody(target as Document);
    }
    else {
        element = target as Element;
    }

    const characterCount = getPureInnerTextLength(element, removeHtmlWhitespace, whitespaceRegex);
    let totalCount = characterCount;
    if (symbolType == "custom") {
        const otherSymbolCount = getOtherNonWhiteSpaceSymbolCount(element, nonWhiteSpaceSymbolTagNames);
        totalCount += otherSymbolCount;
    }
    return totalCount;
};

export const getElementByProgress = (
    rootElement: Document | HTMLElement,
    progress: number,
    symbolType: SymbolType,
    options?: TextSymbolOptions
): ElementPositionResult => {
    progress = progress ?? 0;
    const totalSymbolCount = getTotalSymbolCount(rootElement, symbolType, options);
    const elementPosition = Math.ceil(totalSymbolCount * progress);
    const result = getElementByPosition(rootElement, elementPosition, symbolType, false, options);
    return result;
};

export const getProgressByElement = (
    rootElement: Document | HTMLElement,
    element: { tagName: string, tagIndex: number } | Element,
    symbolType: SymbolType,
    internalSymbolOffset?: number,
    options?: TextSymbolOptions
): number => {
    const totalSymbolCount = getTotalSymbolCount(rootElement, symbolType, options)
    const position = getPositionByElement(rootElement, element, symbolType, internalSymbolOffset, options);
    const percentage = position / totalSymbolCount;
    return percentage;
};

export const getElementByPosition = (
    rootElement: Document | HTMLElement,
    symbolPosition: number,
    symbolType: SymbolType,
    preferEnd?: boolean,
    options?: TextSymbolOptions,
): ElementPositionResult => {
    const { removeHtmlWhitespace, whitespaceRegex } = options ?? {};
    const nonWhiteSpaceSymbolTagNames = options?.nonWhiteSpaceSymbolTagNames ?? [];
    const symbolOffsets = calcSymbolOffsets(rootElement, symbolType, {
        ...options,
        nonWhiteSpaceSymbolTagNames,
    });
    let symbolOffsetIndex = symbolOffsets.findIndex(x => symbolPosition >= x.offset);
    if (symbolOffsetIndex < 0) {
        return null;
    }

    let symbolOffset = symbolOffsets[symbolOffsetIndex];
    if (!symbolOffset.element.getAttribute(ElementInitialNumberName)) {
        const maxSymbolOffsetsIndex = symbolOffsets.length - 1;
        while (symbolOffsetIndex < maxSymbolOffsetsIndex) {
            symbolOffsetIndex++
            symbolOffset = symbolOffsets[symbolOffsetIndex]
            if (symbolOffset.element.getAttribute(ElementInitialNumberName)) {
                break;
            }
        }
    }
    let textOffset: number;
    let diff = symbolPosition - symbolOffset.offset
    let currentElementSymbolCount = getTotalSymbolCount(symbolOffset.element, symbolType, options);
    if (diff == 0 && preferEnd) {
        if (symbolOffsetIndex < symbolOffsets.length - 1) {
            symbolOffset = symbolOffsets[symbolOffsetIndex + 1];
        }
    }
    diff = symbolPosition - symbolOffset.offset
    currentElementSymbolCount = getTotalSymbolCount(symbolOffset.element, symbolType, options);
    if (diff > currentElementSymbolCount) {
        if (symbolOffsetIndex == 0) {
            textOffset = currentElementSymbolCount
        }
        else {
            symbolOffset = symbolOffsets.find(x => x.element == symbolOffset.element.parentElement);
            if (!symbolOffset) {
                if (checkContainsPureTextNode(rootElement)) {
                    const root = rootElement instanceof Document ? rootElement.body : rootElement as HTMLElement;
                    symbolOffset = new SymbolOffset(root, 0)
                }
                else {
                    symbolOffset = symbolOffsets[symbolOffsetIndex - 1]
                }
            }

            if (!checkContainsPureTextNode(rootElement)) {
                if (symbolType == 'char' && compareTagName(symbolOffset.element.tagName, "BODY")) {
                    const previousSymbolOffset = symbolOffsets[symbolOffsetIndex - 1];
                    if (previousSymbolOffset && previousSymbolOffset.offset >= symbolPosition) {
                        symbolOffset = previousSymbolOffset
                    }
                }
            }
        }
    }
    if (!checkContainsPureTextNode(rootElement)) {
        if (symbolType == 'char' && compareTagName(symbolOffset.element.tagName, "BODY")) {
            const children = symbolOffset.element.children;
            let validElement: Element;
            for (let i = 0; i < children.length; i++) {
                if (!nonWhiteSpaceSymbolTagNames.includes(children[i].tagName.toLowerCase())) {
                    validElement = children[i];
                    break;
                }
            }
            if (validElement) {
                return { element: validElement, index: 0, offset: 0 }
            }
        }
    }
    if (textOffset === undefined) {
        textOffset = symbolPosition - symbolOffset.offset;
        if (textOffset < 0) {
            textOffset = 0;
        }
        else if (symbolType == 'char') {
            currentElementSymbolCount = getPureInnerTextLength(symbolOffset.element, removeHtmlWhitespace, whitespaceRegex)
            let parentWalkGuard = 0;
            while (textOffset > currentElementSymbolCount && parentWalkGuard < 256) {
                parentWalkGuard++
                const parentSymbolOffset = symbolOffsets.find(x => x.element === symbolOffset.element.parentElement)
                if (!parentSymbolOffset) {
                    textOffset = currentElementSymbolCount
                    break
                }
                symbolOffset = parentSymbolOffset
                currentElementSymbolCount = getPureInnerTextLength(symbolOffset.element, removeHtmlWhitespace, whitespaceRegex)
                textOffset = symbolPosition - symbolOffset.offset
                if (textOffset < 0) {
                    textOffset = 0
                    break
                }
            }
            if (textOffset > currentElementSymbolCount) {
                textOffset = currentElementSymbolCount
            }
        }
    }
    let tagIndex = getElementIndex(rootElement, symbolOffset.element)
    if (tagIndex == -1 && compareTagName(symbolOffset.element.tagName, "BODY")) {
        tagIndex = ROOT_IDX
    }
    return { element: symbolOffset.element, index: tagIndex, offset: textOffset }
};

export const getPositionByElement = (
    rootElement: Document | Element,
    tag: { tagName: string, tagIndex: number } | Element,
    symbolType: SymbolType,
    internalSymbolOffset?: number,
    options?: TextSymbolOptions
) => {
    let element: Element;
    if ((tag as any).tagIndex >= 0) {
        const tagObj = tag as { tagName: string, tagIndex: number }
        element = getElementByNameAndIndex(rootElement, tagObj.tagName, tagObj.tagIndex ?? 0);
    }
    else {
        element = tag as Element;
    }
    if (!element)
        return -1;
    const symbolCount = getElementToTargetSymbolCount(rootElement, element, symbolType, options);
    return symbolCount + (internalSymbolOffset ?? 0);
};

export const getPositionByNode = (
    rootElement: Document | Element,
    node: Node,
    symbolType: SymbolType,
    options?: TextSymbolOptions
): number => {
    const { removeHtmlWhitespace, whitespaceRegex } = options ?? {};
    if (!node) return -1
    if (node.nodeType === Node.ELEMENT_NODE) {
        return getPositionByElement(rootElement, node as Element, symbolType, 0, options)
    }
    const element = rootElement.ownerDocument ? rootElement as Element : getDocumentBody(rootElement as Document)
    const nodes = getAllNodes(element)
    let offset = 0
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        if (n === node) return offset
        if (n.nodeType === Node.TEXT_NODE) {
            offset += getPureInnerTextLength(n, removeHtmlWhitespace, whitespaceRegex)
        }
    }
    return -1
};

export class ElementPositionResult {
    /**
     * constructor
     * @param element The element in the document.
     * @param index The index of the element in the document.
     * @param offset The internal symbol offset of the element.
     */
    constructor(public readonly element: Element, public readonly index: number, public readonly offset: number) { }
}