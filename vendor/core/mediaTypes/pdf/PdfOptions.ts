/**
 * PDF options.
 */
export class PdfOptions {

    /** Custom pdf cMapUrl absolute address or relative address to pdf.worker.js */
    cMapUrl: string;
    /** Custom pdf standardFontDataUrl absolute address or relative address to pdf.worker.js */
    standardFontDataUrl: string;

    /**
     * Text layer mode:
     * - 0: no text layer
     * - 1: pdf.js span text layer
     * - 2: custom SVG text layer (PdfSvgBuilder)
     */
    textLayerMode: number = 2;

    /** Annotation mode: 0-disable, 1-enable, 2-ENABLE_FORMS, 3-ENABLE_STORAGE */
    annotationMode: number = 2;

    /**
     * Annotation edit mode DISABLE: -1, NONE: 0, FREETEXT: 3, HIGHLIGHT: 9, STAMP: 13, INK: 15
     */
    annotationEditorMode: number = 0;

    scaleValue: string = "auto";

    /** Whether to remove the middle border when double page layout */
    removeHorizonalMargin: boolean = false;

    horizontalPadding: number;
    verticalPadding: number;

    /** Whether to reset the page scale after flipping, to solve the problem of too large or too small display due to different page sizes */
    resetScaleAfterPageChanged: boolean;

    /** Whether to enable pdf password input prompt */
    showPasswordPrompt: boolean;
}
