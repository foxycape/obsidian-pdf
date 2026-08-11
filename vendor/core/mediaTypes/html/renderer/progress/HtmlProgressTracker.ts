import { getDocumentBody, getElementIndex } from "../../../../kernal/html/finder";
import { isNullOrWhiteSpace } from "../../../../kernal/common/text";
import { getUrlFragment } from "../../../../kernal/common/url";
import { EventNames, FileLocation, Progress, LastElementAttributeName, Reader, throttle } from "../../../../kernal";
import type { ILogger } from "js-logger";
import { IHtmlProgressTracker } from "./IHtmlIProgressTracker";
import { IHtmlDocument } from "../IHtmlDocument";
import { IHtmlDocumentsProvider } from "../IHtmlDocumentsProvider";
import { HtmlOptions } from "../../HtmlOptions";
import { HtmlSymbolCalclator } from "../document/HtmlSymbolCalclator";
import { getAdjacentText } from "./adjacent";

export class HtmlProgressTracker implements IHtmlProgressTracker {
    private readonly logger: ILogger;

    constructor(private readonly owner: Reader,
        private readonly documentsProvider: IHtmlDocumentsProvider,
        private readonly options: HtmlOptions
    ) {
        this.logger = owner.loggerFactory.getLogger(this.constructor.name);
    }
    notifyProgressChange(): void {
        this.delayUpdateProgress();
    }

    async calcProgress(location: FileLocation): Promise<Progress> {
        try {
            const totalPercentage = await this.getTotalPercentage(location);
            if (totalPercentage >= 0) {
                const progress = new Progress(1, totalPercentage);
                progress.location = location;
                return progress;
            }
            return null;
        }
        catch (e) {
            this.logger.error(e);
            return null;
        }
    }

    private async getTotalPercentage(location: FileLocation) {
        try {
            if (!location?.url)
                return null;
            let totalPercentage: number;
            const urlFragment = getUrlFragment(location.url);
            const url = urlFragment.urlWithoutAnchor;
            const anchor = urlFragment.anchor;
            if (location.tagName) {
                totalPercentage = await this.getPassedPercentage(url, { tagName: location.tagName, tagIndex: location.tagIndex }, true);
            }
            else if (location.current >= 0) {
                const current = location.current;
                totalPercentage = await this.getPassedPercentage(url, current, true);
            }
            else {
                const doc = this.documentsProvider.getDocument(url)
                const ownerDocument = doc.getContentContainer().ownerDocument
                let element: Element = getDocumentBody(ownerDocument);
                if (!isNullOrWhiteSpace(anchor)) {
                    const targetAnchor = ownerDocument.getElementById(anchor);
                    if (targetAnchor != null) {
                        element = targetAnchor;
                    }
                }
                totalPercentage = await this.getPassedPercentage(url, element, true);
            }
            return totalPercentage;
        }
        catch (e) {
            this.logger.error(e);
            return null;
        }
    }

    async getProgress(precise?: boolean): Promise<Progress> {
        if (!precise && this.owner.context.progress) {
            return this.owner.context.progress;
        }

        const firstVisibleDocument = this.documentsProvider.getFirstVisibleDocument(true);
        if (!firstVisibleDocument) {
            return null;
        }

        const visibleElements = firstVisibleDocument.getVisibleElements(true);
        if (visibleElements.length === 0) {
            return null;
        }

        let firstVisibleElement = visibleElements[0];
        const firstVisibleElementRect = firstVisibleElement.getBoundingClientRect();
        if (firstVisibleElementRect.width === 0 && firstVisibleElementRect.height === 0) {
            return null;
        }

        const fullscreenElement = firstVisibleDocument.getContentContainer()?.ownerDocument?.fullscreenElement;
        if (fullscreenElement) {
            firstVisibleElement = fullscreenElement;
        }

        const location = this.createElementLocation(firstVisibleDocument, firstVisibleElement);
        location.offsetTop = this.calcVisibleElementOffsetTop(firstVisibleElement, firstVisibleDocument, !!fullscreenElement);
        location.precise = true;
        location.ignoreOverlayHeader = true;
        location.scrollBehavior = "smooth";
        location.text = getAdjacentText(this.documentsProvider, this.options.htmlBlockTags, firstVisibleDocument.extension, firstVisibleElement);
        if (this.options.flipMode === "page") {
            const pageNumber = this.documentsProvider.getCurrentPageNumber(firstVisibleDocument);
            const numberOfPages = await firstVisibleDocument.getNumberOfPages();
            location.unit = "page";
            location.current = pageNumber;
            location.total = numberOfPages;
        }

        let totalPercentage: number;
        const lastVisibleDocument = this.documentsProvider.getLastVisibleDocument(true);
        const lastVisibleElements = lastVisibleDocument?.getVisibleElements() ?? [];
        const lastVisibleElement = lastVisibleElements[lastVisibleElements.length - 1];
        if (lastVisibleDocument && lastVisibleElement) {
            totalPercentage = await this.getPassedPercentage(lastVisibleDocument.url, lastVisibleElement, true);
        }
        else {
            totalPercentage = await this.getTotalPercentage(location);
        }

        const progress = new Progress(1, totalPercentage);
        progress.location = location;
        return progress;
    }

