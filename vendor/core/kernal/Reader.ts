import { deepClone } from "./common/object";
import { getRandomId } from "./common/uuid";
import { BrowserCapabilities } from "./web/BrowserCapabilities";
import { EventNames } from "./EventNames";
import { CoreServices, FileLoader } from "./FileLoader";
import { createElement, injectCssContent } from "./html/injector";
import { ILoading } from "./services/loading/ILoading";
import { INotifier } from "./services/notifier/INotifier";
import { ServiceCollection, ServiceMap } from "./services/ServiceCollection";
import { IRenderer } from "./IRenderer";
import { ILogger } from "./logger/ILogger";
import { OpenOptions } from "./OpenOptions";
import { isOptionKey, Options } from "./Options";
import { PluginManager } from "./plugins/PluginManager";
import { FileLoadResult } from "./pipelines/FileLoadPipeline";
import { GotoPercentegeOptions } from "./navigator/INavigator";
import { FileLocation, Progress } from "./progress/Progress";
import { Theme } from "./Theme";
import { ThemeCssKeys } from "./Theme";
import { toCssVariableName } from "./common/naming";
import { OptionsProvider } from "./OptionsProvider";
import type { LifecycleHooks } from "./LifecycleHooks";
import { IFileParser } from "./IFileParser";
import { IDocumentsProvider } from "./IDocumentsProvider";
import { IReadingProgressStore } from "./progress/IReadingProgressStore";
export class Reader implements LifecycleHooks {
    readonly version: string;
    readonly fileLoader: FileLoader;

    private container: HTMLElement;
    private renderer?: IRenderer;

    /**
     * The reader wrapper
     */
    private readerWrapper: HTMLElement;

    /**The reader container*/
    private readerContainer: HTMLElement;
    private currentIsLoaded: boolean = false;
    private currentIsDidposed: boolean = false;
    private currentIsCancelled: boolean = false;

    readonly pluginManager: PluginManager;
    readonly options: Options;
    private readonly logger: ILogger;

    private currentNotifier: INotifier;
    private currentLoading: ILoading;
    /**Start load time */
    private startLoadTime: Date;
    private loadFail?: boolean;
    private abortController: AbortController;
    private rootContainer: HTMLElement;
    private isInIframe: boolean = false;
    readonly optionsProvider: OptionsProvider;
    private readingProgressStore: IReadingProgressStore;

    onInitialize?: (extension: string) => Promise<void>;
    onDisposing?: () => Promise<void>;
    onDisposed?: () => Promise<void>;
    onOptionsParse?: (options: Options) => Promise<void>;
    onContainerCreated?: () => Promise<void>;
    onFileParsed?: (fileParser: IFileParser) => Promise<void>;
    onRenderer?: (renderer: IRenderer) => Promise<void>;
    onRenderered?: (renderer: IRenderer) => Promise<void>;
    onRenderingFileInject?: (extension: string, data: string, url?: string) => Promise<string>;
    onProgressChangeGuard?: (progress: number) => boolean;
    onBeforeRedirect?: (documentsProvider: IDocumentsProvider) => Promise<void>;

    constructor(options: Options, services?: CoreServices) {
        this.fileLoader = new FileLoader(options, services, this);
        this.fileLoader.services.asReaderServices().registerUiServices();
        this.options = this.fileLoader.options;
        this.version = this.fileLoader.version;
        this.logger = this.fileLoader.loggerFactory.getLogger(this.constructor.name);
        this.pluginManager = new PluginManager(this, this.fileLoader.loggerFactory, this.services, this.version);
        this.optionsProvider = new OptionsProvider(this.events, this.options);
        this.events.on(EventNames.OptionsChange, (path: string) => {
            if (!this.rootContainer) {
                return;
            }
            if (isOptionKey(path)) {
                this.optionsProvider.applyCssVariables(this.rootContainer);
            }
        });
    }

    get id(): string {
        return this.fileLoader.id;
    }

    /** Full reader services (core + UI). Same instance as {@link FileLoader.services}. */
    get services(): ServiceCollection<ServiceMap> {
        return this.fileLoader.services.asReaderServices();
    }

    get platform() {
        return this.fileLoader.platform;
    }

    get environment() {
        return this.fileLoader.environment;
    }

    get device() {
        return this.fileLoader.device;
    }

    get loggerFactory() {
        return this.fileLoader.loggerFactory;
    }

    get events() {
        return this.fileLoader.events;
    }

    get readerInfo() {
        return this.fileLoader.readerInfo;
    }

    get mediaTypeRegistry() {
        return this.fileLoader.mediaTypeRegistry;
    }

