import { isNullOrWhiteSpace } from "../../../../kernal/common/text";
import { parseNumber } from "../../../../kernal/common/number";
import { compareTagName } from "../../../../kernal/html/finder";
import { emptyElement } from "../../../../kernal/html/dom";
import { wrapperCharacters, recoverWrapperCharacters } from "../../../../kernal/html/manipulator";
import { scrollElementIntoView, getTransformLength } from "../../../../kernal/html/style";
import { FileLocation, IFileParser, ILogger, SpineFile, STTAG, WritingMode, asyncDebounce, BrowserCapabilities, Theme, FlipMode } from "../../../../kernal";
import type { Reader } from "../../../../kernal/Reader";
import { HtmlSettings } from "../../HtmlSettings";
import { BaseDocumentsProvider } from "../../../base/renderer/BaseDocumentsProvider";
import { HtmlDocument } from "../document/HtmlDocument";
import { IHtmlDocument } from "../IHtmlDocument";
import { HtmlOptions } from "../../HtmlOptions";
import { HtmlDocumentsPreloader } from "./HtmlDocumentsPreloader";
import { HtmlDocumentsIntersectionObserver } from "./HtmlDocumentsIntersectionObserver";
import { HtmlElementLocator } from "../location/HtmlElementLocator";
import { IHtmlDocumentsProvider } from "../IHtmlDocumentsProvider";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import { HtmlRendererViewport } from "../layout/HtmlRendererViewport";
import { IHtmlDocumentsPreloader } from "./IHtmlDocumentsPreloader";
import { IHtmlElementLocator } from "../location/IHtmlElementLocator";

/**
 * HTML documents provider.
 */
export class HtmlDocumentsProvider extends BaseDocumentsProvider<IHtmlDocument> implements IHtmlDocumentsProvider {
    protected logger: ILogger;
    private isInit: boolean = false;
    private isFirstLoad: boolean = true;
    private delayHideLoadingLayerTimer: any;
    private loadingDoc: IHtmlDocument;
    private readonly documentsIntersectionObserver: HtmlDocumentsIntersectionObserver;
    private readonly documentPreloader: IHtmlDocumentsPreloader;
    protected readonly rendererViewport: IRendererViewport<HtmlLayoutMetrics>;
    private readonly elementLocator: IHtmlElementLocator;
    private hangTasks: (() => Promise<void>)[] = [];
    constructor(
        owner: Reader,
        fileParser: IFileParser,
        protected readonly readerContainer: HTMLElement,
        protected readonly htmlOptions: HtmlOptions
    ) {
        super(owner, fileParser);
        this.logger = this.owner.loggerFactory.getLogger(this.constructor.name);
        this.elementLocator = new HtmlElementLocator(this);
        this.rendererViewport = new HtmlRendererViewport(owner, this.readerContainer, this.owner.optionsProvider, htmlOptions);
        this.documentsIntersectionObserver = new HtmlDocumentsIntersectionObserver(this);
        this.documentPreloader = new HtmlDocumentsPreloader(this.owner.events, this, () => this.loadingDoc, htmlOptions);
    }

    private getTransformContainer(): HTMLElement {
        return this.getRendererContainer().querySelector('.' + HtmlSettings.TransformContainerCssName) as HTMLElement;
    }

    override getRendererContainer(): HTMLElement {
        return this.rendererViewport.getRendererContainer();
    }

    override getScrollElement(): HTMLElement {
        return this.rendererViewport.getScrollElement();
    }

    getLoadingDocument(): IHtmlDocument {
        return this.loadingDoc;
    }

    override async createDocument(documentContainer: HTMLElement, spineFile: SpineFile, fileIndex: number): Promise<IHtmlDocument> {
        return new HtmlDocument(this.owner, this.rendererViewport, this.fileParser, documentContainer, spineFile, this.htmlOptions);
    }

