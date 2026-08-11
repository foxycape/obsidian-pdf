import { ILoading, LoadingOptions } from "./ILoading";
import { getRandomId } from "../../common/uuid";
import { createElement, existsElement, injectCssContent } from "../../html/injector";
import { ILocale } from "../../i18n/ILocale";
export class DefaultLoading implements ILoading {
    private container: HTMLElement;
    constructor(private readonly locale: ILocale) { }
    // readonly curentCssName = "line-scale-pulse-out-rapid";
    private readonly curentCssName = "line-scale-pulse-out";
    private readonly loadingTextMarginTop = 0;
    private loaderIds = new Map<HTMLElement, string>();
    private options?: LoadingOptions;
    async initialize(container: HTMLElement,options: LoadingOptions): Promise<void> {
        this.options = options;
        this.container = container;
        const loaderId = getRandomId(true);
        this.loaderIds.set(container, loaderId)
        if (this.container) {
            if (!existsElement(container.ownerDocument, "loader-css")) {
                const css = "@keyframes line-scale-pulse-out{0%{transform:scaley(1)}50%{transform:scaley(0.4)}100%{transform:scaley(1)}}.line-scale-pulse-out>div{background-color:#fff;width:4px;height:35px;border-radius:2px;margin:2px;animation-fill-mode:both;display:inline-block;animation:line-scale-pulse-out .9s -.6s infinite cubic-bezier(0.85, 0.25, 0.37, 0.85)}.line-scale-pulse-out>div:nth-child(2),.line-scale-pulse-out>div:nth-child(4){animation-delay:-.4s !important}.line-scale-pulse-out>div:nth-child(1),.line-scale-pulse-out>div:nth-child(5){animation-delay:-.2s !important}"
                injectCssContent(container.ownerDocument, css, false, "loader-css");
            }
            let backgroundColor = "#fff"
            let iconColor = "#14ae5c"   
            if (!(options?.disableLoadingTheme)) {
                backgroundColor = options?.backgroundColor ?? "#fff";
                iconColor = options?.iconColor ?? "#14ae5c";
            }
            injectCssContent(container.ownerDocument, ".loader{background:" + backgroundColor + ";position:absolute;z-index:2;width:100%;height: 100%;box-sizing: border-box;display: flex;-ms-flex: 0 1 auto;flex: 0 1 auto;flex-direction: column;flex-grow: 1;flex-shrink: 0;flex-basis: 25%;-ms-flex-align: center;align-items: center;justify-content: center;}." + this.curentCssName + ">div{background-color:" + iconColor + " !important}", true, "loaders.min.css-content");
        }
    }
    async show(text?: string): Promise<void> {
        if (!this.container)
            return;
        const loaderId = this.loaderIds.get(this.container);
        let loadingContainer = this.container.ownerDocument.getElementById(loaderId);
        if (loadingContainer) {
            const loadingText = text ? text : this.getDefaultLoadingText();
            const textLayer = loadingContainer.querySelector(".loading-holder")
            if (textLayer && loadingText) {
                textLayer.textContent = loadingText
            }
            return;
        }
        else {
            let textColor = "#333";
            if (!(this.options?.disableLoadingTheme)) {
                textColor = this.options?.textColor ?? "#333";
            }
            const loadingText = text ? text : this.getDefaultLoadingText();
            loadingContainer = createElement(this.container.ownerDocument, "div", loaderId, "loader");

            const pulse = this.container.ownerDocument.createElement("div");
            pulse.className = this.curentCssName;
            for (let i = 0; i < 6; i++) {
                pulse.appendChild(this.container.ownerDocument.createElement("div"));
            }

            const textLayer = this.container.ownerDocument.createElement("div");
            textLayer.className = "loading-holder";
            textLayer.style.cssText = `font-size: 16px;color: ${textColor};margin-block-start: ${this.loadingTextMarginTop}px;`;
            textLayer.textContent = loadingText;

            loadingContainer.append(pulse, textLayer);
            this.container.insertAdjacentElement("afterbegin", loadingContainer);
        }
    }

    private getDefaultLoadingText = () => {
        let loadingText = "loading...";
        if (this.locale) {
            loadingText = this.locale.getText("share_loading_text", "loading...")
        }
        return loadingText;
    }

    async hide(): Promise<void> {
        if (!this.container)
            return;
        const loaderId = this.loaderIds.get(this.container);
        const loadingContainer = this.container.ownerDocument.getElementById(loaderId);
        if (loadingContainer) {
            loadingContainer.parentElement.removeChild(loadingContainer);
        }
    }

}
