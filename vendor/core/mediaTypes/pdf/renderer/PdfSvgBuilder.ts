import {
    asyncDebounce,
    BrowserCapabilities,
    EventNames,
    Theme,
} from "../../../kernal";
import { getByteLength } from "../../../kernal/common/text";
import * as pdfjsLib from "../../../pdfjs/legacy/build/pdf.mjs";
import type * as pdfjsViewer from "../../../pdfjs/legacy/web/pdf_viewer.mjs";
import { PdfOptions } from "../PdfOptions";
import { IPdfDocument } from "./IPdfDocument";
import { IPdfRenderer } from "./IPdfRenderer";
import { IPdfSvgBuilder } from "./IPdfSvgBuilder";

type SvgPageTask = {
    svg: Element;
    batchLength: number;
    current: number;
    pageNumber: number;
    textContent: any;
    viewportTransform: number[];
    start: number;
    size: number;
};

/**
 * Builds a custom SVG text layer (textLayerMode === 2).
 * Visible text elements are resolved on demand via IPdfDocument.getVisibleElements().
 */
export class PdfSvgBuilder implements IPdfSvgBuilder {
    static readonly svgClassName = "custom-text-layer";
    private readonly SVG_NS = "http://www.w3.org/2000/svg";
    private readonly renderer: IPdfRenderer;
    private readonly options: PdfOptions;
    private pageTasks: SvgPageTask[] = [];
    /** Pages that currently have an SVG text layer mounted. */
    private readonly builtPages = new Map<number, Element>();
    private readonly textContentCache = new Map<number, any>();
    private isScrolling = false;
    private scrollingTimer: ReturnType<typeof setTimeout> | null = null;
    private disposed = false;
    private readonly batchSize = 64;
    private measureContext: CanvasRenderingContext2D | null = null;
    private readonly isFirefox = BrowserCapabilities.isFirefox();
    private readonly isSafari = BrowserCapabilities.isSafari();
    private renderLoopPromise: Promise<void> | null = null;

    constructor(renderer: IPdfRenderer, options: PdfOptions) {
        this.renderer = renderer;
        this.options = options;
    }

    async initialize(): Promise<void> {
        this.bindEvents();
    }

    private bindEvents() {
        const events = this.renderer.owner.events;
        events.on(EventNames.PdfPageRendered, this.onPageRendered);
        events.on(EventNames.PageChange, this.onPageChange);
        events.on(EventNames.ReaderOriginalScroll, this.onReaderOriginalScroll);
    }

    private unbindEvents() {
        const events = this.renderer.owner.events;
        events.off(EventNames.PdfPageRendered, this.onPageRendered);
        events.off(EventNames.PageChange, this.onPageChange);
        events.off(EventNames.ReaderOriginalScroll, this.onReaderOriginalScroll);
    }

    private onReaderOriginalScroll = () => {
        this.isScrolling = true;
        if (this.scrollingTimer) {
            clearTimeout(this.scrollingTimer);
        }
        this.scrollingTimer = setTimeout(async () => {
            this.isScrolling = false;
            await this.delayRenderVisiblePageTexts();
        }, 500);
    };

    private onPageChange = async () => {
        await this.delayRenderVisiblePageTexts();
    };

    private getVisiblePageIdSet = (): Set<number> => {
        const docs = this.renderer.getVisibleDocuments();
        const ids = new Set<number>();
        for (let i = 0; i < docs.length; i++) {
            ids.add(docs[i].pageNumber);
        }
        return ids;
    };

    private renderVisiblePageTexts = async () => {
        if (this.disposed) {
            return;
        }
        // PDF uses scroll layout; skip heavy work while scrolling.
        if (!this.isScrolling) {
            const visiblePages = this.getVisiblePageIdSet();
            this.removeInvisibleBuiltPages(visiblePages);
            await this.appendSvgs([...visiblePages]);
        }
    };

    private delayRenderVisiblePageTexts = asyncDebounce(this.renderVisiblePageTexts, 1);

