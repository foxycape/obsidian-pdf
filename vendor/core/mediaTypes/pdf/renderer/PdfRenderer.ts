import "../../../pdfjs/legacy/build/pdf.mjs"
import { getRandomId } from "../../../kernal/common/uuid";
import { watchScroll } from "../../../kernal/html/events";
import type { Reader } from "../../../kernal/Reader";
import { EventNames, IFileParser, Theme, INavPointProvider, INavPointNavigator, ICoreNavigator, IPagingNavigator, isOptionKey, Progress, asyncDebounce } from "../../../kernal";
import { PdfOptions } from "../PdfOptions";
import { IPdfRenderer } from "./IPdfRenderer";
import { PdfNavPointProvider } from "./PdfNavPointProvider";
import { PdfNavPointNavigator } from "./PdfNavPointNavigator";
import { PdfCoreNavigator } from "./PdfCoreNavigator";
import { PdfPagingNavigator } from "./PdfPagingNavigator";
import type { IPdfRendererLayout } from "./layout/IPdfRendererLayout";
import { PdfRendererLayout } from "./layout/PdfRendererLayout";
import { PdfThemeApplier } from "./style/PdfThemeApplier";
import { PdfProgressTracker } from "./progress/PdfProgressTracker";
import type { IPdfProgressTracker } from "./progress/IPdfProgressTracker";
import { PdfDestinationBuilder } from "./location/PdfDestinationBuilder";
import { PdfDocumentEvents } from "./input/PdfDocumentEvents";
import { PdfViewerEvents } from "./input/PdfViewerEvents";
import { PdfZoomInputController } from "./input/PdfZoomInputController";
import { PdfKeyboardController } from "./input/PdfKeyboardController";
import { PdfDocumentsProvider } from "./documents/PdfDocumentsProvider";
import { IPdfScalable } from "./zoom/IPdfScalable";
import { PdfScalable } from "./zoom/PdfScalable";
import { IPdfDestinationBuilder } from "./location/IPdfDestinationBuilder";
import { IPdfThemeApplier } from "./style/IPdfThemeApplier";
import { IPdfSvgBuilder } from "./IPdfSvgBuilder";

/**
 * PDF renderer orchestrator — mirrors HtmlRenderer: compose domain modules over PdfDocumentsProvider.
 */
export class PdfRenderer extends PdfDocumentsProvider implements IPdfRenderer {
    private currentInstanceId: string;

    readonly navPointProvider: INavPointProvider;
    readonly navigator: ICoreNavigator;
    readonly navPointNavigator: INavPointNavigator;
    readonly pagingNavigator: IPagingNavigator;
    readonly layout: IPdfRendererLayout;
    readonly progressTracker: IPdfProgressTracker;
    readonly scalable: IPdfScalable;

    private readonly themeApplier: IPdfThemeApplier;
    private readonly destinationBuilder: IPdfDestinationBuilder;
    private readonly documentEventBridge: PdfDocumentEvents;
    private readonly viewerEvents: PdfViewerEvents;
    private readonly zoomInputController: PdfZoomInputController;
    private readonly keyboardController: PdfKeyboardController;
    private svgBuilder?: IPdfSvgBuilder;