    /**
     * Initialize each document container.
     */
    protected override async initialize(documentsWrapper: HTMLElement) {
        this.rendererViewport.applyCssVariables();
        await super.initialize(documentsWrapper);
        const documents = this.getDocuments();
        for (const doc of documents) {
            doc.getWrapperContainer().classList.add(HtmlSettings.FileContentContainerClassName, HtmlSettings.FileContentContainerHeightClassName);
        }
    }

    override async load(location?: FileLocation, isReload?: boolean): Promise<void> {
        if (!this.isInit) {
            await this.initialize(this.getTransformContainer());
            this.documentsIntersectionObserver.register();
            this.isInit = true;
        }
        if (location?.storeCurrent) {
            await this.owner.onBeforeRedirect?.(this);
        }
        isReload = isReload ?? false;
        const url = location?.url;
        let doc = this.getDocument(url);
        if (!doc) {
            const documents = this.getDocuments();
            doc = documents[0];
            if (documents.length > 1 || !location) {
                location = new FileLocation(doc.url, 1, 'ratio');
                location.current = 0;
            }
        }

        if (this.htmlOptions.flipMode == "page") {
            this.appendPageStyles();
        }
        else {
            this.removePageStyles();
        }
        this.loadingDoc = doc;
        this.owner.context.redirectingDocUrl = doc.url;
        try {
            this.delayHideLoadingLayerTimer = setTimeout(async () => {
                await this.owner.loading?.hide();
            }, 2000);

            this.owner.context.setUserChangedProgress(!isReload, location?.from);

            await this.gotoDoc(doc, location, isReload);

            if (this.isFirstLoad && !isReload) {
                this.isFirstLoad = false;
            }

            await this.documentPreloader.preloadDocuments();
        } finally {
            setTimeout(() => {
                this.loadingDoc = null;
                this.owner.context.redirectingDocUrl = undefined;
            }, 166);
        }
    }

    private async gotoDoc(doc: IHtmlDocument, location: FileLocation, isReload?: boolean): Promise<void> {
        if (!location)
            return;
        await doc.load();
        const contentContainer = doc.getContentContainer();
        if (!contentContainer)
            return;
        isReload = isReload ?? false;
        const flipMode = this.htmlOptions.flipMode;

        let redirectElement: Element = undefined, target: Element;
        try {
            const findTargetResult = await this.findTarget(doc, location);
            target = findTargetResult?.target;
            let pageNumber = findTargetResult?.pageNumber;
            const isDocumentStart = findTargetResult?.isDocumentStart;
            if (!target && !pageNumber) {
                return;
            }
            if (target && location?.textOffset >= 0) {
                const textContent = target.textContent;
                if (location?.textOffset < textContent.length && textContent.length < 3000) {
                    wrapperCharacters(target, "m");
                    const elements = target.querySelectorAll("m");
                    if (compareTagName(target.firstElementChild?.tagName, STTAG) && target.firstElementChild.getBoundingClientRect().width == 0) {
                        redirectElement = elements.item(target.firstElementChild.textContent.length);
                    }
                    else {
                        redirectElement = elements.item(location.textOffset);
                    }
                }
            }

            redirectElement = redirectElement ?? target;
            if (flipMode == "scroll") {
                await this.gotoScroll(doc, location, redirectElement, isDocumentStart);
            }
            else {
                if (isReload && redirectElement && !isNullOrWhiteSpace(location.tagName)) {
                    // Layout metrics changed: resolve page from element under a zeroed transform,
                    // otherwise getBoundingClientRect is skewed by the previous page offset.
                    this.resetTransformContainer();
                    pageNumber = await doc.getPageNumber(redirectElement);
                }
                else if (location.unit === "page" && location.current != null && location.current > 0) {
                    pageNumber = location.current;
                    const numberOfPages = await doc.getNumberOfPages();
                    if (location.total > 1 && location.total != numberOfPages) {
                        pageNumber = Math.ceil(numberOfPages * (location.current / location.total));
                    }
                }
                else if (!pageNumber) {
                    pageNumber = await doc.getPageNumber(redirectElement);
                }
                await this.transformPage(doc, pageNumber, isReload ? undefined : location.direction);
            }
        } finally {
            if (target) {
                recoverWrapperCharacters(target);
            }
        }
    }