    async dispose(): Promise<void> {
        this.disposed = true;
        this.unbindEvents();
        if (this.scrollingTimer) {
            clearTimeout(this.scrollingTimer);
            this.scrollingTimer = null;
        }
        this.pageTasks.length = 0;
        this.builtPages.clear();
        this.textContentCache.clear();
        this.measureContext = null;
        this.renderLoopPromise = null;
    }

    private onPageRendered = async () => {
        const visiblePages = this.getVisiblePageIdSet();
        this.removeInvisibleBuiltPages(visiblePages);
        await this.delayRenderVisiblePageTexts();
    };

    private removeInvisibleBuiltPages = (visiblePages: Set<number>) => {
        for (const pageNumber of [...this.builtPages.keys()]) {
            if (!visiblePages.has(pageNumber)) {
                this.removePageSvg(pageNumber);
            }
        }
        this.pruneInvisibleTasks(visiblePages);
    };

    private removePageSvg = (pageNumber: number) => {
        const tracked = this.builtPages.get(pageNumber);
        if (tracked?.parentElement) {
            tracked.parentElement.removeChild(tracked);
        } else {
            const svgContainer = this.getTextLayerContainer(pageNumber);
            svgContainer?.parentElement?.removeChild(svgContainer);
        }
        this.builtPages.delete(pageNumber);
    };

    private pruneInvisibleTasks = (visiblePages: Set<number>) => {
        let write = 0;
        for (let i = 0; i < this.pageTasks.length; i++) {
            if (visiblePages.has(this.pageTasks[i].pageNumber)) {
                this.pageTasks[write++] = this.pageTasks[i];
            }
        }
        this.pageTasks.length = write;
    };

    private getTextLayerContainer(page: pdfjsViewer.PDFPageView | number | Element): Element | null {
        const className = PdfSvgBuilder.svgClassName;
        if (typeof page === "number") {
            return this.builtPages.get(page) ?? this.renderer.getPageView(page)?.div?.querySelector(`svg.${className}`) ?? null;
        }
        if ("tagName" in page) {
            return page.querySelector(`svg.${className}`);
        }
        return page.div?.querySelector(`svg.${className}`) ?? null;
    }

    private getMeasureContext = (): CanvasRenderingContext2D | null => {
        if (!this.measureContext) {
            const canvas = document.createElement("canvas");
            this.measureContext = canvas.getContext("2d");
        }
        return this.measureContext;
    };

    private ensureTextContent = async (pageNumber: number) => {
        const cached = this.textContentCache.get(pageNumber);
        if (cached) {
            return cached;
        }
        const pageView = this.renderer.getPageView(pageNumber);
        if (!pageView?.pdfPage) {
            return null;
        }
        // Keep item sequence identical to PDFFindController / TextLayer (incl. spaces).
        const textContent = await pageView.pdfPage.getTextContent({
            disableNormalization: true,
        });
        this.textContentCache.set(pageNumber, textContent);
        return textContent;
    };

    private appendSvg = async (pageNumber: number) => {
        const pageView = this.renderer.getPageView(pageNumber);
        if (!pageView) {
            return;
        }
        if (this.options.textLayerMode != 2) {
            return;
        }
        if (!pageView.canvas?.parentElement) {
            return;
        }
        pageView.canvas.parentElement.style.background = `var(${Theme.ContentBackground})`;

        let svgContainer = this.getTextLayerContainer(pageView);
        if (svgContainer) {
            const state = svgContainer.getAttribute("data-state");
            if (state == "loading" || state == "loaded") {
                this.builtPages.set(pageNumber, svgContainer);
                return;
            }
        }

        if (!svgContainer) {
            svgContainer = await this.buildSVG(pageView.viewport);
            if (!svgContainer) {
                return;
            }
            pageView.div.appendChild(svgContainer);
        }
        this.builtPages.set(pageNumber, svgContainer);
        await this.appendTexts(svgContainer, pageNumber);

        const doc = this.renderer.getDocument((pageNumber - 1).toString()) as IPdfDocument;
        this.renderer.owner.events.emit(EventNames.PdfPageTextRendered, doc, pageNumber);
    };

