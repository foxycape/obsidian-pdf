import hotkeys, { HotkeysEvent } from "hotkeys-js";
import { asyncDebounce } from "../../Debounce";
import { EventNames } from "../../EventNames";
import type { IDocument } from "../../IDocument";
import { PluginCore } from "../PluginCore";
import { Reader } from "../../Reader";
import { FlipMode } from "../../types";

export type KeyboardPageTurningOptions = {
    flipPagePreviousKeys?: string;
    flipPageNextKeys?: string;
    flipMode?: FlipMode;
};

const DEFAULT_PREVIOUS_KEYS = "left,up,pageup";
const DEFAULT_NEXT_KEYS = "right,down,pagedown";

/**
 * Interactive plugin: keyboard page turning (arrow / page keys).
 */
export class KeyboardPageTurning extends PluginCore {
    private readonly pluginOptions: Required<KeyboardPageTurningOptions>;
    private bindedFlipPageElements: HTMLElement[] = [];
    private bindedDocuments: Document[] = [];
    private heldKeys: Record<number, number> = {};
    private currentPauseFlipPageOnPressKey = false;
    private readonly documentKeydownHandlers = new Map<Document, (event: KeyboardEvent) => void>();
    private readonly documentKeyupHandlers = new Map<Document, (event: KeyboardEvent) => void>();

    constructor(reader: Reader, options?: KeyboardPageTurningOptions) {
        super(reader, options);
        this.pluginOptions = {
            flipMode: options?.flipMode ?? "page",
            flipPagePreviousKeys: options?.flipPagePreviousKeys ?? DEFAULT_PREVIOUS_KEYS,
            flipPageNextKeys: options?.flipPageNextKeys ?? DEFAULT_NEXT_KEYS,
        };
    }

    get name(): string {
        return "keyboard-page-turning";
    }

    get title(): string {
        return "Keyboard Page Turning";
    }

