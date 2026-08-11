import type { IPdfRendererLayout, PdfScrollMode, PdfSpreadMode } from "./IPdfRendererLayout";
import type { MultiPDFViewer } from "../MultiPdfViewer";
import { IEventEmitter } from "../../../../kernal/IEventEmitter";
import { EventNames } from "../../../../kernal/EventNames";

export class PdfRendererLayout implements IPdfRendererLayout {
    constructor(private readonly pdfViewer: MultiPDFViewer, private readonly events: IEventEmitter) { }

    get scrollMode(): PdfScrollMode {
        // scrollMode 0-vertical，1-horizontal
        return this.pdfViewer.scrollMode === 1 ? "horizontal" : "vertical";
    }

    get spreadMode(): PdfSpreadMode {
        // spreadMode 0-single，1-double，2-doubleBook
        const mode = this.pdfViewer.spreadMode;
        return mode === 1 ? "double" : mode === 2 ? "doubleBook" : "single";
    }

    changeScrollMode(direction: PdfScrollMode): void {
        //scrollMode 0-vertical，1-horizontal，2-doublePage，3-singlePage
        var previous = this.pdfViewer.scrollMode;
        this.pdfViewer.scrollMode = direction === "horizontal" ? 1 : 0;
        this.events.emit(EventNames.LayoutChange, { scrollMode: { previous, current: this.pdfViewer.scrollMode } });
    }

    changeSpreadMode(spreadMode: PdfSpreadMode): void {
        //spreadMode 0-single，1-double，2-doubleBook
        var previous = this.pdfViewer.spreadMode;
        this.pdfViewer.spreadMode = spreadMode === "single" ? 0 : spreadMode === "double" ? 1 : 2;
        this.events.emit(EventNames.LayoutChange, { spreadMode: { previous, current: this.pdfViewer.spreadMode } });
    }

    rotatePages(delta: number): void {
        var previous = this.pdfViewer.pagesRotation;
        this.pdfViewer.pagesRotation += delta;
        this.events.emit(EventNames.LayoutChange, { rotation: { previous, current: this.pdfViewer.pagesRotation } });
    }
}