    private appendSvgs = async (pageNumbers: number[]) => {
        // Prefetch text content for visible pages in parallel; DOM/task work stays sequential.
        await Promise.all(pageNumbers.map((pageNumber) => this.ensureTextContent(pageNumber)));
        for (const pageNumber of pageNumbers) {
            await this.appendSvg(pageNumber);
        }
    };

    private appendTexts = async (svg: Element, pageNumber: number) => {
        const pageView = this.renderer.getPageView(pageNumber);
        if (!pageView?.pdfPage) {
            return;
        }
        const textContent = await this.ensureTextContent(pageNumber);
        if (!textContent) {
            return;
        }

        const itemCount = textContent.items.length;
        const batchLength = Math.ceil(itemCount / this.batchSize) || 0;
        const lastBatchSize = itemCount % this.batchSize;

        const visiblePages = this.getVisiblePageIdSet();
        this.pruneInvisibleTasks(visiblePages);

        let hasTasksForPage = false;
        for (const pageTask of this.pageTasks) {
            if (pageTask.pageNumber == pageNumber) {
                pageTask.svg = svg;
                hasTasksForPage = true;
            }
        }

        if (!hasTasksForPage && batchLength > 0) {
            for (let i = 0; i < batchLength; i++) {
                let size = this.batchSize;
                if (i == batchLength - 1 && lastBatchSize > 0) {
                    size = lastBatchSize;
                }
                this.pageTasks.push({
                    svg,
                    batchLength,
                    current: i,
                    pageNumber,
                    textContent,
                    viewportTransform: pageView.viewport.transform,
                    start: i * this.batchSize,
                    size,
                });
            }
        }
        await this.renderSvgTexts();
    };

    private renderSvgTexts = async () => {
        if (this.renderLoopPromise) {
            await this.renderLoopPromise;
            if (this.pageTasks.length > 0 && !this.renderLoopPromise) {
                await this.renderSvgTexts();
            }
            return;
        }

        this.renderLoopPromise = this.runRenderLoop();
        try {
            await this.renderLoopPromise;
        } finally {
            this.renderLoopPromise = null;
        }

        if (this.pageTasks.length > 0 && !this.isScrolling && !this.disposed) {
            await this.renderSvgTexts();
        }
    };

    private runRenderLoop = async () => {
        while (this.pageTasks.length > 0) {
            if (this.disposed) {
                return;
            }

            if (this.isScrolling) {
                const head = this.pageTasks[0];
                if (head.svg.getAttribute("data-state") != "pause") {
                    head.svg.setAttribute("data-state", "pause");
                }
                return;
            }

            const pageTask = this.pageTasks.shift();
            if (!pageTask?.svg.parentElement) {
                continue;
            }

            if (pageTask.svg.getAttribute("data-state") != "loading") {
                pageTask.svg.setAttribute("data-state", "loading");
            }

            await BrowserCapabilities.yieldToMain();
            if (this.disposed || !this.renderer.owner.context) {
                return;
            }

            await this.appendPartialText(
                pageTask.pageNumber,
                pageTask.svg,
                pageTask.viewportTransform,
                pageTask.textContent,
                pageTask.start,
                pageTask.size,
            );
            if (pageTask.batchLength - 1 == pageTask.current) {
                pageTask.svg.setAttribute("data-state", "loaded");
            }
        }
    };

    private calcTextWidth = (
        context: CanvasRenderingContext2D,
        text: string,
        textItemFontName: string,
        fontFamily: string,
        styleFontName: string,
    ) => {
        const byteLength = getByteLength(text);
        const byteLengthDiff = byteLength - text.length;
        if (text.length <= 2 && byteLengthDiff == 0) {
            if (styleFontName == "monospace") {
                context.font = "1px " + textItemFontName + ",sans-serif";
            } else {
                context.font = "1px " + textItemFontName + "," + fontFamily;
            }
        } else {
            context.font = "1px " + fontFamily;
        }
        return context.measureText(text).width;
    };