    get locale() {
        return this.fileLoader.locale;
    }

    /**Whether the reader is loaded */
    get loaded() {
        return this.currentIsLoaded;
    }

    /**Whether the reader is disposed */
    get disposed() {
        return this.currentIsDidposed;
    }

    get cancelled() {
        return this.currentIsCancelled || this.fileLoader.cancelled;
    }

    get notifier() {
        return this.currentNotifier;
    }

    get loading() {
        return this.currentLoading;
    }

    /**
    * reload the reader
    * @returns
    */
    async reload() {
        if (!this.container) {
            return;
        }
        const url = this.url;
        const container = this.container;
        const rootContainer = this.rootContainer;
        const openOptions = deepClone(this.openOptions);
        await this.clear();
        await this.open(url, container, rootContainer, openOptions);
    }

    /**
     * open
     * @param url string | ArrayBuffer | FilePackage | Blob | FileSystemFileHandle
     * @param container the container to load the reader into
     * @param rootContainer Root container that may include the reader and other UI such as interactive menus.
     * @param openOptions ResourceOpenOptions
     * @returns
     */
    async open(url: any, container: HTMLElement, rootContainer: HTMLElement, openOptions?: OpenOptions): Promise<void> {
        if (this.currentIsDidposed) {
            throw new Error("reader is disposed.");
        }
        if (container == null) {
            throw new Error("container is required. Use FileLoader for headless parse-only scenarios.");
        }

        this.fileLoader.inputFormatter.guardUrl(url);
        if (this.currentIsLoaded) {
            await this.clear();
        }

        this.currentIsDidposed = false;
        this.loadFail = undefined;
        this.currentIsCancelled = false;
        this.container = container;
        this.rootContainer = rootContainer;
        this.startLoadTime = new Date();
        this.events.emit(EventNames.StartLoadResource, { reader: this, startLoadTime: this.startLoadTime });

        this.readerWrapper = this.fileLoader.inputFormatter.formatReaderWrapper(container);
        if (!this.readerWrapper) {
            throw new Error("container is invalid.");
        }
        if (!this.rootContainer) {
            this.rootContainer = this.readerWrapper;
        }
        this.optionsProvider.applyCssVariables(this.rootContainer);
        const theme=await this.getTheme(this.options.themeName);
        await this.applyGlobalTheme(theme);
        this.currentNotifier = await this.services.get("notifier", false);
        this.currentLoading = await this.services.get("loading", false);
        this.readerWrapper.innerHTML = "";
        await this.loading?.initialize(this.readerWrapper,{
            backgroundColor: `var(${Theme.ReaderBackground})`,
            textColor: `var(${Theme.TextMutedColor})`,
            iconColor: `var(${Theme.TextAccentColor})`,
        });
        await this.loading?.show();

        try {
            await this.fileLoader.getFileParser()?.dispose();

            const result = await this.fileLoader.load(url, openOptions, {
                measureFilePercentage: true,
                prepareContext: async ({ extension }) => {
                    this.isInIframe = false;
                    await this.createReaderContainer(extension);
                    return {
                        rootContainer: this.rootContainer,
                        readerContainer: this.readerContainer,
                        readerWrapper: this.readerWrapper,
                    };
                },
                afterParserReady: async () => {
                    await this.loading?.show();
                },
                isCancelled: () => this.currentIsCancelled,
            });

            this.abortController = result.abortController;
            await this.mountRenderer(result);
        }
        catch (e) {
            this.loadFail = true;
            throw e;
        } finally {
            this.currentIsLoaded = true;
            await this.loading?.hide();
            if (this.readerWrapper) {
                this.readerWrapper.style.removeProperty("background");
                const readerWrapperBackground = this.readerWrapper.getAttribute("data-reader-wrapper-bg");
                if (readerWrapperBackground) {
                    this.readerWrapper.style.setProperty("background", readerWrapperBackground);
                }
            }
            if (this.abortController) {
                this.abortController = null;
            }
            if (!this.loadFail) {
                this.events.emit(EventNames.ResourceLoad, { reader: this, startLoadTime: this.startLoadTime });
            }
        }
    }