    /**
     * Scroll mode positioning
     */
    private async gotoScroll(doc: IHtmlDocument, location: FileLocation, redirectElement: Element, isDocumentStart: boolean): Promise<void> {
        const redirectElementRect = redirectElement.getBoundingClientRect();
        let scrollTopOffset = 0;
        if (!location?.ignoreOverlayHeader) {
            scrollTopOffset = this.owner.optionsProvider.getHeaderHeight() + this.owner.options.redirectPositionOffset;

            if (redirectElement.clientHeight == 0 && redirectElementRect.height == 0) {
                scrollTopOffset += 50;
            }
        }

        if (location.offsetTop) {
            scrollTopOffset += location.offsetTop;
        }

        const scrollElement = this.getScrollElement();
        const redirectElementY = redirectElementRect.y;
        const iframe = doc.getContentContainer().ownerDocument.defaultView?.frameElement as HTMLElement;
        let iframeY = iframe?.getBoundingClientRect()?.y ?? 0;
        let distance = redirectElementY + iframeY;
        let scrollElementScrollTop = scrollElement.scrollTop;

        if (location.useAbsoluteScrollTop) {
            const newScrollTop = scrollElementScrollTop + distance - scrollTopOffset;
            scrollElement.scrollTo(0, newScrollTop);
        }
        else {
            if (!isDocumentStart) {
                if (BrowserCapabilities.isSafari()) {
                    scrollElementIntoView(doc.getWrapperContainer(), undefined, undefined, this.owner.getRootContainer()?.ownerDocument);
                    scrollElementScrollTop = scrollElement.scrollTop;
                    const iframeOffsetTop = (iframe as HTMLElement)?.offsetTop ?? 0;
                    if (Math.abs(iframeOffsetTop + redirectElementY - scrollElementScrollTop) > 5) {
                        const safariScrollTop = scrollElementScrollTop + doc.getWrapperContainer().getBoundingClientRect().y + redirectElementY;
                        scrollElement.scrollTo(0, safariScrollTop);
                    }
                    iframeY = iframe?.getBoundingClientRect()?.y ?? 0;
                    distance = redirectElementY + iframeY;
                }
                else {
                    scrollTopOffset = distance - scrollTopOffset - scrollElement.getBoundingClientRect().top;
                }
                if (scrollTopOffset > 0) {
                    const toBottomDistance = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
                    if (toBottomDistance > 0) {
                        scrollElement.scrollBy(0, scrollTopOffset);
                    }
                    else {
                        scrollElementIntoView(redirectElement, undefined, location?.scrollIntoViewIfNeeded, this.owner.getRootContainer()?.ownerDocument);
                    }
                }
                else {
                    scrollElement.scrollBy(0, scrollTopOffset);
                }
                this.setDocumentVisible(doc.getWrapperContainer(), true);
            }
            else {
                this.scrollWrapperIntoView(doc, true);
            }
        }
    }

    private async findTarget(doc: IHtmlDocument, location: FileLocation) {
        return this.elementLocator.locateElement(doc, location, this.htmlOptions);
    }

