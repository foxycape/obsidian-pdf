import { getRandomId } from "../../../kernal/common/uuid";
import { EventNames, FileLocation, ICoreNavigator, IFileParser, isOptionKey, IPagingNavigator, WritingMode, IStyleProvider, INavPointNavigator, INavPointProvider, Theme, Direction } from "../../../kernal";
import type { Reader } from "../../../kernal/Reader";
import { watchScroll } from "../../../kernal/html/events";
import { isHtmlOptionKey } from "../HtmlOptions";
import { HtmlCoreNavigator } from "./navigator/HtmlCoreNavigator";
import { HtmlPagingNavigator } from "./navigator/HtmlPagingNavigator";
import { HtmlNavPointNavigator } from "./navigator/HtmlNavPointNavigator";
import { HtmlNavPointProvider } from "./navigator/HtmlNavPointProvider";
import { IHtmlRenderer } from "./IHtmlRenderer";
import { HtmlProgressTracker } from "./progress/HtmlProgressTracker";
import { HtmlDocumentsProvider } from "./documents/HtmlDocumentsProvider";
import { HtmlOptions } from "../HtmlOptions";
import { IHtmlProgressTracker } from "./progress/IHtmlIProgressTracker";
import { IHtmlRendererLayout } from "./layout/IHtmlRendererLayout";
import { HtmlRendererLayout } from "./layout/HtmlRendererLayout";
import { HtmlStyleProvider } from "./style/HtmlStyleProvider";
import { IHtmlDocument } from "./IHtmlDocument";
import { HtmlThemeApplier } from "./style/HtmlThemeApplier";
import { HtmlDocumentsResizeObserver } from "./documents/HtmlDocumentsResizeObserver";
import { HtmlContentProcessor } from "./html/HtmlContentProcessor";
import { IHtmlContentProcessor } from "./html/IHtmlContentProcessor";
import { IHtmlThemeApplier } from "./style/IHtmlThemeApplier";
import { HtmlImageLoader } from "./image/HtmlImageLoader";
import { HtmlImageObserver } from "./image/HtmlImageObserver";
import { IHtmlImageLoader } from "./image/IHtmlImageLoader";

export class HtmlRenderer extends HtmlDocumentsProvider implements IHtmlRenderer {
    readonly progressTracker: IHtmlProgressTracker;
    readonly navPointProvider: INavPointProvider;
    readonly navigator: ICoreNavigator;
    readonly navPointNavigator: INavPointNavigator;
    readonly pagingNavigator: IPagingNavigator;
    readonly styleProvider: IStyleProvider;
    private isInitRenderer: boolean = false;
    private readonly rendererLayout: IHtmlRendererLayout;
    private currentInstanceId: string;
    private readonly themeApplier: IHtmlThemeApplier;
    private readonly documentsResizeObserver: HtmlDocumentsResizeObserver;  
    private readonly contentProcessor: IHtmlContentProcessor;
    private readonly imageLoader: IHtmlImageLoader;
    private readonly imageObserver: HtmlImageObserver;
    private scrollWatchState?: { _eventHandler: (e: Event) => void };

    constructor(owner: Reader, fileParser: IFileParser, readerContainer: HTMLElement, htmlOptions: HtmlOptions) {
        super(owner, fileParser, readerContainer, htmlOptions);

        this.progressTracker = new HtmlProgressTracker(owner, this, htmlOptions);
        this.rendererLayout = new HtmlRendererLayout(owner, this, this.rendererViewport, this.progressTracker, htmlOptions);
        this.navPointProvider = new HtmlNavPointProvider(this, htmlOptions);
        this.navigator = new HtmlCoreNavigator(this, htmlOptions);
        this.navPointNavigator = new HtmlNavPointNavigator(owner.locale, owner.notifier, this, this.navigator, this.navPointProvider);
        this.pagingNavigator = new HtmlPagingNavigator(this, this.navigator, htmlOptions);
        this.styleProvider = new HtmlStyleProvider(this);
        this.currentInstanceId = getRandomId(true);
        this.themeApplier = new HtmlThemeApplier(this);
        this.documentsResizeObserver = new HtmlDocumentsResizeObserver(this, this.rendererViewport, this.progressTracker, this.rendererLayout);
        this.contentProcessor = new HtmlContentProcessor(fileParser);
        this.imageLoader = new HtmlImageLoader(this, this.rendererViewport, htmlOptions);
        this.imageObserver = new HtmlImageObserver(this, htmlOptions);
        this.bindEvents();
        this.bindScrollWatch();
        this.injectProcessHandlers();
    }
    get id(): string {
        return this.currentInstanceId;
    }

