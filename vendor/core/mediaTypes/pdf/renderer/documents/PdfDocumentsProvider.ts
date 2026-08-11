import { isNullOrWhiteSpace } from "../../../../kernal/common/text";
import { getElementByNameAndIndex } from "../../../../kernal/html/finder";
import { injectCssContent } from "../../../../kernal/html/injector";
import { scrollElementIntoView } from "../../../../kernal/html/style";
import { asyncDebounce, EventNames, FileLocation, IDocument, IFileParser, ILogger, Progress, SpineFile, Theme } from "../../../../kernal";
import type { Reader } from "../../../../kernal/Reader";
import { BaseDocumentsProvider } from "../../../base/renderer/BaseDocumentsProvider";
import { PdfOptions } from "../../PdfOptions";
import { IPdfFileParser } from "../../fileParser/IPdfFileParser";
import { PdfDocument } from "../PdfDocument";
import { IPdfDocument } from "../IPdfDocument";
import { PdfViewerBuilder } from "../PdfViewerBuilder";
import { PdfRendererViewport } from "../layout/PdfRendererViewport";
import type { MultiPDFViewer } from "../MultiPdfViewer";
import type { IPdfDocumentsProvider } from "./IPdfDocumentsProvider";
import * as pdfjsLib from "../../../../pdfjs/legacy/build/pdf.mjs";
import * as pdfjsViewer from "../../../../pdfjs/legacy/web/pdf_viewer.mjs";
import "../../../../pdfjs/legacy/web/pdf_viewer.css";

/**
 * PDF documents lifecycle: containers, engine load, page document collection, navigation.
 */
export class PdfDocumentsProvider extends BaseDocumentsProvider<IPdfDocument, IPdfFileParser> implements IPdfDocumentsProvider<IPdfDocument, IPdfFileParser> {
    protected logger: ILogger;
    protected isInit = false;
    protected isFirstLoad = true;
    protected readonly rendererViewport: PdfRendererViewport;
    protected readonly pdfViewer: MultiPDFViewer;
    protected readonly eventBus: pdfjsViewer.EventBus;
    private readonly linkService: pdfjsViewer.PDFLinkService;
    protected readonly findController: pdfjsViewer.PDFFindController;
    private readonly maxCanvasPixels: number;
    private pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
    private isEngineInitialized = false;
    private containerResizeObserver: ResizeObserver;
    private readonly removePageBorders: boolean;
    constructor(
        owner: Reader,
        fileParser: IFileParser,
        protected readonly readerContainer: HTMLElement,
        protected readonly options: PdfOptions,
    ) {
        super(owner, fileParser as IPdfFileParser);
        this.logger = this.owner.loggerFactory.getLogger(this.constructor.name);

        this.rendererViewport = new PdfRendererViewport(owner.getRootContainer(), readerContainer, this.options, () => this.currentPage, () => this.removePageBorders);
        const rendererContainer = this.rendererViewport.getRendererContainer();
        const pdfViewerBuilder = new PdfViewerBuilder(this.options)
        const { pdfViewer, eventBus, linkService, findController, maxCanvasPixels, removePageBorders } = pdfViewerBuilder.build(rendererContainer);
        this.pdfViewer = pdfViewer;
        this.eventBus = eventBus;
        this.linkService = linkService;
        this.findController = findController;
        this.maxCanvasPixels = maxCanvasPixels;
        this.removePageBorders = removePageBorders;
    }

    getViewerContainer(): HTMLDivElement {
        return this.rendererViewport.getViewerContainer();
    }

    getEventBus(): pdfjsViewer.EventBus {
        return this.eventBus;
    }

    getFindController(): pdfjsViewer.PDFFindController {
        return this.findController;
    }

    override getRendererContainer(): HTMLDivElement {
        return this.rendererViewport.getRendererContainer();
    }

    override getScrollElement(): HTMLDivElement {
        return this.rendererViewport.getScrollElement();
    }

    protected hasPdfDocument(): boolean {
        return !!this.pdfDocument;
    }

    /**
     * Subclasses with a progress tracker should override this.
     * Used when restoring location after container resize.
     */
    protected async getProgress(_precise?: boolean): Promise<Progress | undefined> {
        return undefined;
    }

