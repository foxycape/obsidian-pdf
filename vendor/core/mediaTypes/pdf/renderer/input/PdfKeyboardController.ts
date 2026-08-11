import * as pdfjsLib from "../../../../pdfjs/legacy/build/pdf.mjs";
import { MultiPDFViewer } from "../MultiPdfViewer";

export type PdfFindRequestHandler = () => void;

export class PdfKeyboardController {
    private findRequestHandler?: PdfFindRequestHandler;

    constructor(
        private readonly pdfViewer: MultiPDFViewer,
        private readonly container: HTMLDivElement,
    ) {}

    bind() {
        this.container.addEventListener("click", this.webViewerClick);
        this.container.addEventListener("keydown", this.webViewerKeyDown);
    }

    unbind() {
        this.container.removeEventListener("click", this.webViewerClick);
        this.container.removeEventListener("keydown", this.webViewerKeyDown);
    }

    setFindRequestHandler(handler?: PdfFindRequestHandler) {
        this.findRequestHandler = handler;
    }

    /** Integrated find is handled by the host search UI via RequestOpenFind. */
    get supportsIntegratedFind() {
        return pdfjsLib.shadow(this, "supportsIntegratedFind", true);
    }

    private webViewerClick = (_evt: MouseEvent) => {};

    private webViewerKeyDown = (evt: KeyboardEvent) => {
        const { pdfViewer } = this;
        const isViewerInPresentationMode = pdfViewer.isInPresentationMode;

        let handled = false;
        let ensureViewerFocused = false;
        const cmd =
            (evt.ctrlKey ? 1 : 0) |
            (evt.altKey ? 2 : 0) |
            (evt.shiftKey ? 4 : 0) |
            (evt.metaKey ? 8 : 0);

        const curElement = this.getActiveOrFocusedElement();
        const curElementTagName = curElement?.tagName?.toUpperCase() ?? "";

        if (cmd === 1 || cmd === 8 || cmd === 5 || cmd === 12) {
            switch (evt.keyCode) {
                case 70:
                    if (!evt.shiftKey) {
                        handled = true;
                        this.findRequestHandler?.();
                    }
                    break;
                case 71:
                    break;
                case 61:
                case 107:
                case 187:
                case 171:
                    if (!isViewerInPresentationMode) {
                        pdfViewer.increaseScale({ drawingDelay: 400 });
                    }
                    handled = true;
                    break;
                case 173:
                case 109:
                case 189:
                    if (!isViewerInPresentationMode) {
                        pdfViewer.decreaseScale({ drawingDelay: 400 });
                    }
                    handled = true;
                    break;
                case 48:
                case 96:
                    if (!isViewerInPresentationMode) {
                        setTimeout(() => {
                            pdfViewer.currentScaleValue = "auto";
                        });
                        handled = false;
                    }
                    break;
                case 38:
                    if (isViewerInPresentationMode || pdfViewer.currentPageNumber > 1) {
                        pdfViewer.currentPageNumber = 1;
                        handled = true;
                        ensureViewerFocused = true;
                    }
                    break;
                case 40:
                    if (
                        isViewerInPresentationMode ||
                        pdfViewer.currentPageNumber < pdfViewer.pagesCount
                    ) {
                        pdfViewer.currentPageNumber = pdfViewer.pagesCount;
                        handled = true;
                        ensureViewerFocused = true;
                    }
                    break;
            }
        }

        let turnPage = 0;
        let turnOnlyIfPageFit = false;

        if (cmd === 0 || (cmd === 4 && !isViewerInPresentationMode)) {
            switch (evt.keyCode) {
                case 38:
                case 33:
                    if (pdfViewer.isVerticalScrollbarEnabled) {
                        turnPage = -1;
                    } else if (
                        isViewerInPresentationMode ||
                        (cmd === 4 && pdfViewer.currentScaleValue !== "page-fit")
                    ) {
                        turnPage = -1;
                        turnOnlyIfPageFit = cmd === 0;
                    }
                    break;
                case 37:
                    if (pdfViewer.isHorizontalScrollbarEnabled) {
                        turnPage = -1;
                    }
                    break;
                case 40:
                case 34:
                    if (pdfViewer.isVerticalScrollbarEnabled) {
                        turnPage = 1;
                    } else if (
                        isViewerInPresentationMode ||
                        (cmd === 4 && pdfViewer.currentScaleValue !== "page-fit")
                    ) {
                        turnPage = 1;
                        turnOnlyIfPageFit = cmd === 0;
                    }
                    break;
                case 39:
                    if (pdfViewer.isHorizontalScrollbarEnabled) {
                        turnPage = 1;
                    }
                    break;
                case 36:
                    if (isViewerInPresentationMode || pdfViewer.currentPageNumber > 1) {
                        pdfViewer.currentPageNumber = 1;
                        handled = true;
                        ensureViewerFocused = true;
                    }
                    break;
                case 35:
                    if (
                        isViewerInPresentationMode ||
                        pdfViewer.currentPageNumber < pdfViewer.pagesCount
                    ) {
                        pdfViewer.currentPageNumber = pdfViewer.pagesCount;
                        handled = true;
                        ensureViewerFocused = true;
                    }
                    break;
                case 32:
                    turnPage = evt.shiftKey ? -1 : 1;
                    break;
            }
        }

        if (cmd === 4) {
            switch (evt.keyCode) {
                case 13:
                case 32:
                    if (
                        !isViewerInPresentationMode &&
                        pdfViewer.currentScaleValue !== "page-fit"
                    ) {
                        break;
                    }
                    pdfViewer.previousPage();
                    handled = true;
                    break;
            }
        }

        if (turnPage !== 0 && (!turnOnlyIfPageFit || pdfViewer.currentScaleValue === "page-fit")) {
            if (turnPage > 0) {
                pdfViewer.nextPage();
            } else {
                pdfViewer.previousPage();
            }
            handled = true;
        }

        if (!handled && !isViewerInPresentationMode) {
            if (
                (evt.keyCode >= 33 && evt.keyCode <= 40) ||
                (evt.keyCode === 32 && curElementTagName !== "BUTTON")
            ) {
                ensureViewerFocused = true;
            }
        }

        if (ensureViewerFocused && !pdfViewer.containsElement(curElement)) {
            pdfViewer.focus();
        }

        if (handled) {
            evt.preventDefault();
        }
    };

    private getActiveOrFocusedElement = (): Element | null => {
        let curRoot: Document | ShadowRoot = this.container.ownerDocument;
        let curActiveOrFocused: Element | null =
            curRoot.activeElement || curRoot.querySelector(":focus");

        while ((curActiveOrFocused as HTMLElement | null)?.shadowRoot) {
            curRoot = (curActiveOrFocused as HTMLElement).shadowRoot!;
            curActiveOrFocused = curRoot.activeElement || curRoot.querySelector(":focus");
        }

        return curActiveOrFocused;
    };
}
