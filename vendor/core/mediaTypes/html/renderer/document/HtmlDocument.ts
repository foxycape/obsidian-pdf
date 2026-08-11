import { getDocumentBody } from "../../../../kernal/html/finder";
import { getOrderedElementsIntersectingRect, resolveVisibleViewportInContentWindow } from "../../../../kernal/html/geometry";
import { getUuid } from "../../../../kernal/common/uuid";
import { EventNames, FlipMode, IFileParser, ILogger, WritingMode, TextFormatOptions, SpineFile, BrowserCapabilities, Direction, readerPrefixName } from "../../../../kernal";
import type { Reader } from "../../../../kernal/Reader";
import { HtmlSettings } from "../../HtmlSettings";
import { IHtmlDocument } from "../IHtmlDocument";
import { IHtmlTextDocument } from "../IHtmlTextDocument";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { BaseDocument } from "../../../base/renderer/BaseDocument";
import { getEventKeyMap } from "../../../base/renderer/eventKeys";
import { HtmlOptions } from "../../HtmlOptions";
import { IHtmlLoadLayer } from "../../../../kernal/services/docLoadLayer/IHtmlLoadLayer";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import { createIframe, getTooBigHtmlTemplate } from "../html/template";
import { HtmlPageCalculator } from "./HtmlPageCalculator";
import { HtmlDocumentResizeObserver } from "./HtmlDocumentResizeObserver";
import { collectContentUnitElements } from "../visibilityCandidates";

export class HtmlDocument extends BaseDocument implements IHtmlDocument {
    private docContent: string;
    private logger: ILogger;
    private iframe: HTMLIFrameElement;
    private loadingLayer: IHtmlLoadLayer;
    private readonly pageCalculator: HtmlPageCalculator;
    private readonly eventKeyMap = getEventKeyMap();
    private readonly resizeObserver: HtmlDocumentResizeObserver;
    private visibilityCandidates: Element[] | null = null;
    constructor(owner: Reader, viewport: IRendererViewport<HtmlLayoutMetrics>, fileParser: IFileParser, wrapperContainer: HTMLElement, spineFile: SpineFile, private readonly options: HtmlOptions) {
        super(owner, fileParser, wrapperContainer, spineFile);

        this.pageCalculator = new HtmlPageCalculator(this, viewport, options);
        this.logger = this.owner.loggerFactory.getLogger(this.constructor.name);
        this.resizeObserver = new HtmlDocumentResizeObserver(this, this.owner.events);
    }

    override get inIframe(): boolean {
        return true;
    }

    private getWritingMode(): WritingMode {
        return this.options.writingMode ?? 'horizontal-tb';
    }

    private callbacks: { resolve: any; reject: any; }[] = [];
    override async load(): Promise<void> {
        await new Promise<void>(async (resolve, reject) => {
            if (this.loadStatus == "success") {
                resolve();
                return;
            }
            this.callbacks.push({ resolve, reject });
            if (this.loadStatus == 'loading') {
                return;
            }
            this.loadStatus = "loading";
            this.loadingLayer = await this.owner.services.get('loadLayer');
            this.loadingLayer?.setDoc(this);
            this.wrapperContainer.innerHTML = "";
            this.loadingLayer.removeLoadingLayer();
            this.loadingLayer.loadLoadingLayer();

            try {
                if (this.inIframe) {
                    if (!this.iframe) {
                        const iframeId = readerPrefixName + getUuid(true);
                        this.iframe = createIframe(this.wrapperContainer.ownerDocument, iframeId, this.options.forceScroll);
                        if (this.options.forceScroll) {
                            this.iframe.removeAttribute("scrolling");
                        }
                        else {
                            this.iframe.setAttribute("scrolling", "no");
                        }
                        const loadingContent = await this.buildLoadingContent();
                        await BrowserCapabilities.yieldToMain();
                        this.wrapperContainer.appendChild(this.iframe);

                        await BrowserCapabilities.yieldToMain();
                        this.iframe.addEventListener("load", async () => {
                            await this.processAfterLoaded();
                        }, false);
                        this.iframe.addEventListener("error", (err) => {
                            this.loadingLayer?.removeLoadingLayer();
                            this.loadStatus = "fail";
                            this.iframe = undefined;
                            this.loadingLayer?.setReloadButton();
                            this.logger.error(err);
                            this.owner.events.emit(EventNames.DocumentLoadFailed, this, err);
                            this.loadCompleted(true);
                        }, false);
                        const iframeDocument = this.iframe.contentDocument;
                        if ((this.options.preferSrcdoc && "srcdoc" in this.iframe) || !("write" in iframeDocument)) {
                            this.iframe.srcdoc = loadingContent;
                        }
                        else {
                            iframeDocument.open();
                            iframeDocument.write(loadingContent);
                            iframeDocument.close();
                            await BrowserCapabilities.yieldToMain();
                        }
                    }
                }
                else {
                    const loadingContent = await this.buildLoadingContent();
                    this.wrapperContainer.innerHTML = loadingContent;
                    await this.processAfterLoaded();
                    await BrowserCapabilities.yieldToMain();
                }
            }
            catch (error) {
                this.logger.error(error);
                if (!this.owner?.context) {
                    this.loadCompleted(true);
                }
                else {
                    this.loadingLayer?.removeLoadingLayer();
                    this.loadStatus = "fail";
                    this.iframe = undefined;
                    this.loadingLayer?.setReloadButton();
                    this.owner.events.emit(EventNames.DocumentLoadFailed, this, error?.toString());
                    this.loadCompleted(true);
                }
            }
            finally {
                await this.loadingLayer?.dispose();
                this.loadingLayer = undefined;
            }
        });
    }
    private buildLoadingContent = async () => {
        const virtualDocument = await this.getFormattedVirtualDocument();
        const preprocesses = this.owner.getRenderer()?.documentPreprocesses ?? [];
        for (const preprocess of preprocesses) {
            try {
                await preprocess(this);
            }
            catch (e) {
                this.logger.error('preprocess', 'function', preprocess?.name, e);
            }
        }

        let loadingContent = virtualDocument.documentElement.outerHTML;
        if (this.owner.onRenderingFileInject) {
            loadingContent = await this.owner.onRenderingFileInject(this.extension, loadingContent, this.url);
        }
        loadingContent = loadingContent.replace(/<([^<]*)\?xml([^>]*)\?.*?>/i, "");
        const existDocType = loadingContent.match(/<!DOCTYPE[^>]*>/i);
        if (!existDocType) {
            loadingContent = "<!DOCTYPE html>" + loadingContent;
        }
        return loadingContent;
    };