    /**
     * Observe renderer container size and restore location / auto-scale on resize.
     */
    protected registerContainerResizeObserver() {
        if (this.containerResizeObserver) {
            return;
        }

        if (this.containerResizeObserver) {
            this.containerResizeObserver.disconnect();
            this.containerResizeObserver = undefined;
        }

        this.containerResizeObserver = new ResizeObserver(async (_entries) => {
            if (!this.owner.context) {
                return;
            }
            if (this.readerContainer.clientWidth == 0 || this.readerContainer.clientHeight == 0) {
                if (this.readerContainer["lhx_pdf_hidden"]) {
                    this.readerContainer["lhx_pdf_require_resize"] = "true";
                }
                this.readerContainer["lhx_pdf_hidden"] = "true";
                return;
            }

            if (this.readerContainer.clientWidth > 0 && this.readerContainer.clientHeight > 0) {
                if (this.readerContainer["lhx_pdf_hidden"]) {
                    //this is recover from hidden state
                    this.readerContainer["lhx_pdf_hidden"] = undefined;
                    if (!this.readerContainer["lhx_pdf_require_resize"]) {
                        return;
                    }
                    this.readerContainer["lhx_pdf_require_resize"] = undefined;
                }
            }

            this.owner.context.setUserChangedProgress(false);

            if (
                (this.pdfViewer.currentScaleValue == "auto" ||
                    this.pdfViewer.currentScaleValue == "page-fit" ||
                    this.pdfViewer.currentScaleValue == "page-width") &&
                !this.isFirstLoad
            ) {
                await this.delayOnAutoScaleResize();
            }
            this.rendererViewport.applyCssVariables();
            if (this.owner.context) {
                this.owner.events.emit(
                    EventNames.RendererContainerSizeChange,
                    this.getRendererContainer(),
                    this.owner.context.userChangedProgress,
                );
            }
        });
        //monitor the reader container size,not the renderer container size
        this.containerResizeObserver.observe(this.readerContainer);
    }

    private delayOnAutoScaleResize = asyncDebounce(async () => {
        await this.onAutoScaleResize();
    }, 100);

    private async onAutoScaleResize(): Promise<void> {
        const container = this.getRendererContainer();
        if (
            this.owner.resourceIsUnload ||
            container.clientWidth == 0 ||
            container.clientHeight == 0
        ) {
            return;
        }
        await this.resize();
    }

    protected resize = async () => {
        this.eventBus.dispatch("resize", {
            source: this.readerContainer.ownerDocument.defaultView,
        });
    };


    override async createDocument(
        documentContainer: HTMLElement,
        file: SpineFile,
        fileIndex: number,
    ): Promise<IPdfDocument> {
        // PDF pages come from pdf.js PageView; spine-based creation is unused.
        const pageNumber = fileIndex + 1;//page number start from 1
        return new PdfDocument(
            this.owner,
            this.pdfViewer,
            this.fileParser,
            documentContainer,
            file.url,
            pageNumber,
        );
    }

    private fillDocuments = () => {
        this.documentItems = [];
        const pages = this.pdfViewer._pages as pdfjsViewer.PDFPageView[];
        pages.forEach((p) => {
            const pageUrl = p["spineFile"]?.url;
            const doc = new PdfDocument(
                this.owner,
                this.pdfViewer,
                this.fileParser,
                p.div,
                pageUrl,
                p.id,
            );
            this.documentItems.push(doc);
        });
    };

    override reload = async (): Promise<void> => {
        const location = this.owner.context.currentLocation;
        if (isNullOrWhiteSpace(location?.url)) {
            return;
        }
        location.scrollBehavior = "smooth";
        await this.load(location, true);
        location.scrollBehavior = undefined;
    };

    override async load(location?: FileLocation, isReload?: boolean): Promise<void> {
        let emitLoadFinishEvent = true;
        try {
            this.owner.context.setUserChangedProgress(!isReload, location?.from);
            this.owner.context.currentLocation = location;

            if (location?.storeCurrent) {
                await this.owner.onBeforeRedirect?.(this);
            }

            if (!this.isInit) {
                this.owner.events.on(EventNames.PdfPagesInit, this.delayRedirect);
                await this.loadEngine(async () => {
                    this.fillDocuments();
                    this.isInit = true;
                    this.registerContainerResizeObserver();
                });
                this.getRendererContainer().focus();
                return;
            }

            emitLoadFinishEvent = await this.navigateToLocation(location);
        } finally {
            if (emitLoadFinishEvent) {
                this.owner.events.emit(EventNames.PdfLoadFinished, { reader: this.owner });
            }
        }
    }

