import { IPagingNavigator, FileLocation, ICoreNavigator, EventNames, PagingExtra, PageChangeOptions, ILogger, ILocale, IDocumentsProvider } from "../../../../kernal";
import type { Reader } from "../../../../kernal/Reader";
import { IHtmlDocument } from "../IHtmlDocument";
import { HtmlOptions } from "../../HtmlOptions";
import { IHtmlDocumentsProvider } from "../IHtmlDocumentsProvider";

export class HtmlPagingNavigator implements IPagingNavigator {
    protected logger: ILogger;
    private readonly owner: Reader;
    private readonly locale: ILocale;
    constructor(public readonly documentsProvider: IHtmlDocumentsProvider, public readonly htmlCoreNavigator: ICoreNavigator, private readonly options: HtmlOptions) {
        this.owner = documentsProvider.owner;
        this.locale = this.owner.locale;
        this.logger = this.owner.loggerFactory.getLogger(this.constructor.name);
    }
    async dispose(): Promise<void> {
        this.state = null;
    }
    private state: { doc: IHtmlDocument, pageNumber: number }
    async gotoPage(doc: IHtmlDocument, pageNumber: number, extra?: PagingExtra): Promise<boolean> {
        return await this.internalGotoPage(doc, pageNumber, null, extra);
    }

    private async internalGotoPage(doc: IHtmlDocument, pageNumber: number, direction?: 'next' | 'previous', extra?: PagingExtra): Promise<boolean> {
        if (this.options.flipMode == "scroll") {
            this.logger.warn(this.locale?.getText("unsupportTurnPageWhenScrolling", "Page turning is not supported in scroll mode"));
            return false;
        }
        // const firstVisibleDocument = this.renderer.getFirstVisibleDocument();
        // if (!firstVisibleDocument)
        //     return;
        await doc.load();
        const numberOfPages = await doc.getNumberOfPages();

        let location = new FileLocation(doc.url, numberOfPages, 'page');
        location.current = pageNumber;
        location.direction = direction;
        if (pageNumber <= 0) {
            const docs = this.documentsProvider.getDocuments();
            const index = docs.indexOf(doc);
            if (index == 0) {
                this.owner.notifier.info(this.locale.getText("navigotor_alreadyisfirstpage", 'Already at the first page'));
                return false;
            }
            const previousDocument = docs[index - 1];
            // this.logger.debug("url:", previousDocument.url, "previousDocument")
            await previousDocument.load();
            const previousDocumentNumberOfPages = await previousDocument.getNumberOfPages();
            location = new FileLocation(previousDocument.url, previousDocumentNumberOfPages, 'page');
            location.current = previousDocumentNumberOfPages;
            location.direction = 'previous';
            await this.htmlCoreNavigator.goto(location);
            await this.notify(previousDocument, previousDocumentNumberOfPages,extra);
            return true;
        }
        // this.logger.debug("url:", firstVisibleDocument.url, "gotoPage firstVisibleDocument");
        // await doc.load();

        if (pageNumber > numberOfPages) {
            const docs = this.documentsProvider.getDocuments();
            const index = docs.indexOf(doc);
            if (index == docs.length - 1) {
                this.owner.notifier.info(this.locale.getText("navigotor_alreadyislastpage", 'Already at the last page'));
                return false;
            }
            const nextDocument = docs[index + 1];
            await nextDocument.load();
            const nexDocumentNumberOfPages = await nextDocument.getNumberOfPages();
            location = new FileLocation(nextDocument.url, nexDocumentNumberOfPages, 'page');
            location.current = 1;
            location.direction = 'next';
            await this.htmlCoreNavigator.goto(location);
            await this.notify(nextDocument, 1,extra);
            return true;
        }

        await this.htmlCoreNavigator.goto(location);
        await this.notify(doc, pageNumber,extra);
        return true;
    }

    async gotoNextPage(extra?: PagingExtra): Promise<boolean> {
        if (this.options.flipMode == "scroll") {
            // this.logger.warn(this.locale.getText("unsupportTurnPageWhenScrolling", "Page turning is not supported in scroll mode"));
            return false;
        }
        let doc = this.documentsProvider.getFirstVisibleDocument();
        // let doc = this.renderer.getLastVisibleDocument();
        if (!doc) {
            const documents = this.documentsProvider.getDocuments();
            doc = documents[documents.length - 1];
        }
        await doc.load();
        const currentPageNumber = this.documentsProvider.getCurrentPageNumber(doc);
        this.state = { doc, pageNumber: currentPageNumber }
        const nextPageNumber = currentPageNumber + 1;
        return await this.internalGotoPage(doc, nextPageNumber, 'next', extra);
    }
    async gotoPreviousPage(extra?: PagingExtra): Promise<boolean> {
        if (this.options.flipMode == "scroll") {
            // this.logger.warn(this.locale.getText("unsupportTurnPageWhenScrolling", "Page turning is not supported in scroll mode"));
            return false;
        }
        // let doc = this.renderer.getFirstVisibleDocument();
        let doc = this.documentsProvider.getLastVisibleDocument();
        if (!doc) {
            const documents = this.documentsProvider.getDocuments();
            doc = documents[0];
        }
        await doc.load();
        const currentPageNumber = this.documentsProvider.getCurrentPageNumber(doc);
        this.state = { doc, pageNumber: currentPageNumber }
        const previousPageNumber = currentPageNumber - 1;
        // this.logger.debug('gotoPreviousPage', 'doc', doc, 'previousPageNumber', previousPageNumber)
        return await this.internalGotoPage(doc, previousPageNumber, 'previous', extra);
    }

    private notify = async (doc: IHtmlDocument, pageNumber: number, extra?: PagingExtra) => {
        const options = new PageChangeOptions();
        options.doc = doc;
        options.pageNumber = pageNumber;
        options.extra = extra;
        if (this.state) {
            const documents = this.documentsProvider.getDocuments();
            const stateDocIndex = documents.indexOf(this.state.doc);
            const currentDocIndex = documents.indexOf(doc);
            if (stateDocIndex == currentDocIndex) {
                if (pageNumber > this.state.pageNumber) {
                    options.direction = "next";
                }
                else {
                    options.direction = "previous";
                }
            }
            else {
                if (currentDocIndex > stateDocIndex) {
                    options.direction = "next";
                }
                else {
                    options.direction = "previous";
                }
            }
            this.owner.events.emit(EventNames.PageChange, options);
            this.state = { doc, pageNumber }
        }
        else {
            this.state = { doc, pageNumber }
            options.direction = "next";
            this.owner.events.emit(EventNames.PageChange, options);
        }
    }
}