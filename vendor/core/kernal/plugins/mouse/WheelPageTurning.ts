import { BrowserCapabilities } from "../../web/BrowserCapabilities";
import { EventNames } from "../../EventNames";
import { compareTagName } from "../../html/finder";
import type { IDocument } from "../../IDocument";
import type { LocationFrom } from "../../progress/Progress";
import type { Reader } from "../../Reader";
import { PluginCore } from "../PluginCore";
import { FlipMode } from "../../types";

export type WheelPageTurningOptions = {
    pageTurnInterval?: number;
    flipMode?: FlipMode;
};

/**
 * Interactive plugin: mouse wheel page navigation.
 */
export class WheelPageTurning extends PluginCore {
    private readonly pluginOptions: Required<WheelPageTurningOptions>;
    private readonly userEvents: string[] = ["wheel", "keydown", "mousedown", "touchstart"];
    private readonly falsePassiveOpts: AddEventListenerOptions & EventListenerOptions = { passive: BrowserCapabilities.supportPassive() };
    private readonly injectedElements = new Set<Element>();
    private enableWheel = true;
    private currentEnableWheel = true;
    private wheelTimeoutId: ReturnType<typeof setTimeout> | undefined;

    constructor(reader: Reader, options?: WheelPageTurningOptions) {
        super(reader, options);
        this.pluginOptions = {
            pageTurnInterval: options?.pageTurnInterval ?? 300,
            flipMode: options?.flipMode ?? "page",
        };
    }

    get name(): string {
        return "wheel-page-turning";
    }

    get title(): string {
        return "Wheel Page Turning";
    }

    get description(): string {
        return "Mouse wheel page flip navigation";
    }

    get version(): string {
        return "1.0.0";
    }

    get supportedVersion(): string {
        return ">=1.0.0";
    }

    get supportedExtensions(): string[] {
        return [".xml", ".xhtml", ".html",".epub",".mobi",".azw3",".fb2",".txt"];
    }

    get supportedLanguages(): string[] {
        return ["*"];
    }

    get isUIPlugin(): boolean {
        return false;
    }

    getContainer(): HTMLElement | undefined {
        return undefined;
    }

    toggleWheel(enable: boolean) {
        this.enableWheel = enable;
    }

    async load(): Promise<void> {
        const readerContainer = this.reader.getReaderContainer();
        if (readerContainer) {
            this.addScrollListener([readerContainer]);
        }

        const rendererContainer = this.reader.getRenderer()?.getRendererContainer?.();
        if (rendererContainer && rendererContainer !== readerContainer) {
            this.addScrollListener([rendererContainer]);
        }

        const documents = this.reader.getRenderer()?.getLoadedDocuments?.()
            ?? this.reader.getRenderer()?.getDocuments?.()
            ?? [];
        for (const doc of documents) {
            this.bindDocument(doc);
        }

        this.reader.events.on(EventNames.DocumentLoad, this.onDocumentLoad);
        this.reader.events.on(EventNames.DocumentDisposing, this.onDocumentDisposing);
    }

    async dispose(): Promise<void> {
        this.reader.events.off(EventNames.DocumentLoad, this.onDocumentLoad);
        this.reader.events.off(EventNames.DocumentDisposing, this.onDocumentDisposing);

        if (this.wheelTimeoutId !== undefined) {
            clearTimeout(this.wheelTimeoutId);
            this.wheelTimeoutId = undefined;
        }

        this.removeScrollListener([...this.injectedElements]);
        this.enableWheel = true;
        this.currentEnableWheel = true;
    }

    private onDocumentLoad = (doc: IDocument) => {
        this.bindDocument(doc);
    };

    private onDocumentDisposing = (doc: IDocument) => {
        const contentContainer = doc.getContentContainer();
        const documentElement = contentContainer?.ownerDocument?.documentElement;
        const wrapperContainer = doc.getWrapperContainer?.();
        const elements: Element[] = [];
        if (documentElement) {
            elements.push(documentElement);
        }
        if (wrapperContainer) {
            elements.push(wrapperContainer);
        }
        if (elements.length > 0) {
            this.removeScrollListener(elements);
        }
    };