    /** @returns whether PdfLoadFinished should be emitted now */
    private async navigateToLocation(location?: FileLocation): Promise<boolean> {
        if (location?.url && location.tagName && location.tagIndex != undefined) {
            const doc = this.getDocument(location.url);
            const targetElement = getElementByNameAndIndex(
                doc.getContentContainer(),
                location.tagName,
                location.tagIndex,
            );
            if (!targetElement) {
                this.owner.events.on(EventNames.PdfPageTextRendered, this.pageLoaded);
                return false;
            }
            this.gotoTargetElement(targetElement, location);
            return true;
        }

        const pageNumber = this.resolvePageNumber(location);
        if (pageNumber == null) {
            return true;
        }
        await this.gotoPageInternal(
            pageNumber,
            location?.pdfDest,
            location?.offsetTop,
            location?.ignoreOverlayHeader,
        );
        return true;
    }

    /**
     * Resolve target page from location.
     * - current in (0, 1): ratio of total pages (ceil)
     * - current >= 1: absolute page
     * - url: document index + 1
     * - otherwise: page 1
     * @returns null when url is set but document is missing (no navigation)
     */
    private resolvePageNumber(location?: FileLocation): number | null {
        if (location?.current) {
            if (location.current < 1) {
                return Math.max(1, Math.ceil(location.current * this.numberOfPages));
            }
            return location.current;
        }
        if (location?.url) {
            const doc = this.getDocument(location.url);
            if (!doc) {
                return null;
            }
            return this.getDocuments().indexOf(doc) + 1;
        }
        return 1;
    }

    private async initializeEngine(): Promise<void> {
        if (this.isEngineInitialized) {
            return;
        }

        const pdfPageCss = `.pdfViewer .canvasWrapper{position:absolute;left:0;top:0}
        .pdfViewer .page {background-color:var(${Theme.ContentBackground}) !important}`;

        injectCssContent(
            this.getRendererContainer().ownerDocument,
            pdfPageCss,
            false,
            "custom-pdf-viewer-page-css",
        );

        this.eventBus.on("pagesinit", async () => {
            if (!this.pdfViewer.currentScaleValue && this.options.scaleValue) {
                this.pdfViewer.currentScaleValue = this.options.scaleValue;
            }
        });
        this.isEngineInitialized = true;
    }

    private async loadEngine(callback?: () => Promise<void>): Promise<void> {
        await this.closeEngine();
        await this.initializeEngine();

        const entryFile = await this.fileParser.getEntryFile();
        const pdfDocument = await this.fileParser.getPdfDocument(entryFile);
        this.pdfDocument = pdfDocument;

        if (!this.fileParser.isMultiFiles) {
            this.setPdfDocument(this.pdfDocument);
            await this.pdfDocument.getPage(1);
            if (this.pdfViewer.firstPagePromise) {
                await this.pdfViewer.firstPagePromise;
            }
            if (callback) {
                await callback();
            }
            this.owner.events.emit(EventNames.PdfPagesInit, this);
            return;
        }

        const spineFiles = await this.fileParser.getSpineFiles();
        this.setPdfDocument(this.pdfDocument, false);
        if (this.pdfViewer.firstPagePromise) {
            const firstPdfPage = await this.pdfViewer.firstPagePromise;
            const firstPageView = this.pdfViewer._pages[0];
            if (firstPageView) {
                firstPageView["spineFile"] = entryFile;
            }
            if (spineFiles.length > 0) {
                const viewport = firstPdfPage.getViewport({
                    scale:
                        this.pdfViewer.currentScale *
                        pdfjsLib.PixelsPerInch.PDF_TO_CSS_UNITS,
                });
                const pageViews = this.createSpinePageViews(
                    this.getViewerContainer(),
                    spineFiles,
                    viewport,
                );
                await this.pdfViewer.setOtherPages(pageViews, this.getSinglePdfPage);
            }
        }
        if (callback) {
            await callback();
        }
        this.owner.events.emit(EventNames.PdfPagesInit, this);
    }

    /**
     * @param bindServices When true (default), also wire linkService / findController.
     *                     Multi-file loads only attach the first page to the viewer.
     */
    private setPdfDocument(
        doc: pdfjsLib.PDFDocumentProxy | null,
        bindServices = true,
    ): void {
        this.pdfViewer.setDocument(doc);
        if (!bindServices) {
            return;
        }
        if (doc) {
            this.linkService.setDocument(doc);
            this.findController.setDocument(doc);
        } else {
            this.linkService.setDocument(null, null);
            this.findController.setDocument(null);
        }
    }