    get description(): string {
        return "Keyboard page flip navigation";
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

    set pauseFlipPageOnPressKey(value: boolean) {
        this.currentPauseFlipPageOnPressKey = value;
    }

    get pauseFlipPageOnPressKey() {
        return this.currentPauseFlipPageOnPressKey;
    }

    async load(): Promise<void> {
        const readerContainer = this.reader.getReaderContainer();
        if (readerContainer) {
            await this.bindFlipPageKeys(readerContainer.ownerDocument.documentElement);
            if (readerContainer.ownerDocument !== document) {
                await this.bindFlipPageKeys(document.documentElement);
            }
        }

        const documents = this.reader.getRenderer()?.getLoadedDocuments?.()
            ?? this.reader.getRenderer()?.getDocuments?.()
            ?? [];
        for (const doc of documents) {
            await this.bindDocument(doc);
        }

        this.reader.events.on(EventNames.DocumentLoad, this.onDocumentLoad);
    }

    async dispose(): Promise<void> {
        this.reader.events.off(EventNames.DocumentLoad, this.onDocumentLoad);

        const previousKeys = this.pluginOptions.flipPagePreviousKeys;
        const nextKeys = this.pluginOptions.flipPageNextKeys;
        if (this.bindedFlipPageElements.length > 0) {
            if (previousKeys) {
                hotkeys.unbind(previousKeys, "all", this.onPressPreviousKey);
            }
            if (nextKeys) {
                hotkeys.unbind(nextKeys, "all", this.onPressNextKey);
            }
        }

        for (const doc of this.bindedDocuments) {
            const keydownHandler = this.documentKeydownHandlers.get(doc);
            const keyupHandler = this.documentKeyupHandlers.get(doc);
            if (keydownHandler) {
                doc.removeEventListener("keydown", keydownHandler, true);
            }
            if (keyupHandler) {
                doc.removeEventListener("keyup", keyupHandler, true);
            }
        }

        this.documentKeydownHandlers.clear();
        this.documentKeyupHandlers.clear();
        this.bindedFlipPageElements = [];
        this.bindedDocuments = [];
        this.heldKeys = {};
        this.currentPauseFlipPageOnPressKey = false;
    }

    private onDocumentLoad = async (doc: IDocument) => {
        await this.bindDocument(doc);
    };

    private async bindDocument(doc: IDocument): Promise<void> {
        const documentElement = doc.getContentContainer()?.ownerDocument?.documentElement;
        if (documentElement) {
            await this.bindFlipPageKeys(documentElement);
        }
    }

    private async bindFlipPageKeys(element: HTMLElement): Promise<void> {
        if (this.bindedFlipPageElements.includes(element)) {
            return;
        }

        const flipPagePreviousKeys = this.pluginOptions.flipPagePreviousKeys;
        const flipPageNextKeys = this.pluginOptions.flipPageNextKeys;
        if (flipPagePreviousKeys) {
            hotkeys(flipPagePreviousKeys, { element, scope: "all" }, this.onPressPreviousKey);
        }
        if (flipPageNextKeys) {
            hotkeys(flipPageNextKeys, { element, scope: "all" }, this.onPressNextKey);
        }

        const ownerDocument = element.ownerDocument;
        if (!this.bindedDocuments.includes(ownerDocument)) {
            this.bindedDocuments.push(ownerDocument);
            const keydownHandler = (event: KeyboardEvent) => {
                this.heldKeys[event.keyCode] = (this.heldKeys[event.keyCode] ?? 0) + 1;
            };
            const keyupHandler = (event: KeyboardEvent) => {
                this.heldKeys[event.keyCode] = 0;
            };
            this.documentKeydownHandlers.set(ownerDocument, keydownHandler);
            this.documentKeyupHandlers.set(ownerDocument, keyupHandler);
            ownerDocument.addEventListener("keydown", keydownHandler, true);
            ownerDocument.addEventListener("keyup", keyupHandler, true);
        }

        this.bindedFlipPageElements.push(element);
    }

    private onPressPreviousKey = (keyboardEvent: KeyboardEvent, _hotkeysEvent: HotkeysEvent) => {
        if (this.pluginOptions.flipMode == "page") {
            if (this.heldKeys[keyboardEvent.keyCode] > 1) {
                return;
            }
            if (!this.currentPauseFlipPageOnPressKey) {
                keyboardEvent.preventDefault();
                keyboardEvent.stopImmediatePropagation();
                this.reader.context.setUserChangedProgress(true, "keyboard");
                this.delayGotoPreviousPage(this.reader.getRenderer());
            }
        }
        else {
            this.reader.context.setUserChangedProgress(true, "keyboard");
        }
    };

    private onPressNextKey = (event: KeyboardEvent, _hotkeysEvent: HotkeysEvent) => {
        if (this.pluginOptions.flipMode == "page") {
            if (this.heldKeys[event.keyCode] > 1) {
                return;
            }
            if (!this.currentPauseFlipPageOnPressKey) {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.reader.context.setUserChangedProgress(true, "keyboard");
                this.delayGotoNextPage(this.reader.getRenderer());
            }
        }
        else {
            this.reader.context.setUserChangedProgress(true, "keyboard");
        }
    };

    private delayGotoPreviousPage = asyncDebounce(async (renderer: any) => {
        if (renderer?.pagingNavigator) {
            await renderer.pagingNavigator.gotoPreviousPage({ trigger: "user", triggerType: "key" });
            return;
        }
        await renderer?.gotoPreviousPage?.({ trigger: "user", triggerType: "key" });
    }, 64);

    private delayGotoNextPage = asyncDebounce(async (renderer: any) => {
        if (renderer?.pagingNavigator) {
            await renderer.pagingNavigator.gotoNextPage({ trigger: "user", triggerType: "key" });
            return;
        }
        await renderer?.gotoNextPage?.({ trigger: "user", triggerType: "key" });
    }, 64);
}