    private async createReaderContainer(extension: string): Promise<void> {
        const requireInIframeExtensions = this.options.iframeRequiredExtensions;
        let readerDocument: Document;

        if (!requireInIframeExtensions.includes(extension) || this.readerWrapper instanceof this.readerWrapper.ownerDocument.defaultView.window.HTMLBodyElement) {
            this.readerContainer = createElement(this.readerWrapper.ownerDocument, "div", getRandomId(true), { "style": "width:100%;height:100%;overflow: hidden;position:relative;background:var(" + Theme.ReaderBackground + ")" });
            this.readerWrapper.appendChild(this.readerContainer);
            readerDocument = this.readerContainer.ownerDocument;
        }
        else {
            this.isInIframe = true;
            const iframe = this.createTopIFrame();
            this.readerWrapper.appendChild(iframe);
            if (BrowserCapabilities.isFirefox()) {
                iframe.contentDocument.open();
                iframe.contentDocument.close();
            }
            const iframeDocument = iframe.contentDocument!;
            this.readerContainer = createElement(iframeDocument, "div", getRandomId(true), { "style": "width:100%;height:100%;overflow: hidden;position:relative;background:var(" + Theme.ReaderBackground + ")" });
            iframeDocument.body.appendChild(this.readerContainer);
            readerDocument = iframeDocument;
            iframe.contentWindow.addEventListener("click", (e) => {
                this.events.emit(EventNames.ReaderClick, { e, reader: this });
            }, true);
            iframe.contentWindow.addEventListener("mouseenter", (e) => {
                this.events.emit(EventNames.ReaderMouseEnter, { e, reader: this });
            }, true);
        }
        this.rootContainer.addEventListener("click", (e) => {
            this.events.emit(EventNames.ReaderClick, { e, reader: this });
        }, true);
        this.rootContainer.addEventListener("mouseenter", (e) => {
            this.events.emit(EventNames.ReaderMouseEnter, { e, reader: this });
        }, true);
        this.readerContainer.setAttribute("data-role", "readerContainer");

        await this.onContainerCreated?.();

        const readerWrapperBackground = this.readerWrapper.style.getPropertyValue("background");
        if (readerWrapperBackground) {
            this.readerWrapper.setAttribute("data-reader-wrapper-bg", readerWrapperBackground);
        }
        const wallpaperProvider = await this.services.get("wallpaperProvider");
        wallpaperProvider?.changeWallpaper(this.options.wallpaperName);

        if (this.options.enableInjectResetCss) {
            injectCssContent(readerDocument, "html{touch-action:none;touch-action:pan-y;}body *{box-sizing:border-box}html,body,div,dl,dt,dd,ul,ol,li,h1,h2,h3,h4,h5,h6,pre,code,form,fieldset,legend,input,textarea,p,blockquote,th,td{padding:0;margin:0;}ul,ol,li{list-style:none;}i,em{font-style:normal}img{border:0;}table{border-collapse:collapse;border-spacing:0;}table td{padding:0;margin:0;}table th.wztop{vertical-align:top;}.fl{float:left;}.fr{float:right;}section,article,aside,header,footer,nav,dialog,figure{display:block;padding:0;margin:0;}html{text-size-adjust: 100%;}", false, "reader_global_style");
        }

        await this.notifier.initialize(this.readerContainer);
    }

    private async mountRenderer(result: FileLoadResult): Promise<void> {
        if (this.options.enableProgressStore && !this.readingProgressStore) {
            this.readingProgressStore = await this.services.get("readingProgressStore");
        }
        this.unbindEvents();
        if (this.renderer) {
            await this.renderer.dispose();
            this.renderer = null;
        }

        const loadingRenderer = await this.mediaTypeRegistry.createRenderer(this, result.fileParser, this.readerContainer);
        this.renderer = loadingRenderer;

        await this.onRenderer?.(this.renderer);

        const percentage = result.percentage;
        const location = result.location;
        if (!isNaN(percentage) && percentage <= 1 && percentage >= 0) {
            await this.renderer.navigator.gotoPercentage(percentage);
        }
        else {
            await this.renderer.load(location);
        }

        const documents = this.renderer.getDocuments();
        if (documents.length == 0) {
            throw new Error("Empty File");
        }
        const theme=await this.getTheme(this.options.themeName);
        await this.getRenderer()?.applyTheme(theme);
        await this.onRenderered?.(this.renderer);

        await this.loading?.hide();
        this.events.emit(EventNames.RendererLoad, this.renderer);
        await this.pluginManager?.enablePlugins(result.extension);
        this.bindEvents();
    }

    private bindEvents = () => {
        this.events.on(EventNames.ProgressChange, this.storeProgress);
    }

    private unbindEvents = () => {
        this.events.off(EventNames.ProgressChange, this.storeProgress);
    }

    private storeProgress = async (progress: Progress) => {
        if (this.readingProgressStore) {
            await this.readingProgressStore.save(this.context.simpleId, progress);
        }
    }

    get context() {
        return this.fileLoader.context;
    }

    get url() {
        return this.fileLoader.url;
    }