    /**
     * Apply text-width scale in local text space.
     * Optional rotate/unrotate keep the scale on the text baseline axis.
     */
    private applyOrientedTextScale = (
        tx: number[],
        textItemTransform: number[],
        textMetricsWidth: number,
        textWidth: number,
        fontSize: number,
        rotate: number[] | null,
        unrotate: number[] | null,
    ): number[] => {
        let nextTx = rotate ? pdfjsLib.Util.transform(tx, rotate) : tx;
        const textTransform = rotate
            ? pdfjsLib.Util.transform(textItemTransform, rotate)
            : textItemTransform;
        const axisScale =
            textTransform[0] == 0 ? Math.abs(textTransform[1]) : Math.abs(textTransform[0]);
        const metricsWidth = textMetricsWidth * axisScale;
        const textScale = metricsWidth > 0 ? textWidth / metricsWidth / fontSize : 1;
        nextTx = pdfjsLib.Util.transform(nextTx, [textScale, 0, 0, textScale, 0, 0]);
        return unrotate ? pdfjsLib.Util.transform(nextTx, unrotate) : nextTx;
    };

    /**
     * Firefox/Safari clamp minimum font-size; move matrix scale into font-size
     * and keep a unit-scale transform so glyphs stay selectable/visible.
     */
    private extractFontSizeFromTransform = (
        tx: number[],
        baseFontSize: number,
    ): { tx: number[]; fontSize: number } => {
        const scale = Math.hypot(tx[0], tx[1]);
        if (!(scale > 1e-6)) {
            return { tx, fontSize: 1 };
        }
        return {
            tx: [tx[0] / scale, tx[1] / scale, tx[2] / scale, tx[3] / scale, tx[4], tx[5]],
            fontSize: Math.max(baseFontSize * scale, 1),
        };
    };

