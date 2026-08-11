import { EventNames, IDocument, IEventEmitter } from "../../../kernal";
import logo from '../../logo-160x160.png';
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
        let loadingLayer = '<div style="width:100%;height:100%;min-height: inherit;display: flex;justify-content: center;align-items: center;flex-direction: column;">';
        loadingLayer += '<div style="color:#666666;font-size: 14px;">Load failed</div>';
        loadingLayer += '<div class="reload_button" style="font-size: 16px;margin-block-start: 10px;background: #14ae5c;color: #fff;padding: 5px 10px;border-radius: 4px;cursor: pointer;">Reload</div>';
        loadingLayer += '</div>';
        this.wrapperContainer.innerHTML = loadingLayer;
        const reloadButton = this.wrapperContainer.querySelector(".reload_button");
        if (reloadButton) {
            reloadButton.addEventListener("click", async () => {
                await this.doc.load();
            });
        }
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
        const layerHtml = this.getLoadingLayer(displayLogo, this.totalImageCount, this.processedImageCount);
        let layer = this.wrapperContainer.querySelector("div[data-type='loading-layer']");
        if (!layer) {
            this.wrapperContainer.innerHTML = layerHtml;
            if (this.timer) {
                clearTimeout(this.timer);
            }
            this.timer = setTimeout(() => {
                this.state = 'show';
                this.renderLoadingLayer();
            }, 2000);
        }
        else {
            this.wrapperContainer.innerHTML = layerHtml;
        }
    };

    private getLoadingLayer(displayLogo: boolean, totalImageCount?: number, processedImageCount?: number) {
        const loadingContentStyle = `
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

        let loadingLayer = `<div data-type="loading-layer" style="position:absolute;top:0;left:0;width:100%;height:100%;min-height: inherit;display: flex;justify-content: center;align-items: center;flex-direction:column">`;
        loadingLayer += `<div style="${loadingContentStyle}">`;
        if (displayLogo) {
            loadingLayer += `<img src="${logo}" style="width:32px;height:32px;" />`;
        }
        loadingLayer += `<div style="font-size: 14px;">${(processedImageCount ? "Processing images" + processedImageCount + "/" + totalImageCount : "Loading...")}</div>`;
        loadingLayer += `</div></div>`;
        return loadingLayer;
    };
}
