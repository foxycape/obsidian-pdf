export interface IRendererViewport<T extends LayoutMetrics> {
    getRendererContainer(): HTMLElement;
    getScrollElement(): HTMLElement;
    getLayoutMetrics(): T;
    applyCssVariables(): void;
}

export class LayoutMetrics {
    /** visible width */
    clientWidth: number;
    /** visible height */
    clientHeight: number;
}
