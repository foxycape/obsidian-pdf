import { EventNames } from "../../../../kernal/EventNames";
import { BrowserCapabilities } from "../../../../kernal/web/BrowserCapabilities";
import { HtmlOptions } from "../../HtmlOptions";
import { asyncDebounce, IDocument, IDocumentsProvider, IEventEmitter } from "../../../../kernal";
import { IHtmlDocumentsPreloader } from "./IHtmlDocumentsPreloader";

/**
 * HTML document preloading and unnecessary document release.
 */
export class HtmlDocumentsPreloader implements IHtmlDocumentsPreloader {
    constructor(
        private readonly events: IEventEmitter,
        private readonly documentsProvider: IDocumentsProvider,
        private readonly getLoadingDocument: () => IDocument,
        private readonly htmlOptions: HtmlOptions
    ) {
        this.bindEvents();
    }

    private bindEvents() {
        this.events.on(EventNames.DocumentVisibleChange, this.onDocumentVisibleChange);
    }

    private unbindEvents() {
        this.events.off(EventNames.DocumentVisibleChange, this.onDocumentVisibleChange);
    }

    private onDocumentVisibleChange = async (_doc: IDocument, _isVisible: boolean) => {
        await this.delayPreloadDocuments();
    }

    async dispose(): Promise<void> {
        this.unbindEvents();
    }

    async preloadDocuments(): Promise<void> {
        try {
            const visibleDocuments = this.documentsProvider.getVisibleDocuments();
            if (!visibleDocuments || visibleDocuments.length == 0)
                return;
            for (const doc of visibleDocuments) {
                await doc.load();
            }
            await this.preloadRelatedDocuments(visibleDocuments[0], visibleDocuments[visibleDocuments.length - 1]);
        }
        catch (e) { /* empty */ }
    }

    private delayPreloadDocuments = asyncDebounce(this.preloadDocuments, 500)

    private async preloadRelatedDocuments(startDocument: IDocument, endDocument: IDocument): Promise<void> {
        const documents = this.documentsProvider.getDocuments();
        const startIndex = documents.indexOf(startDocument);
        const endIndex = documents.indexOf(endDocument);
        const total = documents.length;
        const reservedDocuments: IDocument[] = [];
        for (let i = startIndex; i <= endIndex; i++) {
            const doc = documents[i];
            if (doc && !reservedDocuments.includes(doc)) {
                reservedDocuments.push(doc);
            }
        }
        const prepareDocuments: IDocument[] = [];
        let preloadFileCount = this.htmlOptions.preloadFileCount;
        if (preloadFileCount > 10)
            preloadFileCount = 10;
        if (preloadFileCount < 1) {
            preloadFileCount = 1;
        }

        for (let i = 1; i <= preloadFileCount; i++) {
            const nextIndex = endIndex + i;
            if (nextIndex > 0 && nextIndex <= total - 1) {
                prepareDocuments.push(documents[nextIndex]);
            }

            const previousIndex = startIndex - i;
            if (previousIndex >= 0) {
                prepareDocuments.push(documents[previousIndex]);
            }
        }

        for (let i = 0; i < prepareDocuments.length; i++) {
            const doc = prepareDocuments[i];
            await doc.load();
            if (doc && !reservedDocuments.includes(doc)) {
                reservedDocuments.push(doc);
            }
            await BrowserCapabilities.yieldToMain();
        }
        const rendererContainerClientWidth = this.documentsProvider.getRendererContainer().clientWidth;
        // if the flip mode is page, continue to check the previous screen and the next screen for content
        if (this.htmlOptions.flipMode == 'page') {
            let previousDocumentsLength = 0;
            for (let i = startIndex - 1; i >= 0; i--) {
                const doc = documents[i];
                await doc.load();
                if (doc && !reservedDocuments.includes(doc)) {
                    reservedDocuments.push(doc);
                }
                previousDocumentsLength += doc.getWrapperContainer().clientWidth;
                if (previousDocumentsLength >= rendererContainerClientWidth) {
                    break;
                }
                await BrowserCapabilities.yieldToMain();
            }
            let nextDocumentsLength = 0;
            for (let i = endIndex + 1; i < total - 1; i++) {
                const doc = documents[i];
                await doc.load();
                if (doc && !reservedDocuments.includes(doc)) {
                    reservedDocuments.push(doc);
                }
                nextDocumentsLength += doc.getWrapperContainer().clientWidth;
                if (nextDocumentsLength >= rendererContainerClientWidth) {
                    break;
                }
                await BrowserCapabilities.yieldToMain();
            }
        }

        const loadingDoc = this.getLoadingDocument();
        if (loadingDoc && !reservedDocuments.includes(loadingDoc)) {
            reservedDocuments.push(loadingDoc);
        }
        const visibleDocuments = this.documentsProvider.getVisibleDocuments();
        for (const doc of visibleDocuments) {
            if (!reservedDocuments.includes(doc)) {
                reservedDocuments.push(doc);
            }
        }
        await this.removeUnnecessaryDocuments(reservedDocuments);
        reservedDocuments.splice(0);
    }

    private async removeUnnecessaryDocuments(reservedDocuments: IDocument[]) {
        if (!reservedDocuments) {
            return;
        }
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const doc of loadedDocuments) {
            if (!reservedDocuments.includes(doc)) {
                await this.disposeDocument(doc);
                await BrowserCapabilities.yieldToMain();
            }
        }
    }

    private checkContainFullscreenElement = (doc: IDocument) => {
        return !!(doc?.getContentContainer()?.ownerDocument?.fullscreenElement);
    }

    private async disposeDocument(doc: IDocument) {
        if (this.checkContainFullscreenElement(doc)) {
            // cannot release documents with fullscreen elements
            return;
        }
        await doc.dispose();
    }
}
