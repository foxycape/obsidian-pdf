import { EventNames, FileLocation, Progress, throttle } from "../../../../kernal";
import { IPdfDocumentsProvider } from "../documents/IPdfDocumentsProvider";
import { IPdfDestinationBuilder } from "../location/IPdfDestinationBuilder";
import type { MultiPDFViewer } from "../MultiPdfViewer";
import type { IPdfProgressTracker } from "./IPdfProgressTracker";
import * as pdfjsViewer from "../../../../pdfjs/legacy/web/pdf_viewer.mjs";

export class PdfProgressTracker implements IPdfProgressTracker {
    constructor(
        private readonly documentsProvider: IPdfDocumentsProvider,
        private readonly pdfViewer: MultiPDFViewer,
        private readonly destinationBuilder: IPdfDestinationBuilder,
    ) {
    }

    async getProgress(precise?: boolean): Promise<Progress> {
        if (!precise) {
            return this.documentsProvider.owner.context.progress;
        }

        const totalPercentage = this.getTotalPercentage();
        if (totalPercentage == null) {
            return;
        }

        const progress = new Progress(1, totalPercentage);
        const doc = this.documentsProvider.getFirstVisibleDocument();
        if (!doc) {
            return null;
        }

        const page = doc.getContentContainer();
        if (!page) {
            return null;
        }

        const pageRect = page.getBoundingClientRect();
        let x = pageRect.left;
        if (x >= 0) {
            x = 0;
        }
        if (x < 0) {
            x = Math.abs(x);
        }
        let y = pageRect.top;
        if (y >= 0) {
            y = 0;
        }
        if (y < 0) {
            y = Math.abs(y);
        }

        const location = new FileLocation(doc.url, this.pdfViewer.pagesCount, "page");
        const dest = this.destinationBuilder.buildDest(parseInt(doc.url), { x, y });
        if (!dest) {
            return null;
        }

        let locationPage = parseInt(doc.url);
        if (isNaN(locationPage)) {
            locationPage = this.pdfViewer.currentPageNumber;
        }
        location.visualPage = this.pdfViewer.currentPageNumber;
        location.pdfDest = dest;
        location.precise = true;
        location.ignoreOverlayHeader = true;
        location.scrollBehavior = "smooth";
        location.current = locationPage;

        const textContent = page.textContent?.replace(/\s+/g, " ").trim() ?? "";
        location.text = textContent.slice(0, 64);
        progress.location = location;
        return progress;
    }

    updateFromPageChange(): void {
        this.delayUpdateProgress();
    }

    async dispose(): Promise<void> {
    }

    private getTotalPercentage = () => {
        if (!this.pdfViewer) {
            return null;
        }
        let totalPercentage = this.pdfViewer.currentPageNumber / this.pdfViewer.pagesCount;
        const scrollElement = this.documentsProvider.getScrollElement();
        if (scrollElement) {
            const scrollTop = scrollElement.scrollTop;
            const scrollHeight = scrollElement.scrollHeight;
            const clientHeight = scrollElement.clientHeight;
            const scrollPercentage = (clientHeight + scrollTop) / scrollHeight;
            if (scrollPercentage >= Progress.Max) {
                totalPercentage = 1;
            }
        }
        // Last spread pair: viewing the second-to-last page already shows the final page.
        if (
            this.pdfViewer.spreadMode !== pdfjsViewer.SpreadMode.NONE &&
            this.pdfViewer.currentPageNumber + 1 == this.pdfViewer.pagesCount
        ) {
            totalPercentage = 1;
        }
        return totalPercentage;
    };

    private updateProgress = (specifiedProgress?: Progress) => {
        if (!this.pdfViewer) {
            return;
        }
        if (!this.documentsProvider.owner.context.userChangedProgress) {
            return;
        }
        const totalPercentage = this.getTotalPercentage();
        if (totalPercentage == null) {
            return;
        }
        let progress = specifiedProgress;
        if (!progress) {
            progress = new Progress(1, totalPercentage);
            const firstDocumentLocation = new FileLocation(
                this.pdfViewer.currentPageNumber.toString(),
                this.pdfViewer.pagesCount,
                "page",
            );
            firstDocumentLocation.current = this.pdfViewer.currentPageNumber;
            progress.location = firstDocumentLocation;

            this.documentsProvider.owner.context.progress = progress;
            this.documentsProvider.owner.context.currentLocation = progress.location;

            if (this.documentsProvider.owner.onProgressChangeGuard) {
                const allowContinue = this.documentsProvider.owner.onProgressChangeGuard(progress.current);
                if (!allowContinue) {
                    return;
                }
            }
        }

        this.documentsProvider.owner.events.emit(EventNames.ProgressChange, progress);
    };

    private delayUpdateProgress = throttle(this.updateProgress, 300, true);
}