    private createSpinePageViews(
        viewerContainer: HTMLDivElement,
        spineFiles: SpineFile[],
        firstPageViewport: pdfjsLib.PageViewport,
    ): pdfjsViewer.PDFPageView[] {
        const pageViews: pdfjsViewer.PDFPageView[] = [];
        for (let pageNum = 2; pageNum < spineFiles.length + 1; pageNum++) {
            const pageView = new pdfjsViewer.PDFPageView({
                container: viewerContainer,
                eventBus: this.eventBus,
                id: pageNum,
                scale: this.pdfViewer.currentScale,
                defaultViewport: firstPageViewport.clone(),
                renderingQueue: this.pdfViewer.renderingQueue,
                textLayerMode: this.options.textLayerMode == 1 ? 1 : 0,
                annotationMode: this.options.annotationMode,
                maxCanvasPixels: this.maxCanvasPixels,
            });
            pageView["spineFile"] = spineFiles[pageNum - 1];
            pageViews.push(pageView);
        }
        return pageViews;
    }

    private getSinglePdfPage = async (spineFile: SpineFile, pageNumber: number) => {
        const doc = await this.fileParser.getPdfDocument(spineFile);
        const page = await doc.getPage(pageNumber);
        return { doc, page };
    };

    private async closeEngine(): Promise<void> {
        if (this.pdfDocument) {
            this.pdfDocument = null;
            this.setPdfDocument(null);
        }
    }

    private delayRedirect = async () => {
        const location = this.owner.context.currentLocation;
        await this.redirect(location);
        this.isFirstLoad = false;
        this.owner.events.off(EventNames.PdfPagesInit, this.delayRedirect);
    };

    private redirect = async (location: FileLocation) => {
        if (!location?.current) {
            return;
        }
        // First-load progress restore historically used floor (unlike subsequent load's ceil).
        const pageNumber =
            location.current < 1
                ? Math.floor(location.current * this.numberOfPages)
                : location.current;
        await this.gotoPageInternal(
            pageNumber,
            location.pdfDest,
            location.offsetTop,
            location?.ignoreOverlayHeader,
        );
    };

    private pageLoaded = (doc: IDocument, _pageNumber: number) => {
        const location = this.owner.context.currentLocation;
        const targetElement = getElementByNameAndIndex(
            doc.getContentContainer(),
            location.tagName,
            location.tagIndex,
        );
        this.gotoTargetElement(targetElement, location);
        this.owner.events.off(EventNames.PdfPageTextRendered, this.pageLoaded);
        this.owner.events.emit(EventNames.PdfLoadFinished, { reader: this.owner });
    };

    private gotoTargetElement = (targetElement: Element, location?: FileLocation) => {
        if (!targetElement) {
            return;
        }
        scrollElementIntoView(
            targetElement,
            undefined,
            undefined,
            this.owner.getRootContainer()?.ownerDocument,
        );
        let scrollTopOffset = 0;
        if (location?.offsetTop) {
            scrollTopOffset += location.offsetTop;
        }
        if (scrollTopOffset <= 0) {
            return;
        }
        const scrollElement = this.getScrollElement();
        const toBottomDistance =
            scrollElement.scrollHeight -
            scrollElement.scrollTop -
            scrollElement.clientHeight;
        if (toBottomDistance > 0) {
            scrollElement.scrollTo(0, scrollElement.scrollTop - scrollTopOffset);
        }
    };

    get numberOfPages() {
        return this.pdfViewer.pagesCount;
    }

    get currentPage() {
        return this.pdfViewer?.currentPageNumber;
    }

    set currentPage(value: number) {
        this.setCurrentPageNumber(value);
    }

    setCurrentPage(pageNumber: number, scroll = true): void {
        if (!scroll) {
            // pdf.js public setter always resets the page into view; bypass that.
            (this.pdfViewer as unknown as {
                _setCurrentPageNumber?: (val: number, resetCurrentPageView?: boolean) => boolean;
            })._setCurrentPageNumber?.(pageNumber, false);
            return;
        }
        this.setCurrentPageNumber(pageNumber);
    }

    get isSpreadMode(): boolean {
        return this.pdfViewer?.spreadMode !== pdfjsViewer.SpreadMode.NONE;
    }