    get openOptions() {
        return this.fileLoader.openOptions;
    }

    /**
     * Get the current extension
     */
    get extension(): string {
        return this.fileLoader.extension;
    }

    /**Whether the resource is unloaded */
    get resourceIsUnload() {
        return !this.currentIsLoaded;
    }

    get inIframe(): boolean {
        return this.isInIframe;
    }

    getFileParser() {
        return this.fileLoader.getFileParser();
    }

    getRenderer(): IRenderer {
        return this.renderer;
    }

    /**
     * Change theme: persist options.themeName and apply CSS variables.
     * @param themeName theme name
     */
    changeTheme = async (themeName: string): Promise<void> => {
        if (!themeName) {
            return;
        }
        this.options.themeName = themeName;
        const theme=await this.getTheme(themeName);
        await this.applyGlobalTheme(theme);
        await this.getRenderer()?.applyTheme(theme);
        this.events.emit(EventNames.ThemeChange, theme);
    }

    private getTheme=async (themeName: string)=>{
        const themeProvider = await this.services.get("themeProvider");
        let theme: Theme;
        if (!themeProvider) {
            theme = new Theme();
        }
        else {
            theme = themeProvider.getTheme(themeName);
        }
        if(!theme){
            theme = new Theme();
        }
        return theme;
    }

    private applyGlobalTheme=async (theme: Theme)=>{
        for (const key of ThemeCssKeys) {
            this.rootContainer.style.setProperty(toCssVariableName(key), theme[key]);
        }
        if (theme.vars) {
            for (const [name, value] of Object.entries(theme.vars)) {
                if (name) {
                    this.rootContainer.style.setProperty(name, value);
                }
            }
        }
        const scrollStyles = Theme.getScrollStyles(`.${Theme.customScrollerClassName}`);
        injectCssContent(this.rootContainer.ownerDocument, scrollStyles, true, "custom-scroll-styles");
    }

    async goto(location: FileLocation): Promise<void> {
        await this.getRenderer()?.navigator.goto(location);
    }
    async gotoUrl(url: string): Promise<void> {
        await this.getRenderer()?.navigator.gotoUrl(url);
    }
    async gotoPercentage(percentage: number, options?: GotoPercentegeOptions): Promise<void> {
        await this.getRenderer()?.navigator.gotoPercentage(percentage, options);
    }

    private createTopIFrame(id?: string): HTMLIFrameElement {
        const iframe = createElement(document, "iframe", id);
        if (BrowserCapabilities.isFirefox()) {
            iframe.setAttribute("src", "javascript:");
        }
        else {
            iframe.setAttribute("src", "about:blank");
        }
        iframe.setAttribute("frameborder", "0");
        iframe.setAttribute("border", "0");
        iframe.setAttribute("allowfullscreen", "true");
        iframe.setAttribute("width", "100%");
        iframe.setAttribute("height", "100%");
        iframe.setAttribute("style", "margin:0;padding:0");
        return iframe;
    }

    /**
     * Get the reader container,may be in iframe
     * @returns
     */
    getReaderContainer() {
        return this.readerContainer;
    }

    /**
     * Get the root container
     * @returns
     */
    getRootContainer() {
        return this.rootContainer;
    }

    async dispose(): Promise<void> {
        await this.onDisposing?.();
        await this.clear();
        this.currentIsDidposed = true;
        this.fileLoader.markDisposed();
        await this.onDisposed?.();
        this.events.emit(EventNames.ReaderDisposed, this);
    }

    /**Clear the reader */
    async clear() {
        try {
            if (this.context?.id) {
                if (this.startLoadTime) {
                    const progress = await this.renderer?.progressTracker.getProgress(true);
                    if (progress) {
                        this.events.emit(EventNames.ResourceUnload, { reader: this, simpleId: this.context.simpleId, resourceId: this.context.id, startLoadTime: this.startLoadTime, progress: progress });
                    }
                }
            }
            if (this.abortController) {
                this.abortController.abort("Cancelled");
                this.abortController = null;
                this.logger.info("User cancelled task,url", this.url);
                this.currentIsCancelled = true;
            }
        } catch (e) {
            //
        }

        //Clear the loaded plugins
        await this.pluginManager?.dispose();

        if (this.renderer) {
            await this.renderer.dispose();
            this.renderer = null;
        }

        await this.fileLoader.clear();

        if (this.readerWrapper) {
            this.readerWrapper.innerHTML = "";
        }
        this.startLoadTime = null;
        this.currentIsLoaded = false;
        this.events.emit(EventNames.ReaderCleared, this);
    }
}