    private injectProcessHandlers = () => {
        this.addDocumentPreprocess(this.preprocessHandler);
    }
    private async resolveCurrentTheme(): Promise<Theme | undefined> {
        const themeProvider = await this.owner.services.get("themeProvider");
        return themeProvider?.getCurrentTheme() ?? new Theme();
    }
    protected preprocessHandler = async (doc: IHtmlDocument) => {
        await this.contentProcessor.preprocess(doc);
        await this.styleProvider.injectStyles(doc);
        const theme = await this.resolveCurrentTheme();
        if(theme){
            await this.themeApplier.applyToDocument(doc, theme);
        }
        await this.rendererLayout.applyDocStyles(doc);
        await this.imageLoader.preprocessImages(doc);
    };

    protected bindEvents() {
        this.owner.events.on(EventNames.OptionsChange, this.onOptionsChange);
        this.owner.events.on(EventNames.PageChange, this.onPageChange);
    }

    protected unbindEvents() {
        this.owner.events.off(EventNames.OptionsChange, this.onOptionsChange);
        this.owner.events.off(EventNames.PageChange, this.onPageChange);
    }

    private bindScrollWatch() {
        const scrollElement = this.getScrollElement();
        if (!scrollElement) {
            return;
        }
        this.scrollWatchState = watchScroll(
            scrollElement,
            this.owner.options.calcScrollDirection,
            async (state, e) => {
                this.owner.events.emit(EventNames.ReaderDebounceScroll, state, e);
                this.progressTracker.notifyProgressChange();
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

    private onPageChange = async () => {
        this.progressTracker.notifyProgressChange();
    };

    private onOptionsChange = async (path: string) => {
        const rendererContainer = this.getRendererContainer();
        if (!rendererContainer || !rendererContainer.ownerDocument.defaultView)
            return;
        if (isOptionKey(path) || isHtmlOptionKey(path)) {

            // These variables cause page width changes, so we need to record position information in advance
            const requireReload = isHtmlOptionKey(path);

            if (requireReload) {
                if (!this.owner.context.currentLocation?.precise) {
                    const progress = await this.progressTracker.getProgress(true)
                    if (progress) {
                        this.owner.context.currentLocation = progress.location;
                    }
                }
                this.owner.context.setUserChangedProgress(false)
            }
            this.rendererViewport.applyCssVariables();
            if (requireReload) {
                if (!this.owner.context.userChangedProgress) {
                    await this.reload();
                }
            }
        }
    }
    override async load(location?: FileLocation, isReload?: boolean): Promise<void> {
        if (!location) {
            const progress = this.owner.context.progress;
            location = progress?.location;
        }

        // IntersectionObserver must exist before DocumentLoad → observe()
        if (!this.isInitRenderer) {
            this.isInitRenderer = true;
            this.documentsResizeObserver.register();
            this.imageObserver.register();
        }

        await super.load(location, isReload);
    }

    getFileParser(): IFileParser {
        return this.fileParser;
    }

    get writingMode(): WritingMode {
        return this.htmlOptions.writingMode ?? 'horizontal-tb';
    }

    get direction(): Direction {
        return this.htmlOptions.direction ?? 'ltr';
    }

    get layout(): IHtmlRendererLayout {
        return this.rendererLayout;
    }

    async applyTheme(theme: Theme): Promise<void> {
        await this.themeApplier.applyTheme(theme);
    }

    override async dispose(): Promise<void> {
        this.unbindEvents();
        const scrollElement = this.getScrollElement();
        if (scrollElement && this.scrollWatchState?._eventHandler) {
            scrollElement.removeEventListener("scroll", this.scrollWatchState._eventHandler, true);
            this.scrollWatchState = undefined;
        }
        await this.progressTracker.dispose();
        await this.imageObserver.dispose();
        await this.imageLoader.dispose();
        await super.dispose();
        await this.styleProvider?.dispose();
        await this.navPointProvider?.dispose()
        await this.pagingNavigator?.dispose()
        await this.documentsResizeObserver.dispose();
        await this.contentProcessor.dispose();
    }
}
