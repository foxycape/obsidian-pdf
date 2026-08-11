import { asyncDebounce, Context, EventNames, IDisposable, IDocumentsProvider, IEventEmitter, IProgressTracker } from "../../../../kernal";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { IHtmlRendererLayout } from "../layout/IHtmlRendererLayout";
import { HtmlSettings } from "../../HtmlSettings";

export class HtmlDocumentsResizeObserver implements IDisposable {
    private rendererContainerResizeObserver: ResizeObserver;
    private readonly rendererContainer: HTMLElement;
    private readonly context: Context;
    private readonly events: IEventEmitter;
    constructor(
        private readonly documentsProvider: IDocumentsProvider,
        private readonly rendererViewport: IRendererViewport<HtmlLayoutMetrics>,
        private readonly progressTracker: IProgressTracker,
        private readonly rendererLayout: IHtmlRendererLayout
    ) {
        this.rendererContainer = this.documentsProvider.getRendererContainer();
        this.context = this.documentsProvider.owner.context;
        this.events = this.documentsProvider.owner.events;
    }

    register() {
        this.rendererContainerResizeObserver = new ResizeObserver(async entries => {
            // this.logger.debug("rendererContainerResizeObserver...", 'entries', entries);
            const entry = entries[0]
            const target = entry.target as HTMLElement;
            const originWidth = parseFloat(target.getAttribute("data-client-width"));
            const originHeight = parseFloat(target.getAttribute("data-client-height"));
            const currentWidth = entry.contentRect?.width ?? entry.borderBoxSize[0].inlineSize ?? 0;
            const currentHeight = entry.contentRect?.height ?? entry.borderBoxSize[0].blockSize ?? 0;
            if (originWidth == currentWidth && originHeight == currentHeight) {
                // this.logger.debug("rendererContainerResizeObserver...", 'size not change');
                return;
            }
            this.rendererContainer.setAttribute("data-client-width", `${currentWidth}`)
            this.rendererContainer.setAttribute("data-client-height", `${currentHeight}`)
            // this.logger.debug("onWindowResize", 'currentLocation', this.runtime.context.resource.currentLocation, 'json', JSON.stringify(this.runtime.context.resource.currentLocation));

            if (!this.context?.currentLocation?.precise) {
                const progress = await this.progressTracker.getProgress(true)
                if (progress) {
                    this.context.currentLocation = progress.location;
                }
            }
            this.context.setUserChangedProgress(false)
            await this.delayResizeRendererContainer();
        });

        this.rendererContainerResizeObserver.observe(this.rendererContainer);
    }

    protected resizeRendererContainer = async () => {
        if (!this.context) {
            return;
        }
        // The container is hidden, for example, using display:none 
        if (this.rendererContainer.clientWidth == 0 || this.rendererContainer.clientHeight == 0) {
            if (this.rendererContainer["lhx_pdf_hidden"]) {
                // The label changed when it was hidden
                this.rendererContainer["lhx_pdf_require_resize"] = 'true'
            }
            this.rendererContainer["lhx_pdf_hidden"] = 'true'
            return;
        }

        // The container is hidden and then restored for the first time
        if (this.rendererContainer.clientWidth > 0 && this.rendererContainer.clientHeight > 0) {
            if (this.rendererContainer["lhx_pdf_hidden"]) {
                this.rendererContainer["lhx_pdf_hidden"] = undefined;
                if (!this.rendererContainer["lhx_pdf_require_resize"]) {
                    return;
                }
                this.rendererContainer["lhx_pdf_require_resize"] = undefined
            }
        }
        this.rendererViewport.applyCssVariables();
        await this.rendererLayout.applyStyles();
        // Column metrics changed: drop cached page counts so reload remaps against the new layout.
        for (const doc of this.documentsProvider.getLoadedDocuments()) {
            doc.getContentContainer()?.ownerDocument?.documentElement
                ?.removeAttribute(HtmlSettings.HtmlDocumentNumperOfPagesPropertyName);
        }
        await this.documentsProvider.reload();
        this.events.emit(EventNames.RendererContainerSizeChange, this.rendererContainer, this.context.userChangedProgress);
    }

    protected delayResizeRendererContainer = asyncDebounce(this.resizeRendererContainer, 100)

    async dispose(): Promise<void> {
        this.rendererContainerResizeObserver?.disconnect();
    }
}   