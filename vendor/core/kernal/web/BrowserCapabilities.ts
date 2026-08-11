import "scheduler-polyfill";
import { uaParser } from "./ua";

/**
 * Browser detection and capability checks for the web runtime.
 */
export class BrowserCapabilities {
    private static readonly env = uaParser
    private static browserData: { name?: string; version?: string };
    private static currentIsSupportTouch: boolean;

    /** Whether the device supports touch input. */
    static isSupportTouch(): boolean {
        if (this.currentIsSupportTouch == undefined) {
            this.currentIsSupportTouch = "ontouchstart" in globalThis;
        }
        return this.currentIsSupportTouch;
    }

    private static currentHasFinePointer: boolean;
    private static currentHasCoarsePointer: boolean;
    private static currentCanHover: boolean;

    /**
     * Whether any pointing device is fine (mouse / trackpad).
     * Corresponds to CSS `@media (any-pointer: fine)`.
     * Prefer this over {@link isSupportTouch} on hybrid devices (touch laptops).
     */
    static hasFinePointer(): boolean {
        if (this.currentHasFinePointer == undefined) {
            this.currentHasFinePointer = this.matchesMedia("(any-pointer: fine)");
        }
        return this.currentHasFinePointer;
    }

    /**
     * Whether any pointing device is coarse (finger / stylus without hover).
     * Corresponds to CSS `@media (any-pointer: coarse)`.
     */
    static hasCoarsePointer(): boolean {
        if (this.currentHasCoarsePointer == undefined) {
            this.currentHasCoarsePointer = this.matchesMedia("(any-pointer: coarse)");
        }
        return this.currentHasCoarsePointer;
    }

    /**
     * Whether any input device can hover.
     * Corresponds to CSS `@media (any-hover: hover)`.
     */
    static canHover(): boolean {
        if (this.currentCanHover == undefined) {
            this.currentCanHover = this.matchesMedia("(any-hover: hover)");
        }
        return this.currentCanHover;
    }

    private static matchesMedia(query: string): boolean {
        return !!(globalThis.matchMedia && globalThis.matchMedia(query).matches);
    }

    static getBrowserName(): string {
        return this.getBrowserData().name;
    }

    static getBrowserVersion(): string {
        return this.getBrowserData().version;
    }

    private static getBrowserData() {
        if (this.browserData == undefined) {
            this.browserData = this.env.getBrowser();
        }
        return this.browserData;
    }

    static isIE(): boolean {
        const name = this.getBrowserName().toLowerCase();
        return name == "msie" || name == "ie";
    }

    static isChrome(): boolean {
        return (/Chrome/i.test(this.getBrowserName()));
    }

    static isEdge(): boolean {
        return (/Edge/i.test(this.getBrowserName()));
    }

    static isFirefox(): boolean {
        return (/Firefox/i.test(this.getBrowserName()));
    }

    static isSafari(): boolean {
        return (/Safari/i.test(this.getBrowserName()));
    }

    static isOpera(): boolean {
        return (/Opera/i.test(this.getBrowserName()));
    }

    private static isSupportWebAssembly: boolean;

    /** Whether WebAssembly is supported. */
    static supportWebAssembly(): boolean {
        if (this.isSupportWebAssembly != undefined)
            return this.isSupportWebAssembly;
        const webAssembly = globalThis["WebAssembly"];
        if (typeof webAssembly === "object") {
            if (typeof webAssembly["Memory"] === "function") {
                if ((typeof webAssembly["instantiateStreaming"] === "function") || (typeof webAssembly["instantiate"] === "function"))
                    this.isSupportWebAssembly = true;
            }
        }
        if (this.isSupportWebAssembly == undefined) {
            this.isSupportWebAssembly = false;
        }
        return this.isSupportWebAssembly;
    }

    /** Whether CSS custom properties are supported. */
    static supportCssVariables(): boolean {
        if (globalThis.CSS && globalThis.CSS.supports && globalThis.CSS.supports('color', 'var(--fake-var)')) {
            return true;
        }
        return false;
    }

    /**
     * Whether a CSS property/value pair is supported.
     * @param propertyName Property name.
     * @param propertyValue Property value.
     */
    static supportCssProperty(propertyName: string, propertyValue: string): boolean {
        return globalThis.CSS && globalThis.CSS.supports && globalThis.CSS.supports(propertyName, propertyValue);
    }

    /** Whether CSS aspect-ratio is supported. */
    static supportCssAspectRatio(): boolean {
        return this.supportCssProperty('aspect-ratio', '4/3');
    }

    /** Whether CSS overflow-anchor is supported. */
    static supportCssOverflowAnchor(): boolean {
        return this.supportCssProperty("overflow-anchor", "auto");
    }

    static supportCssHas(): boolean {
        return this.supportCssSelector("p:has(>img)");
    }

    private static supportCssSelectorMap = new Map<string, boolean>();
    static supportCssSelector(selector: string): boolean {
        if (this.supportCssSelectorMap.has(selector)) {
            return this.supportCssSelectorMap.get(selector);
        }
        let isSupport = false;
        try {
            document.querySelector(selector);
            isSupport = true;
        }
        catch (e) {
            isSupport = false;
        }
        this.supportCssSelectorMap.set(selector, isSupport);
        return isSupport;
    }

