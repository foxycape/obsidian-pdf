export type IPdfScalable = {
    /**
     * Get current scale value. It is a string like "100%", "150%", "page-fit", "auto", etc.
     */
    get currentScaleValue(): string;
    /**
     * Get current numeric scale.
     */
    get currentScale(): number;

    /**
     * Scale the document to the specified value.
     * @param value - e.g. "100%", "150%", "page-fit", "page-width", "auto"
     */
    scaleTo(value: string): Promise<void>;

    /**
     * Zoom in the document.
     */
    zoomIn(steps?: number, scaleFactor?: number): Promise<void>;

    /**
     * Zoom out the document.
     */
    zoomOut(steps?: number, scaleFactor?: number): Promise<void>;

    /**
     * Reset zoom to default (auto).
     */
    zoomReset(): Promise<void>;
};
