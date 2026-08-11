export interface IPdfRendererLayout {
    /** Current scroll direction. */
    get scrollMode(): PdfScrollMode;

    /** Current page spread mode. */
    get spreadMode(): PdfSpreadMode;

    /**
     * Change the scroll mode of the document.
     */
    changeScrollMode(direction: PdfScrollMode): void;

    /**
     * Change the spread mode of the document.
     */
    changeSpreadMode(spreadMode: PdfSpreadMode): void;

    /**
     * Rotate the pages of the document.
     * @param delta - degrees: -90, 0, 90, 180, 270
     */
    rotatePages(delta: number): void;
};

export type PdfScrollMode = "horizontal" | "vertical";
export type PdfSpreadMode = 'single' | 'double' | 'doubleBook';