    private processAfterLoaded = async () => {
        const contentContainer = this.getContentContainer();
        if (!contentContainer) {
            return;
        }
        contentContainer.setAttribute("data-url", this.url);
        this.wrapperContainer.classList.remove(HtmlSettings.FileContentContainerHeightClassName);
        const postprocesses = this.owner.getRenderer()?.documentPostprocesses ?? [];
        for (const postprocess of postprocesses) {
            try {
                await postprocess(this);
                await BrowserCapabilities.yieldToMain();
            }
            catch (e) {
                this.logger.error('postprocess', 'function', postprocess?.name, e);
            }
        }

        this.loadingLayer?.removeLoadingLayer();
        this.loadStatus = "success";
        this.visibilityCandidates = null;
        this.bindDocumentEvents();
        this.owner.events.emit(EventNames.DocumentLoad, this);
        await this.internalResetSizes();
        this.resizeObserver.observeIframeSize(async () => {
            await this.internalResetSizes();
            if (this.getFlipMode() == "page") {
                this.pageCalculator.calcNumberOfPages(true);
            }
        });
        this.loadCompleted(true);
    };
    private loadCompleted = (success: boolean) => {
        for (let i = 0; i < this.callbacks.length; i++) {
            try {
                if (success) {
                    this.callbacks[i].resolve();
                }
                else {
                    this.callbacks[i].reject();
                }
            }
            catch (e) {
            }
        }
        this.callbacks = [];
    };

    private internalResetSizes = async () => {
        const contentRootElement = this.getContentRootElement();
        if (!contentRootElement) {
            return;
        }
        const writingMode = this.getWritingMode();
        this.resetIframeMinWidthHeight(contentRootElement, this.getFlipMode(), writingMode);
    };
    private resetIframeMinWidthHeight(rootContent: Element, flipMode: FlipMode, writingMode: WritingMode) {
        if (!rootContent)
            return;
        if (flipMode == "scroll") {
            if (this.iframe) {
                if (this.isVerticalWriting(writingMode)) {
                    let iframeMinHeight = rootContent.scrollHeight;
                    this.iframe.style.willChange = 'transform';
                    this.iframe.style.removeProperty("min-width");
                    this.iframe.style.minHeight = iframeMinHeight + "px";
                    this.iframe.style.removeProperty('will-change');
                    this.iframe.style.removeProperty('transform');
                }
                else {
                    const iframeMinHeight = rootContent.getBoundingClientRect().height;
                    this.iframe.style.willChange = 'transform';
                    this.iframe.style.removeProperty("min-width");
                    this.iframe.style.minHeight = Math.round(iframeMinHeight) + "px";
                    this.iframe.style.removeProperty('will-change');
                    this.iframe.style.removeProperty('transform');
                }
            }
        }
        else {
            if (this.iframe) {
                this.iframe.style.removeProperty("min-height");
                this.iframe.style.removeProperty("min-width");
                const iframeMinWidth = rootContent.scrollWidth;
                const bodyWidth = getDocumentBody(rootContent.ownerDocument).getBoundingClientRect().width;
                const minWidth = Math.min(iframeMinWidth, bodyWidth);
                this.iframe.style.minWidth = minWidth + "px";
            }
        }
    }
    async getContent(): Promise<string> {
        if (this.docContent) {
            return this.docContent;
        }
        this.docContent = await (await this.fileParser.getTextDocument(this.url)).getPlaintext();
        if (this.docContent.length > this.options.singleDocMaxSize) {
            return getTooBigHtmlTemplate(this.docContent.length);
        }
        return this.docContent;
    }
    private formattedVirtualDocument: Document;
    private async getFormattedVirtualDocument(): Promise<Document> {
        if (this.formattedVirtualDocument) {
            return this.formattedVirtualDocument;
        }
        const textDocument = await this.fileParser.getTextDocument(this.url) as IHtmlTextDocument;
        this.formattedVirtualDocument = await textDocument.getFormattedDocument();
        return this.formattedVirtualDocument;
    }