    constructor(owner: Reader, fileParser: IFileParser, readerContainer: HTMLElement, options: PdfOptions) {
        super(owner, fileParser, readerContainer, options);

        this.layout = new PdfRendererLayout(this.pdfViewer, this.owner.events);
        this.scalable = new PdfScalable(this.pdfViewer, this.options);
        this.themeApplier = new PdfThemeApplier(this.readerContainer);
        this.destinationBuilder = new PdfDestinationBuilder(this);
        this.progressTracker = new PdfProgressTracker(this, this.pdfViewer, this.destinationBuilder);
        this.documentEventBridge = new PdfDocumentEvents(this.pdfViewer, this);
        this.viewerEvents = new PdfViewerEvents(this.owner.events, this.eventBus, this, this.pdfViewer);
        const rendererContainer = this.getRendererContainer();
        this.zoomInputController = new PdfZoomInputController(this.pdfViewer, rendererContainer);
        this.keyboardController = new PdfKeyboardController(this.pdfViewer, rendererContainer);
        this.keyboardController.setFindRequestHandler(() => {
            this.owner.events.emit(EventNames.RequestOpenFind);
        });

        this.navPointProvider = new PdfNavPointProvider(this);
        this.navigator = new PdfCoreNavigator(this);
        this.navPointNavigator = new PdfNavPointNavigator(this, this.navigator, this.navPointProvider);
        this.pagingNavigator = new PdfPagingNavigator(this.owner.locale, this.owner.notifier, this);

        this.bindEvents();

        watchScroll(
            this.getScrollElement(),
            this.owner.options.calcScrollDirection,
            async (state, e) => {
                this.owner.events.emit(EventNames.ReaderDebounceScroll, state, e);
            },
            (e: Event) => {
                if (this.owner.onProgressChangeGuard) {
                    if (this.owner.context?.progress?.current) {
                        const allowContinue = this.owner.onProgressChangeGuard(
                            this.owner.context.progress.current,
                        );
                        if (!allowContinue) {
                            e.preventDefault();
                        }
                    }
                }
                this.owner.events.emit(EventNames.ReaderOriginalScroll, e);
            },
        );
    }
    get id() {
        if (!this.currentInstanceId) {
            this.currentInstanceId = getRandomId(true);
        }
        return this.currentInstanceId;
    }

    private isRendererReady = false;

    override async load(location?: Parameters<PdfDocumentsProvider["load"]>[0], isReload?: boolean): Promise<void> {
        if (!this.isRendererReady) {
            await this.ensureRendererReady();
            if (this.options.textLayerMode === 2) {
                const { PdfSvgBuilder } = await import("./PdfSvgBuilder");
                this.svgBuilder = new PdfSvgBuilder(this, this.options);
                await this.svgBuilder.initialize();
            }

            this.isRendererReady = true;
        }
        await super.load(location, isReload);
    }

    private async ensureRendererReady(): Promise<void> {
        // Must run before pages render: Reader injects `body *{box-sizing:border-box}`,
        // which shrinks .page content by --page-border (9px*2) when removePageBorders=false,
        // making canvasWrapper smaller than the canvas bitmap and causing blur.
        const themeProvider = await this.owner.services.get("themeProvider");
        let theme: Theme;
        if (themeProvider) {
            theme = themeProvider.getCurrentTheme();
            this.themeApplier.applyTheme(theme);
        }
        else {
            theme = new Theme();
        }
        this.themeApplier.applyTheme(theme);
        this.rendererViewport.applyCssVariables();
    }

    private bindEvents() {
        this.owner.events.on(EventNames.OptionsChange, this.onOptionsChange);
        this.owner.events.on(EventNames.PdfScaleChanging, this.onScaleChanging);
        this.documentEventBridge.bind();
        this.viewerEvents.bind();
        this.zoomInputController.bind();
        this.keyboardController.bind();
    }

    private unbindEvents() {
        this.owner.events.off(EventNames.OptionsChange, this.onOptionsChange);
        this.owner.events.off(EventNames.PdfScaleChanging, this.onScaleChanging);
        this.documentEventBridge.unbind();
        this.viewerEvents.unbind();
        this.zoomInputController.unbind();
        this.keyboardController.unbind();
    }

    private onScaleChanging = async (_scale: number, _currentScaleValue: string) => {
        await this.delayApplyCssVariables();
    };

    private delayApplyCssVariables = asyncDebounce(async () => {
        this.rendererViewport.applyCssVariables();
    }, 200);

    private onOptionsChange = async (path: string) => {
        if (isOptionKey(path)) {
            this.rendererViewport.applyCssVariables();
        }
    };

    buildDest(pageNumber: number, options?: "current" | { x: number; y: number }): string {
        return this.destinationBuilder.buildDest(pageNumber, options);
    }

    override async getProgress(precise?: boolean): Promise<Progress | undefined> {
        return this.progressTracker.getProgress(precise);
    }

    async applyTheme(theme: Theme): Promise<void> {
        this.themeApplier.applyTheme(theme);
    }

    override async dispose(): Promise<void> {
        this.unbindEvents();
        this.currentInstanceId = null;
        await this.svgBuilder?.dispose();
        await this.progressTracker.dispose();
        await this.pagingNavigator.dispose();
        await this.navPointProvider?.dispose();
        await super.dispose();
    }
}