    private bindDocument(doc: IDocument): void {
        const contentContainer = doc.getContentContainer();
        const documentElement = contentContainer?.ownerDocument?.documentElement;
        const wrapperContainer = doc.getWrapperContainer?.();
        const elements: Element[] = [];
        if (documentElement) {
            elements.push(documentElement);
        }
        if (wrapperContainer && wrapperContainer !== documentElement) {
            elements.push(wrapperContainer);
        }
        if (elements.length > 0) {
            this.addScrollListener(elements);
        }
    }

    private addScrollListener(elements: Element[]): void {
        elements.forEach((element) => {
            if (this.injectedElements.has(element)) {
                return;
            }
            this.userEvents.forEach((eventType) => {
                if (eventType == "wheel") {
                    element.addEventListener("wheel", this.handleWheel, this.falsePassiveOpts);
                }
                else {
                    element.addEventListener(eventType, this.updateShouldUpdateProgress, this.falsePassiveOpts);
                }
            });
            this.injectedElements.add(element);
        });
    }

    private removeScrollListener(elements: Element[]): void {
        elements.forEach((element) => {
            if (!this.injectedElements.has(element)) {
                return;
            }
            this.userEvents.forEach((eventType) => {
                if (eventType == "wheel") {
                    element.removeEventListener("wheel", this.handleWheel, this.falsePassiveOpts);
                }
                else {
                    element.removeEventListener(eventType, this.updateShouldUpdateProgress, this.falsePassiveOpts);
                }
            });
            this.injectedElements.delete(element);
        });
    }

    private updateShouldUpdateProgress = (e: Event) => {
        let from: LocationFrom = undefined;
        if (e.type == "keydown") {
            from = "keyboard";
        }
        else if (e.type == "wheel") {
            from = "wheel";
        }
        else if (e.type == "mousedown" || e.type == "mousemove") {
            from = "mouse";
        } else if (e.type == "touchstart") {
            from = "touch";
        }
        this.reader.context?.setUserChangedProgress(true, from);
    };

    private handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey) {
            return;
        }
        this.updateShouldUpdateProgress(e);

        if (this.reader.context.currentLocation) {
            this.reader.context.currentLocation.precise = false;
        }

        const available = this.pluginOptions.flipMode == "page"
            && this.enableWheel
            && this.currentEnableWheel;

        e.stopImmediatePropagation();

        let delta = 0;
        if (!(e.deltaMode === 0 && Math.abs(e.deltaX) < 4 && Math.abs(e.deltaY) < 4)) {
            delta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        }

        if (available && delta !== 0) {
            void this.onWheelFlip(delta, e);
        }

        if (this.currentEnableWheel) {
            this.currentEnableWheel = false;
            this.wheelTimeoutId = setTimeout(() => {
                this.currentEnableWheel = true;
            }, this.pluginOptions.pageTurnInterval);
        }
    };

    private onWheelFlip = async (delta: number, e: WheelEvent) => {
        const target = e.target as HTMLElement;
        if (compareTagName(target?.tagName, "PRE")) {
            if (Math.abs(target.clientHeight - target.scrollHeight) > 10) {
                return;
            }
        }
        else if (compareTagName(target?.tagName, "CODE")) {
            if (Math.abs(target.clientHeight - target.scrollHeight) > 10) {
                return;
            }
            if (target.parentElement && Math.abs(target.parentElement.clientHeight - target.parentElement.scrollHeight) > 10) {
                return;
            }
        }

        const renderer = this.reader.getRenderer() as any;
        if (delta < 0) {
            if (renderer?.pagingNavigator) {
                await renderer.pagingNavigator.gotoPreviousPage({ trigger: "user", triggerType: "wheel" });
                return;
            }
            await renderer?.gotoPreviousPage?.({ trigger: "user", triggerType: "wheel" });
            return;
        }

        if (renderer?.pagingNavigator) {
            await renderer.pagingNavigator.gotoNextPage({ trigger: "user", triggerType: "wheel" });
            return;
        }
        await renderer?.gotoNextPage?.({ trigger: "user", triggerType: "wheel" });
    };
}
