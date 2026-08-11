import {
    EventNames,
    IEventEmitter,
    PageChangeOptions,
} from "../../../../kernal";
import type { MultiPDFViewer } from "../MultiPdfViewer";
import * as pdfjsViewer from "../../../../pdfjs/legacy/web/pdf_viewer.mjs";
import { IPdfRenderer } from "../IPdfRenderer";

/**
 * Bridges pdf.js EventBus events to reader IEventEmitter (and related side effects).
 */
export class PdfViewerEvents {

    constructor(private readonly events: IEventEmitter,
        private readonly eventBus: pdfjsViewer.EventBus,
        private readonly renderer: IPdfRenderer,
        private readonly pdfViewer: MultiPDFViewer) {
    }

    bind() {

        this.eventBus.on("pagesloaded", this.onPagesLoaded);
        this.eventBus.on("resize", this.onResize);
        this.eventBus.on("pagerender", this.onPageRender);
        this.eventBus.on("pagerendered", this.onPageRendered);
        this.eventBus.on("textlayerrendered", this.onTextLayerRendered);
        this.eventBus.on("pagechanging", this.onPageChanging);
        this.eventBus.on("scalechanging", this.onScaleChanging);
        this.eventBus.on("scalechanged", this.onScaleChanged);
        this.eventBus.on("updateviewarea", this.onUpdateViewArea);
    }

    unbind() {
        this.eventBus.off("pagesloaded", this.onPagesLoaded);
        this.eventBus.off("resize", this.onResize);
        this.eventBus.off("pagerender", this.onPageRender);
        this.eventBus.off("pagerendered", this.onPageRendered);
        this.eventBus.off("textlayerrendered", this.onTextLayerRendered);
        this.eventBus.off("pagechanging", this.onPageChanging);
        this.eventBus.off("scalechanging", this.onScaleChanging);
        this.eventBus.off("scalechanged", this.onScaleChanged);
        this.eventBus.off("updateviewarea", this.onUpdateViewArea);
    }

    private onPagesLoaded = async () => {
        this.events.emit(EventNames.PdfPagesLoaded, this.pdfViewer);
    };

    private onResize = async () => {
        const currentScaleValue = this.pdfViewer.currentScaleValue;
        if (
            currentScaleValue === "auto" ||
            currentScaleValue === "page-fit" ||
            currentScaleValue === "page-width"
        ) {
            await this.renderer.scalable.scaleTo(currentScaleValue);
        }
        this.pdfViewer.update();
        this.events.emit(
            EventNames.RendererContainerSizeChange,
            this.renderer.getRendererContainer(),
            this.renderer.owner.context.userChangedProgress,
        );
    };

    private onPageRender = async ({ source }) => {
        const pageView = source as pdfjsViewer.PDFPageView;
        this.events.emit(EventNames.PdfPageRender, pageView);
    };

    private onPageChanging = async ({ pageNumber, previous }) => {
        const direction = pageNumber > previous ? "next" : "previous";
        const doc = this.renderer.getDocument((pageNumber - 1).toString());
        const pageChangeOptions = new PageChangeOptions();
        pageChangeOptions.doc = doc;
        pageChangeOptions.pageNumber = pageNumber;
        pageChangeOptions.direction = direction;
        this.events.emit(EventNames.PageChange, pageChangeOptions);
        this.renderer.progressTracker.updateFromPageChange();
    };

    private onPageRendered = async ({ source, pageNumber }) => {
        this.events.emit(EventNames.PdfPageRendered, {
            pdfViewer: this.pdfViewer,
            pageView: source,
            pageNumber,
        });
        const doc = this.renderer.getDocument((pageNumber - 1).toString());
        if (doc) {
            this.events.emit(EventNames.DocumentLoad, doc);
        }
    };

    /** Span text layer finished (textLayerMode === 1). Mirrors SvgBuilder's PdfPageTextRendered. */
    private onTextLayerRendered = ({ pageNumber }: { pageNumber?: number }) => {
        if (!pageNumber) {
            return;
        }
        const doc = this.renderer.getDocument((pageNumber - 1).toString());
        this.events.emit(EventNames.PdfPageTextRendered, doc, pageNumber);
    };

    private onScaleChanging = async ({ scale }) => {
        this.events.emit(
            EventNames.PdfScaleChanging,
            scale,
            this.pdfViewer.currentScaleValue,
        );
    };

    private onScaleChanged = async (evt: { value: string }) => {
        await this.renderer.scalable.scaleTo(evt.value);
        this.events.emit("scalechanged", evt.value);
    };

    private onUpdateViewArea = ({ location }) => {
        this.events.emit(EventNames.PdfUpdateViewArea, location);
    };
}
