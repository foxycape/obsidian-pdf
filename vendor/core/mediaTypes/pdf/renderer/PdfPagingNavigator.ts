import { FileLocation, IDocument, ILocale, INotifier, IPagingNavigator, PagingExtra } from "../../../kernal";
import { IPdfDocumentsProvider } from "./documents/IPdfDocumentsProvider";

/**
 * PDF page navigator.
 */
export class PdfPagingNavigator implements IPagingNavigator {
    constructor(
        private readonly locale: ILocale,
        private readonly notifier: INotifier,
        private readonly documentsProvider: IPdfDocumentsProvider,
    ) {
        
    }

    async dispose(): Promise<void> {
        //
    }

    async gotoPage(_doc: IDocument, pageNumber: number, _extra?: PagingExtra): Promise<boolean> {
        const location = new FileLocation(pageNumber.toString(), this.documentsProvider.numberOfPages, "page");
        location.current = pageNumber;
        await this.documentsProvider.load(location);
        return true;
    }

    async gotoNextPage(_extra?: PagingExtra): Promise<boolean> {
        const currentPageNumber = this.documentsProvider.currentPage;
        const numberOfPages = this.documentsProvider.numberOfPages;
        const isSpread = this.documentsProvider.isSpreadMode;
        if (currentPageNumber >= numberOfPages || (isSpread && currentPageNumber >= numberOfPages - 1)) {
            this.notifier.info(this.locale?.getText("navigotor_alreadyislastpage", "Already at the last page"));
            return false;
        }
        let goingPageNumber = isSpread ? currentPageNumber + 2 : currentPageNumber + 1;
        if (goingPageNumber >= numberOfPages) {
            goingPageNumber = numberOfPages;
        }
        const location = new FileLocation(goingPageNumber.toString(), numberOfPages, "page");
        location.current = goingPageNumber;
        await this.documentsProvider.load(location);
        return true;
    }

    async gotoPreviousPage(_extra?: PagingExtra): Promise<boolean> {
        const currentPageNumber = this.documentsProvider.currentPage;
        const isSpread = this.documentsProvider.isSpreadMode;
        if (currentPageNumber <= 1 || (isSpread && currentPageNumber < 2)) {
            this.notifier.info(this.locale?.getText("navigotor_alreadyisfirstpage", "Already at the first page"));
            return false;
        }
        let goingPageNumber = isSpread ? currentPageNumber - 2 : currentPageNumber - 1;
        if (goingPageNumber <= 0) {
            goingPageNumber = 1;
        }
        const location = new FileLocation(goingPageNumber.toString(), this.documentsProvider.numberOfPages, "page");
        location.current = goingPageNumber;
        await this.documentsProvider.load(location);
        return true;
    }
}