    private async transformPage(doc: IHtmlDocument, pageNumber: number, direction?: 'next' | 'previous') {
        const transformContainer = this.getTransformContainer();
        const targetTransform = transformContainer.getAttribute("data-target-transform");
        let currentTransformedLength = 0;
        if (targetTransform) {
            currentTransformedLength = parseNumber(targetTransform, 0, 'parseFloat');
        }
        else {
            currentTransformedLength = getTransformLength(transformContainer, "x");
        }
        const documentViewport = this.rendererViewport.getLayoutMetrics();
        const columnTransformLength = documentViewport.columnWidth + documentViewport.columnGap;

        const wrapperContainer = doc.getWrapperContainer();
        const offsetLeft = wrapperContainer.offsetLeft;

        // Distance the current document has already been transformed
        const currentDocumentTransformedLength = Math.abs(offsetLeft - currentTransformedLength);
        const diff = currentDocumentTransformedLength == 0 ? 0 : currentDocumentTransformedLength % columnTransformLength;

        let fixedCurrentTransformedLength = currentTransformedLength;
        if (diff > 0) {
            // If diff is not 0, a page-flip error or async loading caused the offset to change
            if (direction == 'previous') {
                fixedCurrentTransformedLength = currentTransformedLength - diff;
            } else {
                fixedCurrentTransformedLength = currentTransformedLength + columnTransformLength - diff;
            }
        }
        let newTransformLegnth = fixedCurrentTransformedLength;

        try {
            /**
             * Previous page flip has several cases:
             * 1. Target doc's movable width is enough for a full page flip
             * 2. Target doc's width is not enough for a full page flip
             */
            if (direction == 'previous') {
                /** Whether there is enough space for a full previous page flip */
                const previousSpaceIsEnough = fixedCurrentTransformedLength - documentViewport.pageMoveLength >= 0;
                /** Desired transform length for this positioning */
                const readyToTransformLegnth = offsetLeft + (pageNumber - 1) * documentViewport.pageMoveLength;
                if (previousSpaceIsEnough) {
                    newTransformLegnth = fixedCurrentTransformedLength - documentViewport.pageMoveLength;
                }
                else if (fixedCurrentTransformedLength <= documentViewport.pageMoveLength) {
                    newTransformLegnth = 0;
                }
                else {
                    newTransformLegnth = readyToTransformLegnth;
                }
            }
            else if (direction == 'next') {
                newTransformLegnth = fixedCurrentTransformedLength + documentViewport.pageMoveLength;
                const documents = this.getDocuments();
                const lastDocument = documents[documents.length - 1];
                if (lastDocument.getWrapperContainer().offsetLeft + lastDocument.getWrapperContainer().scrollWidth - newTransformLegnth <= 0) {
                    return;
                }
            }
            else {
                newTransformLegnth = offsetLeft + (pageNumber - 1) * documentViewport.pageMoveLength;
            }

            if (newTransformLegnth < 0) {
                newTransformLegnth = 0;
            }

            const writingMode = this.htmlOptions.writingMode ?? 'horizontal-tb';
            const axis = this.isVerticalWriting(writingMode) ? 'y' : 'x';
            if (axis == "x") {
                if (!transformContainer.style.transition && this.htmlOptions.flipPageStyle == 'slide' && (direction == 'next' || direction == 'previous')) {
                    transformContainer.style.transition = 'transform 0.2s ease';
                }
                if (transformContainer.style.transition) {
                    transformContainer.addEventListener('transitionend', this.removeElementTransitionEvent);
                }
                transformContainer.setAttribute('data-target-transform', `${newTransformLegnth}`);
                // Always write style.transform. After narrow→wide, snapped fixedCurrent can equal
                // the target page offset while the live style still holds the old misaligned value;
                // skipping the write would leave columns visually shifted.
                transformContainer.style.transform = "translate3d(-" + parseFloat(newTransformLegnth.toFixed(10)) + "px,0,0)";
            }
            else {
                transformContainer.style.transform = "translateX(" + (-offsetLeft) + "px)";
                const rootElement = doc.getContentContainer().ownerDocument.documentElement;
                const currentTransformedYLength = getTransformLength(rootElement, "y") + (pageNumber - 1) * documentViewport.columnWidth;
                rootElement.style.transform = "translateY(-" + parseFloat(currentTransformedYLength.toFixed(10)) + "px)";
            }
            this.setCurrentPageNumber(doc, pageNumber);
        } finally {
        }
    }