    private static isSupportCssMinMaxFunction: boolean;

    /** Whether CSS max()/min() functions are supported. */
    static supportCssMinMaxFunction() {
        if (this.isSupportCssMinMaxFunction != undefined)
            return this.isSupportCssMinMaxFunction;
        const body = document.body;
        if (body) {
            const testDiv = document.createElement("div");
            testDiv.style.height = "10px";
            testDiv.style.width = "10px";
            body.appendChild(testDiv);

            const height = testDiv.scrollHeight;
            const maxHeight = height - 2;
            const minHeight = height - 5;
            testDiv.style.setProperty("max-height", "max(" + maxHeight + "px," + minHeight + "px)", "important");
            const latestHeight = testDiv.scrollHeight;
            if (latestHeight == maxHeight) {
                this.isSupportCssMinMaxFunction = true;
            }
            else {
                this.isSupportCssMinMaxFunction = false;
            }
            body.removeChild(testDiv);
        } else {
            this.isSupportCssMinMaxFunction = false;
        }
        return this.isSupportCssMinMaxFunction;
    }

    /** Whether showOpenFilePicker is supported. */
    static supportShowOpenFilePicker() {
        return !!(globalThis as any).showOpenFilePicker;
    }

    /** Whether scrollBehavior (smooth scrolling) is supported. */
    static supportScrollBehavior() {
        return 'scrollBehavior' in document.documentElement.style;
    }

    private static supportsPassive: boolean;

    /** Whether the passive event listener option is supported. */
    static supportPassive() {
        try {
            var opts = {};
            Object.defineProperty(opts, 'passive', ({
                get: () => {
                    this.supportsPassive = true;
                }
            }));
            globalThis.addEventListener('test-passive', null, opts);
        } catch (e) {
        }
        return this.supportsPassive ?? false;
    }

    /** Whether fullscreen is supported. */
    static supportFullscreen(): boolean {
        return document.fullscreenEnabled;
    }

    /** Enters fullscreen mode for the given element. */
    static async enterFullScreen(element: Element): Promise<void> {
        if (!element) {
            return;
        }
        const ownerDocument = element.ownerDocument;
        const fullscreenEnabled = ownerDocument.fullscreenEnabled;
        if (fullscreenEnabled) {
            const enterFullScreenName = this.getSupportPropertyName([
                'requestFullscreen',
                'mozRequestFullScreen',
                'webkitRequestFullscreen',
                'msRequestFullscreen'
            ], element)
            if (enterFullScreenName) {
                await element[enterFullScreenName]();
            }
        }
    }

    static getSupportPropertyName(names: string[], target: Element | Document) {
        return names.find(name => name in target)
    }

    /** Exits fullscreen mode. */
    static async exitFullScreen(ownerDocument: Document): Promise<void> {
        if (!ownerDocument) {
            return;
        }
        const fullscreenEnabled = ownerDocument.fullscreenEnabled;
        if (fullscreenEnabled) {
            const exitFullScreenName = this.getSupportPropertyName([
                'exitFullScreen',
                'mozCancelFullScreen',
                'webkitExitFullscreen',
                'msExitFullscreen'
            ], ownerDocument)

            if (exitFullScreenName) {
                await ownerDocument[exitFullScreenName]();
            }
        }
    }

    /** Whether the document is currently in fullscreen mode. */
    static checkIsFullScreen(ownerDocument: Document): boolean {
        if (!ownerDocument) {
            return;
        }
        const fullscreenEnabled = ownerDocument.fullscreenEnabled;
        if (fullscreenEnabled) {
            const fullscreenElementName = this.getSupportPropertyName([
                'fullscreenElement',
                'mozFullScreenElement',
                'msFullScreenElement',
                'wenkitFullscreenElement'
            ], ownerDocument)
            if (fullscreenElementName && ownerDocument[fullscreenElementName])
                return true;
        }
        return false;
    }

    private static isSupportClipboardPng: boolean;

    /** Whether copying PNG images to the clipboard is supported. */
    static supportClipboardPng() {
        if (this.isSupportClipboardPng != undefined) {
            return this.isSupportClipboardPng;
        }
        try {
            if (globalThis.ClipboardItem) {
                this.isSupportClipboardPng = true;
            } else {
                this.isSupportClipboardPng = false;
            }
        } catch (err) {
            this.isSupportClipboardPng = false;
        }
        return this.isSupportClipboardPng;
    }

    private static currentSupportScheduler: boolean;

    /** Whether the Scheduling API is supported. */
    static supportScheduler() {
        if (this.currentSupportScheduler == undefined) {
            this.currentSupportScheduler = typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function';
        }
        return this.currentSupportScheduler
    }

    static async yieldToMain() {
        if (this.supportScheduler()) {
            await scheduler.yield()
        }
        else {
            await new Promise<void>((resolve) => setTimeout(resolve, 0))
        }
    }
}