    private createElementLocation(doc: IHtmlDocument, element: Element): FileLocation {
        const location = new FileLocation(doc.url, 1, "ratio");
        location.tagName = element.tagName;
        location.tagIndex = getElementIndex(element.ownerDocument, element);
        return location;
    }

    private calcVisibleElementOffsetTop(element: Element, doc: IHtmlDocument, isFullscreen: boolean): number | undefined {
        if (isFullscreen) {
            return 50;
        }

        const elementRect = element.getBoundingClientRect();
        const iframe = doc.getContentContainer()?.ownerDocument?.defaultView?.frameElement as HTMLElement | null;
        const iframeRectTop = iframe?.getBoundingClientRect().top ?? 0;
        let offsetTop = this.options.flipMode === "scroll"
            ? elementRect.top + iframeRectTop
            : elementRect.top;

        const scrollElement = this.documentsProvider.getScrollElement();
        if (scrollElement) {
            offsetTop -= scrollElement.getBoundingClientRect().top;
        }

        // Preserve previous behavior: 0 means "no offset".
        return offsetTop || undefined;
    }

    private async getPassedPercentage(url: string, target: Element | number | { tagName: string, tagIndex: number }, shouldCheckFinished?: boolean) {
        const spineFiles = await this.documentsProvider.fileParser.getSpineFiles();
        const index = !isNullOrWhiteSpace(url) && !isNaN(url as any) ? parseInt(url) : spineFiles.findIndex(x => x.url == url);
        const currentSpineFile = spineFiles[index];
        const doc = this.documentsProvider.getDocument(url);
        const isLastDocument = index == spineFiles.length - 1;
        const fileProgressPercentage = await this.getDocumentPercentage(doc, target);

        if (isLastDocument && typeof target != "number" && shouldCheckFinished) {
            let contentContainer = doc.getContentContainer();
            if (!contentContainer) {
                contentContainer = getDocumentBody((await doc.getVirtualContentContainer())?.ownerDocument);
            }
            const lastElementChild = contentContainer?.querySelector("[" + LastElementAttributeName + "='true']");
            const fullyVisibleElements = doc.getVisibleElements(true);
            if (
                (lastElementChild && fullyVisibleElements.includes(lastElementChild)) ||
                fileProgressPercentage >= 1
            ) {
                return 1;
            }
        }

        const totalCurrentPercentage = fileProgressPercentage * currentSpineFile.ratio;
        return isLastDocument && fileProgressPercentage >= 1
            ? 1
            : currentSpineFile.startProgress + totalCurrentPercentage;
    }

    private async getDocumentPercentage(doc: IHtmlDocument, target: Element | number | { tagName: string, tagIndex: number }): Promise<number> {
        if (typeof target === "number") {
            if (target < 1) {
                return target;
            }
            if (this.options.flipMode === "scroll") {
                return target <= 1 ? target : 0;
            }
            await doc.load();
            const numberOfPages = await doc.getNumberOfPages();
            if (numberOfPages <= 0) {
                return 0;
            }
            const page = Math.min(Math.max(target, 0), numberOfPages);
            return page / numberOfPages;
        }

        const symbolCalclator = new HtmlSymbolCalclator(doc, this.options);
        try {
            return await symbolCalclator.getProgressByElement(target, this.options.symbolType);
        }
        finally {
            await symbolCalclator.dispose();
        }
    }

    async getPercentage(url: string, target: Element | number | { tagName: string, tagIndex: number }): Promise<number> {
        if (isNullOrWhiteSpace(url)) {
            throw new Error(this.owner.locale?.getText("missingLocationUrl", "missing location url"));
        }
        const totalPercentage = await this.getPassedPercentage(url, target);
        return totalPercentage;
    }

    private updateProgress = async (): Promise<void> => {
        if (!this.owner.context.userChangedProgress) {
            return;
        }

        const progress = await this.getProgress(true);
        if (!progress) {
            return;
        }

        this.owner.context.progress = progress;
        this.owner.context.currentLocation = progress.location;

        if (this.owner.onProgressChangeGuard) {
            const allowContinue = this.owner.onProgressChangeGuard(progress.current);
            if (!allowContinue) {
                return;
            }
        }

        this.owner.events.emit(EventNames.ProgressChange, progress);
    }

    private delayUpdateProgress = throttle(this.updateProgress, 300, true);

    async dispose(): Promise<void> {
    }
}
