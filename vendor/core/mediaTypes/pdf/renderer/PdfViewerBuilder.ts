import { MultiPDFViewer } from "./MultiPdfViewer";
import * as pdfjsViewer from "../../../pdfjs/legacy/web/pdf_viewer.mjs";
import { PdfOptions } from "../PdfOptions";
import { PdfNoopL10n } from "./PdfNoopL10n";

// const DEFAULT_MAX_MOBILE_CANVAS_PIXELS = 16777216;
const DEFAULT_MAX_CANVAS_PIXELS = 16777216;

export type PdfViewerBuildResult = {
    pdfViewer: MultiPDFViewer;
    eventBus: pdfjsViewer.EventBus;
    linkService: pdfjsViewer.PDFLinkService;
    findController: pdfjsViewer.PDFFindController;
    maxCanvasPixels: number;
    removePageBorders: boolean;
};

/**
 * Builds the pdf.js viewer stack (EventBus / LinkService / FindController / MultiPDFViewer).
 */
export class PdfViewerBuilder {
    constructor(
        private readonly options: PdfOptions,
    ) { }

    build(container: HTMLDivElement): PdfViewerBuildResult {
        const maxCanvasPixels = DEFAULT_MAX_CANVAS_PIXELS

        const eventBus = new pdfjsViewer.EventBus();
        const linkService = new pdfjsViewer.PDFLinkService({
            eventBus,
        });
        const findController = new pdfjsViewer.PDFFindController({
            linkService,
            eventBus,
        });
        const removePageBorders = false;
        // Intentionally omit findController on the viewer: TextHighlighter only
        // supports span text layers and would double-paint with foxycape-pdf
        // PdfSearchOverlay. Matching still runs via the standalone
        // findController + eventBus.
        const pdfViewer = new MultiPDFViewer(
            {
                container,
                eventBus,
                linkService,
                l10n: new PdfNoopL10n(),
                maxCanvasPixels,
                textLayerMode: this.options.textLayerMode == 1 ? 1 : 0,
                annotationMode: this.options.annotationMode,
                annotationEditorMode: this.options.annotationEditorMode,
                removePageBorders: removePageBorders,
            },
            this.options,
        );
        linkService.setViewer(pdfViewer);

        return {
            pdfViewer,
            eventBus,
            linkService,
            findController,
            maxCanvasPixels, 
            removePageBorders
        };
    }
}
