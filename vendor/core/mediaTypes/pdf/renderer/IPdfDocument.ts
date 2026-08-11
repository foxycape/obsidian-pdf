import { IDocument } from "../../../kernal";

/**
 * PDF page layout facts needed by consumers without exposing pdf.js PageView.
 */
export type PdfPageGeometry = {
    /** Raw page width from PDF viewBox (user space). */
    rawWidth: number;
    /** Raw page height from PDF viewBox (user space). */
    rawHeight: number;
    /** Page rotation in degrees: 0 | 90 | 180 | 270. */
    rotation: number;
    /** Displayed page width in CSS pixels. */
    displayWidth: number;
    /** Displayed page height in CSS pixels. */
    displayHeight: number;
    /** Bounding client rect of the page element. */
    pageRect: DOMRect;
    /** Reference to the page view. */
    ref:PdfPageRef
};

export type PdfPageRef = {
    num:number;
    gen:string
};

export interface IPdfDocument extends IDocument {
    /**
     * Get page geometry for coordinate mapping (no pdf.js types exposed).
     */
    getPageGeometry(): PdfPageGeometry | undefined;

    /** Current page number */
    get pageNumber(): number;

    /**
     * Actively resolve text-layer elements visible in the reader viewport.
     * @param fullVisibleInWindow when true, only fully contained elements are returned.
     */
    getVisibleElements(fullVisibleInWindow?: boolean): Element[];
}
