import { getTransformLength } from "../../../../kernal/html/style";
import { compareTagName, getDocumentBody } from "../../../../kernal/html/finder";
import { parseNumber } from "../../../../kernal/common/number";
import { WritingMode } from "../../../../kernal";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { IHtmlDocument } from "../IHtmlDocument";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import { HtmlOptions } from "../../HtmlOptions";
import { HtmlSettings } from "../../HtmlSettings";

export class HtmlPageCalculator {
    constructor(
        private readonly doc: IHtmlDocument,
        private readonly layout: IRendererViewport<HtmlLayoutMetrics>,
        private readonly options: HtmlOptions
    ) {
    }

    calcNumberOfPages(update?: boolean) {
        let numberOfPages = 1;
        if (this.options.flipMode == "scroll") {
            return numberOfPages;
        }
        const ownerDocument = this.doc.getContentContainer()?.ownerDocument;
        const documentElement = ownerDocument?.documentElement;
        if (!documentElement || !documentElement.firstElementChild)
            return 1;
        if (!update) {
            numberOfPages = parseNumber(documentElement.getAttribute(HtmlSettings.HtmlDocumentNumperOfPagesPropertyName), 0, 'parseInt');
            if (numberOfPages > 1) {
                return numberOfPages;
            }
        }
        const documentViewport = this.layout.getLayoutMetrics();
        const writingMode = this.options.writingMode ?? 'horizontal-tb';
        const iframe = this.getIframe();
        if (this.isVerticalWriting(writingMode)) {
            let totalLength = 0;
            let scrollHeight = documentElement.scrollHeight;
            if (scrollHeight < 1)
                scrollHeight = 1;
            let translateY = getTransformLength(documentElement, "y");
            if (Math.abs(translateY) > 0) {
                if (iframe) {
                    const iframeScrollHeight = iframe.scrollHeight;
                    if (scrollHeight == iframeScrollHeight) {
                        this.transformCurrentDocument(this.getContentRootElement(), translateY - 2, "y");
                        const newHtmlScrollHeight = documentElement.scrollHeight;
                        if (scrollHeight == newHtmlScrollHeight) {
                            this.transformCurrentDocument(this.getContentRootElement(), 0, "y");
                            translateY = 0;
                            scrollHeight = documentElement.scrollHeight;
                        }
                        else {
                            this.transformCurrentDocument(this.getContentRootElement(), translateY, "y");
                        }
                    }
                }
            }
            totalLength = scrollHeight + translateY;
            numberOfPages = Math.floor(totalLength / documentViewport.pageMoveLength);
            if (totalLength % documentViewport.pageMoveLength > documentViewport.columnGap) {
                numberOfPages = numberOfPages + 1;
            }
        }
        else {
            let totalLength = 0;
            let htmlScrollWidth = documentElement.scrollWidth;
            if (htmlScrollWidth < 1)
                htmlScrollWidth = 1;
            let translateX = getTransformLength(documentElement, "x");
            if (Math.abs(translateX) > 0) {
                if (iframe) {
                    const iframeScrollWidth = iframe.scrollWidth;
                    if (htmlScrollWidth == iframeScrollWidth) {
                        this.transformCurrentDocument(this.getContentRootElement(), translateX - 2, "x");
                        const newHtmlScrollWidth = documentElement.scrollWidth;
                        if (htmlScrollWidth == newHtmlScrollWidth) {
                            this.transformCurrentDocument(this.getContentRootElement(), 0, "x");
                            translateX = 0;
                            htmlScrollWidth = documentElement.scrollWidth;
                        }
                        else {
                            this.transformCurrentDocument(this.getContentRootElement(), translateX, "x");
                        }
                    }
                }
            }
            totalLength = translateX + htmlScrollWidth;
            numberOfPages = Math.floor(totalLength / documentViewport.pageMoveLength);
            if (totalLength % documentViewport.pageMoveLength > documentViewport.columnGap) {
                numberOfPages = numberOfPages + 1;
            }
        }
        documentElement.setAttribute(HtmlSettings.HtmlDocumentNumperOfPagesPropertyName, numberOfPages.toString());
        return numberOfPages;
    }

    getPageNumber(element: Element) {
        if (!element)
            return 1;
        const ownerDocument = this.doc.getContentContainer()?.ownerDocument;
        const body = getDocumentBody(ownerDocument);
        if (!body)
            return 1;
        if (compareTagName("BODY", element.tagName)) {
            return 1;
        }
        const documentViewport = this.layout.getLayoutMetrics();
        const elementRect = element.getBoundingClientRect();
        let pageNumber = 1;
        const writingMode = this.options.writingMode ?? 'horizontal-tb';
        const isVertical = this.isVerticalWriting(writingMode);
        if (isVertical) {
            const translatey = getTransformLength(ownerDocument.documentElement, "y");
            const top = (elementRect?.top ?? 0) + translatey;
            pageNumber = Math.floor(top / documentViewport.pageMoveLength);
            if (top % documentViewport.pageMoveLength >= 0) {
                pageNumber = pageNumber + 1;
            }
        }
        else {
            const translatex = getTransformLength(ownerDocument.documentElement, "x");
            const left = (elementRect?.left ?? 0) + translatex;
            pageNumber = Math.floor(left / documentViewport.pageMoveLength);
            if (left > documentViewport.pageWidth && left % documentViewport.pageMoveLength >= 0) {
                pageNumber = pageNumber + 1;
            }
        }
        if (pageNumber == 0)
            pageNumber = 1;

        if (!isVertical && this.options.direction == "rtl") {
            const numberOfPages = this.calcNumberOfPages();
            pageNumber = Math.max(1, numberOfPages - pageNumber + 1);
        }
        return pageNumber;
    }

    private getIframe(): HTMLIFrameElement | undefined {
        return this.doc.getContentContainer()?.ownerDocument?.defaultView?.frameElement as HTMLIFrameElement | undefined;
    }

    private getContentRootElement(): HTMLElement {
        if (this.doc.inIframe) {
            return this.doc.getContentContainer()?.ownerDocument?.documentElement;
        }
        return this.doc.getWrapperContainer();
    }

    private transformCurrentDocument(rootElement: HTMLElement, translateLegnth: number, axis: 'x' | 'y') {
        if (!axis || !rootElement)
            return;
        if (axis == "x") {
            rootElement.style.transform = "translateX(-" + parseFloat(translateLegnth.toFixed(10)) + "px)";
        }
        else {
            rootElement.style.transform = "translateY(-" + parseFloat(translateLegnth.toFixed(10)) + "px)";
        }
    }

    private isVerticalWriting(writingMode: WritingMode) {
        return writingMode == "vertical-lr" || writingMode == "vertical-rl";
    }
}