    private appendPartialText = async (
        pageNumber: number,
        svg: Element,
        viewportTransform: number[],
        textContent: any,
        start: number,
        size: number,
    ) => {
        const context = this.getMeasureContext();
        if (!context) {
            return;
        }
        const fontSize = 12;
        const isFirefox = this.isFirefox;
        const isSafari = this.isSafari;
        const documentFragment = document.createDocumentFragment();
        const ownerDocument = this.renderer.getRendererContainer().ownerDocument;
        const resourceId = this.renderer.owner.context?.id ?? "pdf";
        const fontFamilyCache = new Map<string, string>();
        const flipY = [1, 0, 0, -1, 0, 0];
        const rotate90 = [0, -1, 1, 0, 0, 0];
        const unrotate90 = [0, 1, -1, 0, 0, 0];
        const rotate180 = [-1, 0, 0, -1, 0, 0];
        const rotate270 = [0, 1, -1, 0, 0, 0];
        const unrotate270 = [0, -1, 1, 0, 0, 0];

        for (let i = start; i < start + size; i++) {
            const textItem = textContent.items[i];
            // Keep 1:1 with FindController / TextLayer items (empty + whitespace included).
            if (!textItem || typeof textItem.str !== "string") {
                continue;
            }
            const text = textItem.str;
            const style = textContent.styles[textItem.fontName];
            if (!style) {
                continue;
            }

            let tx = pdfjsLib.Util.transform(
                pdfjsLib.Util.transform(viewportTransform, textItem.transform),
                flipY,
            );
            let angle = Math.atan2(textItem.transform[1], textItem.transform[0]) * (180 / Math.PI);
            if (style.vertical) {
                angle += 90;
            }
            let absAngle = angle < 0 ? angle + 360 : angle;
            absAngle = Math.round(absAngle);

            let fontFamily = fontFamilyCache.get(style.fontFamily);
            if (fontFamily === undefined) {
                fontFamily = style.fontFamily.replace(/^serif/, "Times");
                fontFamilyCache.set(style.fontFamily, fontFamily);
            }

            if (text.length > 0) {
                let textMetricsWidth = textItem["textMetricsWidth"];
                if (!textMetricsWidth) {
                    textMetricsWidth = this.calcTextWidth(
                        context,
                        text,
                        textItem.fontName,
                        fontFamily,
                        style.fontName,
                    );
                    textItem["textMetricsWidth"] = textMetricsWidth;
                }

                switch (absAngle) {
                    case 90:
                        tx = this.applyOrientedTextScale(
                            tx,
                            textItem.transform,
                            textMetricsWidth,
                            textItem.width,
                            fontSize,
                            rotate90,
                            unrotate90,
                        );
                        break;
                    case 180:
                        tx = this.applyOrientedTextScale(
                            tx,
                            textItem.transform,
                            textMetricsWidth,
                            textItem.width,
                            fontSize,
                            rotate180,
                            rotate180,
                        );
                        break;
                    case 270:
                        tx = this.applyOrientedTextScale(
                            tx,
                            textItem.transform,
                            textMetricsWidth,
                            textItem.width,
                            fontSize,
                            rotate270,
                            unrotate270,
                        );
                        break;
                    default:
                        tx = this.applyOrientedTextScale(
                            tx,
                            textItem.transform,
                            textMetricsWidth,
                            textItem.width,
                            fontSize,
                            null,
                            null,
                        );
                        break;
                }
            }

            const textId = "p-" + resourceId + "-" + pageNumber + "-t-" + i;
            if (isFirefox || isSafari) {
                const normalized = this.extractFontSizeFromTransform(tx, fontSize);
                tx = normalized.tx;
                const newFontSize = normalized.fontSize;

                const g = ownerDocument.createElementNS(this.SVG_NS, "svg:g");
                g.setAttribute("transform", "matrix(" + tx.join(" ") + ")");
                g.setAttribute("style", "font-family:" + fontFamily + ";");
                const svgText = ownerDocument.createElementNS(this.SVG_NS, "svg:text");
                svgText.setAttribute("font-size", newFontSize + "px");
                if (isSafari) {
                    svgText.setAttribute("transform", "translate(0,-" + newFontSize + ")");
                    svgText.setAttribute("x", "0");
                    svgText.setAttribute("y", newFontSize.toString());
                }
                svgText.textContent = text;
                svgText.setAttribute("id", textId);
                svgText.setAttribute("data-text-index", String(i));
                g.appendChild(svgText);
                documentFragment.appendChild(g);
            } else {
                const svgText = ownerDocument.createElementNS(this.SVG_NS, "svg:text");
                svgText.setAttribute("transform", "matrix(" + tx.join(" ") + ")");
                svgText.setAttribute(
                    "style",
                    "font-size:" + fontSize + "px;font-family:" + fontFamily + ";",
                );
                svgText.textContent = text;
                svgText.setAttribute("id", textId);
                svgText.setAttribute("data-text-index", String(i));
                documentFragment.appendChild(svgText);
            }
        }
        svg.appendChild(documentFragment);
    };

    private buildSVG = async (viewport: pdfjsLib.PageViewport) => {
        if (viewport.width <= 0 || viewport.height <= 0) {
            return null;
        }
        const svg = this.renderer
            .getRendererContainer()
            .ownerDocument.createElementNS(this.SVG_NS, "svg:svg");
        svg.setAttribute("version", "1.1");
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
        svg.setAttribute("class", PdfSvgBuilder.svgClassName);
        svg.setAttribute("data-loaded", "false");
        svg.setAttribute(
            "style",
            "fill:transparent;position:absolute;left:0;top:0;width:100%;height:100%;z-index:1;contain:size layout paint;",
        );
        return svg;
    };
}