    private async scrollToPage(
        pageNumber: number,
        dest?: string,
        offsetTop?: number,
        ignoreOverlayHeader?: boolean,
    ) {
        if (dest) {
            const destArray = JSON.parse(dest);
            this.pdfViewer.scrollPageIntoView({
                pageNumber,
                destArray,
                allowNegativeOffset: true,
                ignoreDestinationZoom: true,
            });
            if (
                this.getRendererContainer().scrollHeight >
                this.getRendererContainer().clientHeight + 10
            ) {
                let scrollTopOffset = 0;
                if (!ignoreOverlayHeader) {
                    scrollTopOffset += this.owner.options.redirectPositionOffset;
                }
                if (offsetTop) {
                    scrollTopOffset += offsetTop;
                }
                if (scrollTopOffset > 0) {
                    const scrollElement = this.getScrollElement();
                    scrollElement.scrollTo(0, scrollElement.scrollTop - scrollTopOffset);
                }
            }
        } else {
            this.setCurrentPageNumber(pageNumber);
        }
    }

    private setCurrentPageNumber = (pageNumber: number) => {
        const pdfViewer = this.pdfViewer;
        const page = pdfViewer.currentPageNumber;
        pdfViewer.currentPageNumber = pageNumber;
        const currentScaleValue = pdfViewer.currentScaleValue;
        if (
            this.options.resetScaleAfterPageChanged &&
            page != pageNumber &&
            (currentScaleValue == "auto" ||
                currentScaleValue == "page-fit" ||
                currentScaleValue == "page-width")
        ) {
            if (!pdfViewer.hasEqualPageSizes) {
                pdfViewer.rescrollIntoView(pageNumber);
            }
        }
    };

    private async gotoPageInternal(
        pageNumber: number,
        dest?: string,
        offsetTop?: number,
        ignoreOverlayHeader?: boolean,
    ): Promise<boolean> {
        const locale = this.owner.locale;
        if (pageNumber <= 0) {
            this.owner.notifier.info(
                locale.getText("navigotor_alreadyisfirstpage", "Already at the first page"),
            );
            return false;
        }

        if (pageNumber > this.numberOfPages) {
            this.owner.notifier.info(
                locale.getText("navigotor_alreadyislastpage", "Already at the last page"),
            );
            return false;
        }

        if (dest?.indexOf("Fit") >= 0) {
            await this.scrollToPage(pageNumber, null, offsetTop, ignoreOverlayHeader);
        } else {
            await this.scrollToPage(pageNumber, dest, offsetTop, ignoreOverlayHeader);
        }
        return true;
    }

    override getLoadedDocuments(): IPdfDocument[] {
        const pages = Array.from(this.pdfViewer.getCachedPageViews().values()).map((x) => x.id);
        return this.documentItems.filter((x) => pages.includes(x.pageNumber));
    }

    override getVisibleDocuments(): IPdfDocument[] {
        const visiblePages = this.pdfViewer._getVisiblePages() as {
            views: { id: number }[];
        };
        const pages = Array.from(visiblePages.views.map((x) => x.id));
        return this.documentItems.filter((x) => pages.includes(x.pageNumber));
    }

    getPageViews(): pdfjsViewer.PDFPageView[] {
        return this.pdfViewer._pages as pdfjsViewer.PDFPageView[];
    }

    getPageView(pageNumber: number): pdfjsViewer.PDFPageView | undefined {
        if (pageNumber < 1) {
            return undefined;
        }
        return this.pdfViewer.getPageView(pageNumber - 1) as pdfjsViewer.PDFPageView | undefined;
    }

    async getPdfPage(pageNumber: number): Promise<pdfjsLib.PDFPageProxy | undefined> {
        if (!this.pdfDocument || pageNumber < 1 || pageNumber > this.numberOfPages) {
            return undefined;
        }
        const fromView = this.getPageView(pageNumber)?.pdfPage as pdfjsLib.PDFPageProxy | undefined;
        if (fromView) {
            return fromView;
        }
        return this.pdfDocument.getPage(pageNumber);
    }

    override async dispose(): Promise<void> {
        this.owner.events.off(EventNames.PdfPagesInit, this.delayRedirect);
        this.owner.events.off(EventNames.PdfPageTextRendered, this.pageLoaded);
        this.containerResizeObserver?.disconnect();
        this.containerResizeObserver = undefined;
        await this.closeEngine();
        await this.pdfViewer.dispose();
        await super.dispose();
    }
}
