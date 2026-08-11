import { TextFormatOptions, IFileParser, SpineFile } from "../../../kernal";
import type { Reader } from "../../../kernal/Reader";
import { getOrderedElementsIntersectingRect } from "../../../kernal/html/geometry";
import { IPdfDocument, PdfPageGeometry } from "./IPdfDocument";
import { computeUniqueId } from "../../../kernal/common/uuid";
import { BaseDocument } from "../../base/renderer/BaseDocument";
import { MultiPDFViewer } from "./MultiPdfViewer";

/** Keep in sync with PdfSvgBuilder.svgClassName */
const CUSTOM_TEXT_LAYER_CLASS = "custom-text-layer";

export class PdfDocument extends BaseDocument implements IPdfDocument {
    private readonly currentPageNumber: number;
    private readonly texts = new Map<string, string>();

    constructor(
        owner: Reader,
        private readonly pdfViewer: MultiPDFViewer,
        fileParser: IFileParser,
        wrapperContainer: HTMLElement,
        url: string,
        pageNumber: number,
    ) {
        super(
            owner,
            fileParser,
            wrapperContainer,
            new SpineFile(null, url || `${pageNumber}.pdf`, ".pdf"),
        );
        this.currentPageNumber = pageNumber;
        this.loadStatus = "success";
    }

    get pageNumber(): number {
        return this.currentPageNumber;
    }

    getPageGeometry(): PdfPageGeometry | undefined {
        const pageView = this.resolvePageView();
        if (!pageView?.viewport || !pageView.div) {
            return undefined;
        }
        return {
            rawWidth: pageView.viewport.viewBox[2],
            rawHeight: pageView.viewport.viewBox[3],
            rotation: Math.abs(pageView.viewport.rotation) % 360,
            displayWidth: pageView.width,
            displayHeight: pageView.height,
            pageRect: pageView.div.getBoundingClientRect(),
            ref: pageView.pdfPage.ref
        };
    }

    getVisibleElements(fullVisibleInWindow?: boolean): Element[] {
        if (this.loadStatus != "success") {
            return [];
        }
        const contentContainer = this.getContentContainer();
        if (!contentContainer) {
            return [];
        }

        const candidates = this.collectTextLayerElements(contentContainer);
        if (candidates.length === 0) {
            return [];
        }

        const scrollElement =
            this.owner.getRenderer()?.getScrollElement() ?? this.owner.getReaderContainer();
        if (!scrollElement) {
            return [];
        }

        const scrollRect = scrollElement.getBoundingClientRect();
        const topInset = this.owner.optionsProvider.getHeaderHeight();
        const viewport = {
            left: scrollRect.left,
            top: scrollRect.top + topInset,
            right: scrollRect.right,
            bottom: scrollRect.bottom,
        };
        if (viewport.right <= viewport.left || viewport.bottom <= viewport.top) {
            return [];
        }

        return getOrderedElementsIntersectingRect(candidates, viewport, {
            fullVisible: fullVisibleInWindow,
        });
    }

    private collectTextLayerElements(container: HTMLElement): Element[] {
        const svgTexts = container.querySelectorAll(`svg.${CUSTOM_TEXT_LAYER_CLASS} text`);
        if (svgTexts.length > 0) {
            return Array.from(svgTexts);
        }
        return Array.from(container.querySelectorAll(".textLayer span"));
    }

    private resolvePageView(): any {
        return this.pdfViewer._pages.find(x => x.id == this.pageNumber);
    }

    override async load(): Promise<void> {
        this.loadStatus = "success";
    }

    override async getText(options?: TextFormatOptions): Promise<string> {
        const key = computeUniqueId(JSON.stringify(options ?? {}));
        if (this.texts.has(key)) {
            return this.texts.get(key);
        }
        const text = await this.pdfViewer.getPageText(this.pageNumber, options);
        this.texts.set(key, text);
        return text;
    }

    override async dispose(): Promise<void> {
        this.texts.clear();
        await super.dispose();
    }
}
