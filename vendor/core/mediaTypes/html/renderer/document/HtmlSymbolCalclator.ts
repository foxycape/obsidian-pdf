import { compareTagName, getDocumentBody, getElementByElementNumber, getElementByNameAndIndex, getElementIndex } from "../../../../kernal/html/finder";
import { ElementPositionResult, getElementByPosition, getPositionByElement } from "../../../../kernal/html/position";
import { getPureInnerTextLength } from "../../../../kernal/html/text";
import { ElementInitialNumberName, ISymbolCalclator, ROOT_IDX, SymbolType } from "../../../../kernal";
import type { TagDescriptor, TextSymbolOptions } from "../../../../kernal/types";
import { IHtmlDocument } from "../IHtmlDocument";
import { HtmlOptions } from "../../HtmlOptions";
import { parseNumber } from "../../../../kernal/common/number";

export class HtmlSymbolCalclator implements ISymbolCalclator {
    constructor(public readonly doc: IHtmlDocument, private readonly options: HtmlOptions) {
    }

    private get textSymbolOptions(): TextSymbolOptions {
        return {
            removeHtmlWhitespace: this.options.removeHtmlWhitespace,
            whitespaceRegex: this.options.whitespaceRegex,
            nonWhiteSpaceSymbolTagNames: this.options.nonWhiteSpaceSymbolTagNames,
        };
    }

    async getElementByPosition(symbolPosition: number, symbolType: SymbolType, preferEnd?: boolean): Promise<ElementPositionResult> {
        const virtualContentContainer = await this.getFormatVirtualContentContainer();
        return getElementByPosition(
            virtualContentContainer,
            symbolPosition,
            symbolType,
            preferEnd,
            this.textSymbolOptions
        );
    }

    private formatVirtualContentContainer: HTMLElement;
    private async getFormatVirtualContentContainer() {
        if (!this.formatVirtualContentContainer) {
            this.formatVirtualContentContainer = await this.doc.getVirtualContentContainer();
        }
        return this.formatVirtualContentContainer;
    }

    private getOtherNonWhiteSpaceSymbolCount(element: Element) {
        let otherSymbolCount = 0;
        if (this.options?.nonWhiteSpaceSymbolTagNames) {
            for (const tagName of this.options.nonWhiteSpaceSymbolTagNames) {
                otherSymbolCount += element.getElementsByTagName(tagName).length;
            }
        }
        return otherSymbolCount;
    }

    async getElementByProgress(progress: number, symbolType: SymbolType): Promise<ElementPositionResult> {
        progress = progress ?? 0;
        const totalSymbolCount = await this.getTotalSymbolCount(symbolType);
        const elementPosition = Math.ceil(totalSymbolCount * progress);
        return this.getElementByPosition(elementPosition, symbolType);
    }


    async getProgressByElement(element: TagDescriptor | Element, symbolType: SymbolType, internalSymbolOffset?: number,): Promise<number> {
        const totalSymbolCount = await this.getTotalSymbolCount(symbolType)
        if (totalSymbolCount == 1) {
            return 1;
        }
        const position = await this.getPositionByElement(element, symbolType, internalSymbolOffset);
        let percentage = position / totalSymbolCount;
        if (percentage < 0) {
            percentage = 0
        }
        if (percentage > 1) {
            percentage = 1
        }
        return percentage;
    }

    async getPositionByElement(element: TagDescriptor | Element, symbolType: SymbolType, internalSymbolOffset?: number) {
        const virtualContentContainer = await this.getFormatVirtualContentContainer();
        let targetElement: Element | null = null;

        if (this.isTagDescriptor(element)) {
            if (compareTagName(element.tagName, "BODY")) {
                // ROOT_IDX is required by highlight components for body anchors.
                return internalSymbolOffset ?? ROOT_IDX;
            }
            targetElement = getElementByNameAndIndex(virtualContentContainer, element.tagName, element.tagIndex);
        }
        else {
            const currentElement = element;
            if (this.isBodyElement(currentElement, virtualContentContainer)) {
                return internalSymbolOffset ?? ROOT_IDX;
            }

            if (currentElement.ownerDocument == virtualContentContainer.ownerDocument) {
                targetElement = currentElement;
            }
            else {
                targetElement = this.resolveElementInVirtualDocument(virtualContentContainer, currentElement);
            }
        }

        if (!targetElement) {
            return -1;
        }
        if (this.isBodyElement(targetElement, virtualContentContainer)) {
            return internalSymbolOffset ?? ROOT_IDX;
        }

        return getPositionByElement(
            virtualContentContainer,
            targetElement,
            symbolType,
            internalSymbolOffset,
            this.textSymbolOptions
        );
    }

    private isTagDescriptor(element: TagDescriptor | Element): element is TagDescriptor {
        // Prefer descriptor detection over instanceof Element (cross-realm iframe Element constructors differ).
        return typeof (element as TagDescriptor)?.tagIndex === "number"
            && typeof (element as TagDescriptor)?.tagName === "string"
            && (element as Element)?.nodeType !== 1;
    }

    private isBodyElement(element: Element, virtualContentContainer: Element) {
        return element == virtualContentContainer || compareTagName(element.tagName, "BODY");
    }

    private resolveElementInVirtualDocument(virtualContentContainer: Element, currentElement: Element): Element | null {
        const initialIndex = parseNumber(currentElement.getAttribute(ElementInitialNumberName), -1, "parseInt");
        if (initialIndex >= 0) {
            const mappedByInitialIndex = getElementByElementNumber(virtualContentContainer, initialIndex);
            if (mappedByInitialIndex) {
                return mappedByInitialIndex;
            }
        }

        const body = getDocumentBody(currentElement.ownerDocument);
        if (!body) {
            return null;
        }

        // Only map by tag index when the live/virtual tag counts still match.
        if (body.getElementsByTagName(currentElement.tagName).length == virtualContentContainer.getElementsByTagName(currentElement.tagName).length) {
            const tagIndex = getElementIndex(body, currentElement);
            if (tagIndex >= 0) {
                return getElementByNameAndIndex(virtualContentContainer, currentElement.tagName, tagIndex);
            }
        }

        // Keep the virtual document as the only coordinate space; do not fall back to live DOM offsets.
        return null;
    }

    private totalTotalSymbolCountMap: Map<SymbolType, number> = new Map<SymbolType, number>()

    async getTotalSymbolCount(symbolType: SymbolType) {
        let totalTotalSymbolCount = this.totalTotalSymbolCountMap.get(symbolType)
        if (totalTotalSymbolCount >= 0)
            return totalTotalSymbolCount;
        const virtualContentContainer = await this.getFormatVirtualContentContainer();
        const characterCount = getPureInnerTextLength(
            virtualContentContainer,
            this.options.removeHtmlWhitespace,
            this.options.whitespaceRegex
        );
        let totalCount = characterCount;
        if (symbolType == "custom") {
            const otherSymbolCount = this.getOtherNonWhiteSpaceSymbolCount(virtualContentContainer);
            totalCount += otherSymbolCount;
        }
        totalTotalSymbolCount = totalCount
        this.totalTotalSymbolCountMap.set(symbolType, totalTotalSymbolCount)
        return totalTotalSymbolCount;
    }

    async dispose(): Promise<void> {
        this.totalTotalSymbolCountMap.clear();
        if (this.formatVirtualContentContainer) {
            this.formatVirtualContentContainer = null;
        }
    }
}
