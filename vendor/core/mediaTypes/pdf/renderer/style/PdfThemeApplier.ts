import { Theme } from "../../../../kernal";
import { injectCssContent } from "../../../../kernal/html/injector";
import { IPdfThemeApplier } from "./IPdfThemeApplier";

export class PdfThemeApplier implements IPdfThemeApplier {
    constructor(
        private readonly readerContainer: HTMLElement,
    ) {
    }

    applyTheme(theme: Theme) {
        // Reader sets `body *{box-sizing:border-box}`. pdf.js sizes .page by viewport
        // (content) while --page-border is 9px; border-box would shrink the content box
        // by 18px and desync canvasWrapper from the canvas bitmap → blurry pages.
        
        // const selectionBackground =
        //     theme.selectionBackground || "rgba(255,213,0,0.35)";

        // Critical for text selection in host apps (Obsidian/Electron):
        // canvas can win hit-testing over transparent textLayer spans, so
        // getSelection() stays empty. Let pointer events pass through canvas,
        // keep textLayer above it, and force user-select on selectable text.
        // const canvasStyle=`.pdfViewer .canvasWrapper,
        // .pdfViewer .canvasWrapper canvas{
        //     pointer-events:none !important;
        //     z-index:0;
        // }`

        let css = `
        .pdfViewer .page{box-sizing:content-box;}
        .pdfViewer .page *{box-sizing:content-box;}

        .pdfViewer .textLayer{
            opacity:1 !important;
            z-index:1 !important;
            pointer-events:auto !important;
            -webkit-user-select:text !important;
            user-select:text !important;
        }
        .pdfViewer .textLayer :is(span,br){
            pointer-events:auto !important;
            -webkit-user-select:text !important;
            user-select:text !important;
        }
        /* Keep annotations above text for links; never let the editor layer steal hits when idle. */
        .pdfViewer .page .annotationLayer{
            z-index:2;
        }
        .pdfViewer .page .annotationEditorLayer{
            z-index:2;
            pointer-events:none !important;
        }
        .pdfViewer .page .annotationEditorLayer:not(.disabled):not([hidden]){
            pointer-events:auto !important;
        }
        .pdfViewer .textLayer ::selection,
        .pdfViewer .textLayer span::selection,
        .pdfViewer .page svg ::selection{
            background:var(${Theme.SelectionBackground}) !important;
            background-color:var(${Theme.SelectionBackground}) !important;
        }
        .pdfViewer .textLayer br::selection{
            background:transparent !important;
            background-color:transparent !important;
        }`;

        injectCssContent(this.readerContainer.ownerDocument, css, true, "pdf-renderer-other-css");
    }
}
