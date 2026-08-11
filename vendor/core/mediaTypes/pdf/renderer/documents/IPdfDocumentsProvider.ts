import { IFileParser, IDocumentsProvider } from "../../../../kernal";
import type { IPdfDocument } from "../IPdfDocument";
import { IPdfFileParser } from "../../fileParser/IPdfFileParser";
import type * as pdfjsViewer from "../../../../pdfjs/legacy/web/pdf_viewer.mjs";

export interface IPdfDocumentsProvider<T extends IPdfDocument = IPdfDocument,W extends IFileParser = IPdfFileParser> extends IDocumentsProvider<T,W> {
    getViewerContainer(): HTMLDivElement;
    get numberOfPages(): number;
    get currentPage(): number;
    set currentPage(value: number);
    /** Whether viewer is in double-page / book spread mode. */
    get isSpreadMode(): boolean;

    /** All page views currently held by the viewer. */
    getPageViews(): pdfjsViewer.PDFPageView[];

    /** Page view for a 1-based page number. */
    getPageView(pageNumber: number): pdfjsViewer.PDFPageView | undefined;
}