    override async getText(options?: TextFormatOptions): Promise<string> {
        const textDocument = await this.fileParser.getTextDocument(this.url) as IHtmlTextDocument;
        return await textDocument.getPlaintext(options);
    }

    private internalGetNumberOfPages(): number {
        let numberOfPages = 1;
        if (this.getFlipMode() == "page") {
            numberOfPages = this.pageCalculator.calcNumberOfPages();
        }
        return numberOfPages;
    }
    async getNumberOfPages(): Promise<number> {
        await this.load();
        return this.internalGetNumberOfPages();
    }
    async getPageNumber(element: Element) {
        return this.pageCalculator.getPageNumber(element);
    }

    private getContentRootElement(): HTMLElement {
        if (this.inIframe) {
            return this.iframe?.contentDocument?.documentElement;
        }
        return this.wrapperContainer;
    }
    override getContentContainer(): HTMLElement {
        if (this.inIframe) {
            return getDocumentBody(this.iframe?.contentDocument);
        }
        return this.wrapperContainer;
    }
    async getVirtualContentContainer(raw?: boolean): Promise<HTMLElement> {
        if (raw) {
            const textDocument = await this.fileParser.getTextDocument(this.url) as IHtmlTextDocument;
            return getDocumentBody(await textDocument.getFormattedDocument());
        }
        const virtualDocument = await this.getFormattedVirtualDocument();
        return getDocumentBody(virtualDocument);
    }

    getVisibleElements(fullVisibleInWindow?: boolean): Element[] {
        if (this.loadStatus != "success") {
            return [];
        }
        const contentContainer = this.getContentContainer();
        const contentWindow = contentContainer?.ownerDocument?.defaultView;
        if (!contentContainer || !contentWindow) {
            return [];
        }

        if (!this.visibilityCandidates) {
            // Content units are shared anchors for visibility / progress / nav.
            this.visibilityCandidates = collectContentUnitElements(contentContainer, {
                htmlBlockTags: this.options.htmlBlockTags
            });
        }

        const topInset = this.getFlipMode() == "scroll"
            ? this.owner.optionsProvider.getHeaderHeight()
            : 0;
        const viewport = resolveVisibleViewportInContentWindow(contentWindow, { topInset });
        if (!viewport) {
            return [];
        }

        return getOrderedElementsIntersectingRect(this.visibilityCandidates, viewport, {
            writingMode: this.getWritingMode(),
            fullVisible: fullVisibleInWindow
        });
    }

    override async dispose(): Promise<void> {
        this.owner.events.emit(EventNames.DocumentDisposing, this);
        this.unbindDocumentEvents();
        this.resizeObserver.unobserveIframeSize();
        this.callbacks?.splice(0);
        this.visibilityCandidates = null;
        const wrapperContainer = this.getWrapperContainer();
        wrapperContainer.classList.add(HtmlSettings.FileContentContainerHeightClassName);
        wrapperContainer.removeChild(this.iframe);
        this.wrapperContainer.innerHTML = ""
        this.iframe = undefined;
        this.formattedVirtualDocument = null;
        await super.dispose();
    }

    private capture = true;
    private bindDocumentEvents(): void {
        const rootContainer = this.inIframe ? this.getContentContainer().ownerDocument : this.getContentRootElement();
        for (const key of this.eventKeyMap.keys()) {
            rootContainer.addEventListener(key, this.eventListener, this.capture);
        }
    }
    private unbindDocumentEvents() {
        const rootContainer = this.inIframe ? this.getContentContainer().ownerDocument : this.getContentRootElement();
        for (const key of this.eventKeyMap.keys()) {
            rootContainer.removeEventListener(key, this.eventListener, this.capture);
        }
    }
    private eventListener = (e: Event) => {
        const customEventKey = this.eventKeyMap.get(e.type as any);
        if (customEventKey) {
            this.owner.events.emit(customEventKey, e, this);
        }
    };
    private isVerticalWriting(writingMode: WritingMode) {
        return writingMode == "vertical-lr" || writingMode == "vertical-rl";
    }


    private getFlipMode(): FlipMode {
        if (this.options.forceScroll) {
            return "scroll";
        }
        return this.options.flipMode;
    }
}
