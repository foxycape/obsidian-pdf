import { EventNames, IDocument, IEventEmitter } from "../../../kernal";
import logo from '../../logo-160x160.png';
import { emptyElement } from "../../html/dom";
import { IHtmlLoadLayer } from "./IHtmlLoadLayer";

export class HtmlLoadLayer implements IHtmlLoadLayer {
    private isVisible = false;
    private state: 'unset' | 'delay' | 'show' = 'unset';
    private timer: any;
    private totalImageCount?: number;
    private processedImageCount?: number;
    private wrapperContainer: HTMLElement;
    constructor(
        private readonly events: IEventEmitter,
    ) {
        this.bindEvents();
    }
    private doc: IDocument;
    setDoc(doc: IDocument): void {
        this.doc = doc;
        this.wrapperContainer = this.doc.getWrapperContainer();
    }

    loadLoadingLayer() {
        this.isVisible = true;
        this.renderLoadingLayer();
    };

    removeLoadingLayer() {
        this.isVisible = false;
        const layer = this.wrapperContainer.querySelector("div[data-type='loading-layer']");
        if (layer) {
            layer.parentElement.removeChild(layer);
        }
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.isVisible = false;
        this.state = 'unset';
        this.totalImageCount = undefined;
        this.processedImageCount = undefined;
    };

    async dispose(): Promise<void> {
        this.unbindEvents();
        this.removeLoadingLayer();
    };

    private bindEvents() {
        this.events.on(EventNames.ProcessedImageCount, this.onProcessedImageCount);
    };

    private unbindEvents() {
        this.events.off(EventNames.ProcessedImageCount, this.onProcessedImageCount);
    };

    setReloadButton() {
        emptyElement(this.wrapperContainer);
        const root = this.wrapperContainer.ownerDocument.createElement("div");
        root.style.cssText = "width:100%;height:100%;min-height: inherit;display: flex;justify-content: center;align-items: center;flex-direction: column;";

        const message = this.wrapperContainer.ownerDocument.createElement("div");
        message.style.cssText = "color:#666666;font-size: 14px;";
        message.textContent = "Load failed";

        const reloadButton = this.wrapperContainer.ownerDocument.createElement("div");
        reloadButton.className = "reload_button";
        reloadButton.style.cssText = "font-size: 16px;margin-block-start: 10px;background: #14ae5c;color: #fff;padding: 5px 10px;border-radius: 4px;cursor: pointer;";
        reloadButton.textContent = "Reload";
        reloadButton.addEventListener("click", async () => {
            await this.doc.load();
        });

        root.append(message, reloadButton);
        this.wrapperContainer.appendChild(root);
    };

    private onProcessedImageCount({ processedImageCount, totalImageCount }: { processedImageCount: number; totalImageCount: number }) {
        this.totalImageCount = totalImageCount;
        this.processedImageCount = processedImageCount;
        this.renderLoadingLayer();
    };

    private renderLoadingLayer() {
        if (!this.isVisible) {
            return;
        }
        if (this.state == 'unset') {
            this.state = 'delay';
        }
        const displayLogo = this.state == 'show';
        let layer = this.wrapperContainer.querySelector("div[data-type='loading-layer']");
        if (!layer) {
            emptyElement(this.wrapperContainer);
            this.wrapperContainer.appendChild(this.createLoadingLayer(displayLogo, this.totalImageCount, this.processedImageCount));
            if (this.timer) {
                clearTimeout(this.timer);
            }
            this.timer = setTimeout(() => {
                this.state = 'show';
                this.renderLoadingLayer();
            }, 2000);
        }
        else {
            emptyElement(this.wrapperContainer);
            this.wrapperContainer.appendChild(this.createLoadingLayer(displayLogo, this.totalImageCount, this.processedImageCount));
        }
    };

    private createLoadingLayer(displayLogo: boolean, totalImageCount?: number, processedImageCount?: number) {
        const doc = this.wrapperContainer.ownerDocument;
        const loadingLayer = doc.createElement("div");
        loadingLayer.setAttribute("data-type", "loading-layer");
        loadingLayer.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;min-height: inherit;display: flex;justify-content: center;align-items: center;flex-direction:column";

        const content = doc.createElement("div");
        content.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            width: fit-content;
            height: fit-content;
            background: rgba(0, 0, 0, 0.05);
            color: #666;
            border-radius: 10px;
            padding: 20px;
            gap: 10px;`;

        if (displayLogo) {
            const img = doc.createElement("img");
            img.src = logo;
            img.style.cssText = "width:32px;height:32px;";
            content.appendChild(img);
        }

        const text = doc.createElement("div");
        text.style.cssText = "font-size: 14px;";
        text.textContent = processedImageCount
            ? "Processing images" + processedImageCount + "/" + totalImageCount
            : "Loading...";
        content.appendChild(text);
        loadingLayer.appendChild(content);
        return loadingLayer;
    };
}
