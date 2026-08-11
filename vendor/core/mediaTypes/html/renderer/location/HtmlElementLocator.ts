import { isNullOrWhiteSpace } from "../../../../kernal/common/text";
import { FileLocation, IDocumentsProvider, ProgressUnit, SymbolType } from "../../../../kernal";
import { HtmlOptions } from "../../HtmlOptions";
import { compareTagName, getElementByNameAndIndex } from "../../../../kernal/html/finder";
import { IHtmlDocument } from "../IHtmlDocument";
import { Progress } from "../../../../kernal/progress/Progress";
import { getElementByPosition, getElementByProgress } from "../../../../kernal/html/position";
import { getUrlFragment } from "../../../../kernal/common/url";
import type { FlipMode, TextSymbolOptions } from "../../../../kernal/types";
import { ElementLocatorResult } from "./IHtmlElementLocator";
import { IHtmlElementLocator } from "./IHtmlElementLocator";

export class HtmlElementLocator implements IHtmlElementLocator {
    constructor(public readonly documentsProvider: IDocumentsProvider) {
    }

    async locateElement(doc: IHtmlDocument, location: FileLocation, options: HtmlOptions): Promise<ElementLocatorResult> {
        let target: Element;
        let pageNumber: number | undefined;
        let isDocumentStart: boolean = false;
        const flipMode = options.flipMode;
        const contentContainer = doc.getContentContainer();
        const symbolOptions: TextSymbolOptions = {
            removeHtmlWhitespace: options.removeHtmlWhitespace,
            whitespaceRegex: options.whitespaceRegex,
            nonWhiteSpaceSymbolTagNames: options.nonWhiteSpaceSymbolTagNames,
        };
        const symbolType = location.symbolType ?? options.symbolType;

        if (!isNullOrWhiteSpace(location.tagName)) {
            target = getElementByNameAndIndex(contentContainer, location.tagName, location.tagIndex);
        }
        else if (location.current != undefined) {
            const unit: ProgressUnit = location.unit ?? "ratio";
            const current = location.current ?? 0;

            if (unit === "page") {
                const result = await this.locateByPageUnit(doc, contentContainer, location, current, flipMode, symbolType, symbolOptions);
                target = result.target;
                pageNumber = result.pageNumber;
                isDocumentStart = result.isDocumentStart;
            }
            else if (unit === "symbol") {
                const result = this.locateBySymbolUnit(contentContainer, current, symbolType, symbolOptions);
                target = result.target;
                isDocumentStart = result.isDocumentStart;
            }
            else {
                // ratio / second: locate by ratio; keep a compatibility heuristic for values that look like page numbers in page flip mode
                const result = await this.locateByRatioUnit(doc, contentContainer, location, current, flipMode, symbolType, symbolOptions);
                target = result.target;
                pageNumber = result.pageNumber;
                isDocumentStart = result.isDocumentStart;
            }
        }
        else {
            const anchor = getUrlFragment(location?.url ?? "").anchor;
            let element: Element = contentContainer;
            if (!isNullOrWhiteSpace(anchor)) {
                const targetAnchor = contentContainer.ownerDocument.getElementById(anchor);
                if (targetAnchor != null) {
                    element = targetAnchor;
                }
            }
            else {
                isDocumentStart = true;
            }

            target = element;
        }

        if (!target) {
            target = contentContainer;
            if (flipMode == "page" && !pageNumber) {
                pageNumber = 1;
            }
        }
        else {
            if (flipMode == "page" && !pageNumber) {
                pageNumber = await doc.getPageNumber(target);
            }
        }
        if (compareTagName(target.tagName, "BODY")) {
            isDocumentStart = true;
        }
        return { target, pageNumber, isDocumentStart };
    }

    private async locateByPageUnit(
        doc: IHtmlDocument,
        contentContainer: HTMLElement,
        location: FileLocation,
        current: number,
        flipMode: FlipMode,
        symbolType: SymbolType,
        symbolOptions: TextSymbolOptions,
    ): Promise<PartialLocateResult> {
        if (current == 0) {
            return { target: contentContainer, pageNumber: 1, isDocumentStart: true };
        }

        const numberOfPages = await doc.getNumberOfPages();
        let page = current;
        if (location.total > 1 && location.total != numberOfPages) {
            page = Math.ceil(numberOfPages * (location.current / location.total));
        }

        if (flipMode == "page") {
            return { pageNumber: page, isDocumentStart: false };
        }

        // Scroll mode: convert page number to ratio, then locate the element (page 1 maps to document start)
        if (page <= 1 || numberOfPages <= 1) {
            return { target: contentContainer, isDocumentStart: true };
        }
        if (page >= numberOfPages) {
            return this.locateElementByRatio(contentContainer, Progress.Max, symbolType, symbolOptions);
        }
        const ratio = (page - 1) / numberOfPages;
        return this.locateElementByRatio(contentContainer, ratio, symbolType, symbolOptions);
    }

    private locateBySymbolUnit(
        contentContainer: HTMLElement,
        current: number,
        symbolType: SymbolType,
        symbolOptions: TextSymbolOptions,
    ): PartialLocateResult {
        if (current == 0) {
            return { target: contentContainer, isDocumentStart: true };
        }

        const result = getElementByPosition(contentContainer, current, symbolType, false, symbolOptions);
        if (result?.element) {
            return { target: result.element, isDocumentStart: false };
        }
        if (contentContainer.lastElementChild) {
            return { target: contentContainer.lastElementChild, isDocumentStart: false };
        }
        return { target: contentContainer, isDocumentStart: false };
    }

    private async locateByRatioUnit(
        doc: IHtmlDocument,
        contentContainer: HTMLElement,
        location: FileLocation,
        current: number,
        flipMode: FlipMode,
        symbolType: SymbolType,
        symbolOptions: TextSymbolOptions,
    ): Promise<PartialLocateResult> {
        if (flipMode == "page") {
            if (current == 0) {
                return { target: contentContainer, pageNumber: 1, isDocumentStart: true };
            }

            const numberOfPages = await doc.getNumberOfPages();
            let value = current;
            // Compat: historical callers often put the page number in current with unit=ratio
            if (location.total > 1 && location.total != numberOfPages) {
                value = Math.ceil(numberOfPages * (location.current / location.total));
            }

            if (value >= Progress.Min && value <= Progress.Max) {
                return this.locateElementByRatio(contentContainer, value, symbolType, symbolOptions);
            }
            return { pageNumber: value, isDocumentStart: false };
        }

        return this.locateElementByRatio(contentContainer, current, symbolType, symbolOptions);
    }

    private locateElementByRatio(
        contentContainer: HTMLElement,
        ratio: number,
        symbolType: SymbolType,
        symbolOptions: TextSymbolOptions,
    ): PartialLocateResult {
        if (ratio >= Progress.Max && contentContainer.lastElementChild) {
            return { target: contentContainer.lastElementChild, isDocumentStart: false };
        }
        const result = getElementByProgress(contentContainer, ratio, symbolType, symbolOptions);
        return { target: result?.element, isDocumentStart: false };
    }
}

type PartialLocateResult = {
    target?: Element;
    pageNumber?: number;
    isDocumentStart: boolean;
};