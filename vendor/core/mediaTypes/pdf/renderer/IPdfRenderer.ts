
import { IFileParser, INavPointNavigator, INavPointProvider, IPagingNavigator, IRenderer } from "../../../kernal";
import { IPdfDocument } from "./IPdfDocument";
import { IPdfRendererLayout } from "./layout/IPdfRendererLayout";
import { IPdfScalable } from "./zoom/IPdfScalable";
import { IPdfFileParser } from "../fileParser/IPdfFileParser";
import { IPdfProgressTracker } from "./progress/IPdfProgressTracker";
import type * as pdfjsLib from "../../../pdfjs/legacy/build/pdf.mjs";
import type * as pdfjsViewer from "../../../pdfjs/legacy/web/pdf_viewer.mjs";

export interface IPdfRenderer<T extends IPdfDocument = IPdfDocument, W extends IFileParser = IPdfFileParser> extends IRenderer<T, W> {
     get progressTracker(): IPdfProgressTracker;
     get navPointProvider(): INavPointProvider;
     get navPointNavigator(): INavPointNavigator;
     /**
      * Navigator for page numbers.
      */
     get pagingNavigator(): IPagingNavigator | undefined;
     /**
      * Get the scalable interface.
      */
     get scalable(): IPdfScalable;

     /**
      * Get the layout interface.
      */
     get layout(): IPdfRendererLayout;

     get numberOfPages(): number;

     get currentPage(): number;
     set currentPage(value: number);

     /**
      * Update the current page index.
      * When `scroll` is false, only syncs the page number (no viewport jump).
      */
     setCurrentPage(pageNumber: number, scroll?: boolean): void;

     getPageViews(): pdfjsViewer.PDFPageView[];

     getPageView(pageNumber: number): pdfjsViewer.PDFPageView | undefined;

     /**
      * Build a PDF destination string.
      * @param pageNumber 
      * @param options 
      */
     buildDest(pageNumber: number, options?: 'current' | { x: number, y: number }): string

     /** pdf.js EventBus used by the viewer stack. */
     getEventBus(): pdfjsViewer.EventBus;

     /** Standalone PDFFindController used for document text search. */
     getFindController(): pdfjsViewer.PDFFindController;

     /** Resolve a page proxy even if the page view has not rendered yet. */
     getPdfPage(pageNumber: number): Promise<pdfjsLib.PDFPageProxy | undefined>;
}
