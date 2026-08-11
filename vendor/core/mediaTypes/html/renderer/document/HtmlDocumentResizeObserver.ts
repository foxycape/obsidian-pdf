import { EventNames, IEventEmitter } from "../../../../kernal";
import { IHtmlDocument } from "../IHtmlDocument";

export class HtmlDocumentResizeObserver {
    private resizeObserver: ResizeObserver | null = null;
    constructor(private readonly doc: IHtmlDocument,
        private readonly events: IEventEmitter
    ) {
    }

    observeIframeSize(callback?: () => Promise<void>) {
        this.resizeObserver = new ResizeObserver(async () => {
            let currentRequireResetSizes = true;
            if (!currentRequireResetSizes) {
                return;
            }
            await callback?.();
            this.events.emit(EventNames.DocumentSizeChange, this.doc);
        });
        const rootContainer = this.getContentRootElement();
        if (rootContainer) {
            this.resizeObserver.observe(rootContainer);
        }
        const contentContainer = this.doc.getContentContainer();
        if (contentContainer && contentContainer != rootContainer) {
            this.resizeObserver.observe(contentContainer);
        }
    }

    unobserveIframeSize() {
        if (this.resizeObserver) {
            const rootContainer = this.getContentRootElement();
            if (rootContainer) {
                this.resizeObserver.unobserve(rootContainer);
            }
            const contentContainer = this.doc.getContentContainer();
            if (contentContainer && contentContainer != rootContainer) {
                this.resizeObserver.unobserve(contentContainer);
            }
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }

    private getContentRootElement(): HTMLElement {
        if (this.doc.inIframe) {
            return this.doc?.getContentContainer()?.ownerDocument?.documentElement;
        }
        return this.doc.getWrapperContainer();
    }
}