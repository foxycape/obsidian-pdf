import { LayoutMetrics } from "../../../../kernal/IRendererViewport";

export class HtmlLayoutMetrics extends LayoutMetrics {
    /**Page move width (column + column spacing) */
    pageMoveLength: number;
    /**Column width */
    columnWidth: number;
    /**Each page vertical height (regardless of writing direction) */
    columnHeight: number;
    /**Each page horizontal width (regardless of writing direction) */
    pageWidth: number;
    /**Each page vertical height (regardless of writing direction) */
    pageHeight: number;
    /**Column spacing */
    columnGap: number;
    /**Shadow layer width */
    shadowWidth: number;
}