    private resetTransformContainer = () => {
        const transformContainer = this.getTransformContainer();
        if (!transformContainer) {
            return;
        }
        transformContainer.style.removeProperty('transition');
        transformContainer.style.transform = "translate3d(0px,0,0)";
        transformContainer.setAttribute('data-target-transform', '0');
        // Force layout so subsequent getBoundingClientRect reflects the reset.
        void transformContainer.offsetWidth;
    }

    private removeElementTransitionEvent = async (e: TransitionEvent) => {
        const element = e.target as HTMLElement;
        element.style.removeProperty('transition');
        element.style.removeProperty('will-change');
        element.removeAttribute(HtmlSettings.PageMovingAttributeName);
        element.removeEventListener('transitionend', this.removeElementTransitionEvent);
        while (this.hangTasks.length > 0) {
            const task = this.hangTasks.shift();
            await task();
        }
    };

    private setCurrentPageNumber(doc: IHtmlDocument, pageNumber: number) {
        const contentRootElement = doc.getContentContainer()?.ownerDocument?.documentElement;
        if (!contentRootElement)
            return;
        contentRootElement.setAttribute(HtmlSettings.HtmlDocumentCurrentPagePropertyName, pageNumber.toFixed(0));
    }

    private scrollWrapperIntoView = (doc: IHtmlDocument, forceScroll?: boolean) => {
        const wrapperContainer = doc.getWrapperContainer();
        if (this.htmlOptions.flipMode == 'page') {
            const offsetLeft = wrapperContainer.offsetLeft;
            const transformContainer = this.getTransformContainer();
            transformContainer.style.transform = "translateX(" + (-offsetLeft) + "px)";
        }
        else {
            if (!wrapperContainer.isVisible || forceScroll) {
                scrollElementIntoView(wrapperContainer, undefined, undefined, this.owner.getRootContainer()?.ownerDocument);
            }
        }
        this.setDocumentVisible(wrapperContainer, true);
    }

    getCurrentPageNumber(doc: IHtmlDocument): number {
        const contentRootElement = doc.getContentContainer()?.ownerDocument?.documentElement;
        if (!contentRootElement)
            return 1;
        const pageNumber = contentRootElement.getAttribute(HtmlSettings.HtmlDocumentCurrentPagePropertyName);
        return parseNumber(pageNumber, 1, 'parseInt');
    }

    private setDocumentVisible = (wrapperContainer: Element, isVisible: boolean) => {
        wrapperContainer.isVisible = isVisible;
    }

    private isVerticalWriting(writingMode: WritingMode) {
        return writingMode == "vertical-lr" || writingMode == "vertical-rl";
    }

    reload = async (): Promise<void> => {
        const location = this.owner.context.currentLocation;
        if (isNullOrWhiteSpace(location?.url))
            return;
        location.scrollBehavior = 'smooth';
        await this.load(location, true);
        location.scrollBehavior = undefined;
    }

    protected readonly delayReloadTime = 300;
    protected delayReload = asyncDebounce(this.reload, this.delayReloadTime);

    private appendPageStyles() {
        this.getRendererContainer().classList.add(HtmlSettings.TransformPagesClassName);
    }

    private removePageStyles() {
        this.getRendererContainer().classList.remove(HtmlSettings.TransformPagesClassName);
        const transformContainer = this.getTransformContainer();
        if (transformContainer) {
            transformContainer.style.removeProperty('transform');
        }
    }

    async dispose(): Promise<void> {
        if (this.delayHideLoadingLayerTimer) {
            clearTimeout(this.delayHideLoadingLayerTimer);
            this.delayHideLoadingLayerTimer = null;
        }
        await this.documentsIntersectionObserver.dispose();
        await this.documentPreloader.dispose();
        await super.dispose();
        if (this.readerContainer) {
            emptyElement(this.readerContainer);
        }
        this.isInit = false;
    }
}
