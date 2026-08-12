import type { PDFPageProxy } from '@foxycape/core/pdfjs/types/src/display/api'
import { EventNames } from '@foxycape/core/kernal'
import { scrollElementIntoView } from '@foxycape/core/kernal/html/style'
import type { IPdfDocument } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfDocument'
import type { IPdfRenderer } from '@foxycape/core/mediaTypes/pdf/renderer/IPdfRenderer'
import type { IPdfSearcher } from './IPdfSearcher'
import {
    buildLayerText,
    buildShowTextSnippet,
    buildTextLayerMapping,
    readPageViewTextItems,
    resolveMatchRectsFromDom,
    isPageTextMappingSource,
    type PdfSearchPageView,
} from './matchGeometry'
import {
  clearActiveSearchHits,
  paintSearchHitOnPage,
  removeAllSearchOverlays,
  setSearchHitActive,
} from './PdfSearchOverlay'
import type {
  PdfSearchMatch,
  PdfSearchMatchOptions,
  PdfSearchRequest,
  PdfSearchResult,
} from './types'

const DEFAULT_MAX_SEARCH_COUNT = 1000;
const FIND_SETTLE_MS = 400;

const emptyResult = (keyword = ""): PdfSearchResult => ({
    keyword,
    finished: true,
    total: 0,
    index: -1,
    items: [],
});

const isPdfPageProxy = (value: unknown): value is PDFPageProxy => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    return typeof Reflect.get(value, "getTextContent") === "function";
};

export class PdfSearcher implements IPdfSearcher {
    private result: PdfSearchResult = emptyResult();
    private options: PdfSearchMatchOptions = {
        caseSensitive: false,
        matchDiacritics: false,
        entireWord: false,
    };
    private searchGeneration = 0;
    /** Layer string cache: texts.join("") ?same space as TextHighlighter / pageMatches. */
    private pageLayerTextCache = new Map<number, string>();
    private disposed = false;
    private pendingResolve?: {
        generation: number;
        resolve: (result: PdfSearchResult) => void;
        maxCount: number;
        query: string;
        timer?: number;
    };

    constructor(private readonly renderer: IPdfRenderer) {
        this.bindEvents();
    }

    getOptions(): PdfSearchMatchOptions {
        return { ...this.options };
    }

    setOptions(options: Partial<PdfSearchMatchOptions>) {
        this.options = { ...this.options, ...options };
    }

    getResult(): PdfSearchResult {
        return this.result;
    }

    async search(request: PdfSearchRequest): Promise<PdfSearchResult> {
        const query = request.query?.trim() ?? "";
        if (!query) {
            await this.removeAll(true);
            return this.result;
        }

        this.options = {
            caseSensitive: !!request.caseSensitive,
            matchDiacritics: !!request.matchDiacritics,
            entireWord: !!request.entireWord,
        };
        const maxCount = request.maxSearchCount ?? DEFAULT_MAX_SEARCH_COUNT;
        if (this.pendingResolve?.timer) {
            window.clearTimeout(this.pendingResolve.timer);
        }
        this.pendingResolve = undefined;
        const generation = ++this.searchGeneration;
        this.pageLayerTextCache.clear();
        removeAllSearchOverlays(this.renderer.getRendererContainer());
        this.result = {
            keyword: query,
            finished: false,
            total: 0,
            index: -1,
            items: [],
        };

        const eventBus = this.renderer.getEventBus();

        return new Promise<PdfSearchResult>((resolve) => {
            if (this.pendingResolve?.timer) {
                window.clearTimeout(this.pendingResolve.timer);
            }
            this.pendingResolve = {
                generation,
                resolve,
                maxCount,
                query,
            };

            eventBus.dispatch("find", {
                type: "",
                query,
                caseSensitive: this.options.caseSensitive,
                entireWord: this.options.entireWord,
                highlightAll: true,
                findPrevious: false,
                matchDiacritics: this.options.matchDiacritics,
            });

            // FindController debounces new queries (~250ms) then scans pages async.
            this.pendingResolve.timer = window.setTimeout(() => {
                void this.tryFinalizeSearch(generation);
            }, FIND_SETTLE_MS);
        });
    }

    async goto(item: PdfSearchMatch): Promise<void> {
        if (!item) {
            return;
        }
        this.result.index = item.index;
        // Sync page index without jumping; only force a page scroll if text layer
        // is not available yet (page not near the viewport).
        this.renderer.setCurrentPage(item.pageNumber, false);
        let hasTextLayer = await this.waitForTextLayer(item.pageNumber, 400);
        if (!hasTextLayer) {
            this.renderer.setCurrentPage(item.pageNumber, true);
            hasTextLayer = await this.waitForTextLayer(item.pageNumber);
        }
        await this.ensureMatchRects(item);
        await this.paintPageMatches(item.pageNumber);
        await this.highlightActive(item.id, true);
        // Late text-layer paint: retry once more shortly after goto.
        if (!item.rects?.length) {
            window.setTimeout(() => {
                void this.paintPageMatches(item.pageNumber).then(() =>
                    this.highlightActive(item.id, true),
                );
            }, 120);
        }
    }

    async gotoNext(): Promise<void> {
        if (this.result.items.length === 0) {
            return;
        }
        const next = Math.min(this.result.index + 1, this.result.items.length - 1);
        if (next === this.result.index && this.result.index >= 0) {
            return;
        }
        await this.goto(this.result.items[next]);
    }

    async gotoPrevious(): Promise<void> {
        if (this.result.items.length === 0) {
            return;
        }
        const prev = Math.max(this.result.index - 1, 0);
        if (prev === this.result.index && this.result.index >= 0) {
            return;
        }
        await this.goto(this.result.items[prev]);
    }

    async highlightActive(itemIdOrIndex: string | number, doScroll = false): Promise<void> {
        const item =
            typeof itemIdOrIndex === "number"
                ? this.result.items[itemIdOrIndex]
                : this.result.items.find((x) => x.id === itemIdOrIndex);
        if (!item) {
            return;
        }
        this.result.index = item.index;
        const root = this.renderer.getRendererContainer();
        setSearchHitActive(
            root,
            item.id,
            doScroll
                ? (el) => {
                      const container = this.renderer.getScrollElement?.() ?? root;
                      if (this.isElementVisibleInContainer(el, container)) {
                          return;
                      }
                      scrollElementIntoView(
                          el,
                          { block: "nearest", inline: "nearest" },
                          true,
                      );
                  }
                : undefined,
        );
    }

    /** True when any part of `el` intersects the scroll/view container. */
    private isElementVisibleInContainer(el: Element, container: Element): boolean {
        const er = el.getBoundingClientRect();
        const cr = container.getBoundingClientRect();
        if (er.width <= 0 || er.height <= 0) {
            return false;
        }
        return er.bottom > cr.top && er.top < cr.bottom && er.right > cr.left && er.left < cr.right;
    }

    async removeAll(reset: boolean): Promise<void> {
        this.searchGeneration++;
        if (this.pendingResolve?.timer) {
            window.clearTimeout(this.pendingResolve.timer);
        }
        this.pendingResolve = undefined;
        const root = this.renderer.getRendererContainer();
        removeAllSearchOverlays(root);
        clearActiveSearchHits(root);
        if (reset) {
            try {
                this.renderer.getEventBus().dispatch("findbarclose", { source: this });
            } catch {
                // ignore
            }
            this.result = emptyResult();
            this.pageLayerTextCache.clear();
        }
    }

    async dispose(): Promise<void> {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.unbindEvents();
        await this.removeAll(true);
    }

    private bindEvents() {
        this.renderer.owner.events.on(EventNames.PdfPageRendered, this.onPageRendered);
        this.renderer.owner.events.on(EventNames.PdfPageTextRendered, this.onPageTextRendered);
        this.renderer.owner.events.on(EventNames.PdfScaleChanging, this.onScaleChanging);
        this.renderer.getEventBus().on("updatefindcontrolstate", this.onFindControlState);
        this.renderer.getEventBus().on("updatefindmatchescount", this.onFindMatchesCount);
    }

    private unbindEvents() {
        this.renderer.owner.events.off(EventNames.PdfPageRendered, this.onPageRendered);
        this.renderer.owner.events.off(EventNames.PdfPageTextRendered, this.onPageTextRendered);
        this.renderer.owner.events.off(EventNames.PdfScaleChanging, this.onScaleChanging);
        this.renderer.getEventBus().off("updatefindcontrolstate", this.onFindControlState);
        this.renderer.getEventBus().off("updatefindmatchescount", this.onFindMatchesCount);
    }

    private onScaleChanging = () => {
        void this.handleScaleChanging();
    };

    private handleScaleChanging = async () => {
        if (this.result.items.length === 0) {
            return;
        }
        for (const item of this.result.items) {
            item.rects = undefined;
        }
        const visible = this.renderer.getVisibleDocuments();
        for (const doc of visible) {
            await this.paintPageMatches(doc.pageNumber);
        }
        if (this.result.index >= 0) {
            const active = this.result.items[this.result.index];
            if (active) {
                await this.highlightActive(active.id, false);
            }
        }
    };

    private onFindControlState = (evt: { state?: number }) => {
        // 0 FOUND, 1 NOT_FOUND, 2 WRAPPED, 3 PENDING
        if (evt?.state === 3 || !this.pendingResolve) {
            return;
        }
        void this.tryFinalizeSearch(this.pendingResolve.generation);
    };

    private onFindMatchesCount = () => {
        if (!this.pendingResolve) {
            return;
        }
        // Keep UI progressive: rebuild items while search is in progress.
        this.rebuildResultItems(this.pendingResolve.maxCount, this.pendingResolve.query, false);
    };

    private onPageRendered = (pageView: { id?: number }) => {
        void this.handlePageRendered(pageView);
    };

    private handlePageRendered = async (pageView: { id?: number }) => {
        const pageNumber = pageView?.id;
        if (!pageNumber || this.result.items.length === 0) {
            return;
        }
        await this.paintPageMatches(pageNumber);
        if (this.result.index >= 0) {
            const active = this.result.items[this.result.index];
            if (active) {
                await this.highlightActive(active.id, false);
            }
        }
    };

    private onPageTextRendered = (_doc: unknown, pageNumber: number) => {
        void this.handlePageTextRendered(pageNumber);
    };

    private handlePageTextRendered = async (pageNumber: number) => {
        if (!pageNumber || this.result.items.length === 0) {
            return;
        }
        // Text layer just became available ?drop empty/stale geometry for this page.
        this.pageLayerTextCache.delete(pageNumber);
        for (const item of this.result.items) {
            if (item.pageNumber === pageNumber) {
                item.rects = undefined;
                item.showText = undefined;
            }
        }
        await this.paintPageMatches(pageNumber);
        if (this.result.index >= 0) {
            const active = this.result.items[this.result.index];
            if (active) {
                await this.highlightActive(active.id, false);
            }
        }
    };

    private async tryFinalizeSearch(generation: number) {
        const pending = this.pendingResolve;
        if (!pending || pending.generation !== generation) {
            return;
        }
        const findController = this.renderer.getFindController();
        const pageMatches = findController.pageMatches;
        if (!pageMatches || pageMatches.length === 0) {
            // Still extracting / waiting for debounce.
            pending.timer = window.setTimeout(() => {
                void this.tryFinalizeSearch(generation);
            }, 100);
            return;
        }

        const pagesCount = this.renderer.numberOfPages;
        if (pageMatches.length < pagesCount) {
            pending.timer = window.setTimeout(() => {
                void this.tryFinalizeSearch(generation);
            }, 100);
            return;
        }

        this.rebuildResultItems(pending.maxCount, pending.query, true);
        if (pending.timer) {
            window.clearTimeout(pending.timer);
        }
        this.pendingResolve = undefined;

        // Paint currently visible pages.
        const visible = this.renderer.getLoadedDocuments();
        const pages = visible?.length
            ? visible.map((d) => d.pageNumber)
            : [this.renderer.currentPage];
        for (const pageNumber of pages) {
            await this.paintPageMatches(pageNumber);
        }

        pending.resolve(this.result);
    }

    private rebuildResultItems(maxCount: number, query: string, finished: boolean) {
        const findController = this.renderer.getFindController();
        const pageMatches = findController.pageMatches ?? [];
        const pageMatchesLength = findController.pageMatchesLength ?? [];
        const items: PdfSearchMatch[] = [];
        let truncated = false;

        for (let pageIdx = 0; pageIdx < pageMatches.length; pageIdx++) {
            const matches = pageMatches[pageIdx] as number[] | undefined;
            const lengths = pageMatchesLength[pageIdx] as number[] | undefined;
            if (!matches?.length) {
                continue;
            }
            for (let matchIdx = 0; matchIdx < matches.length; matchIdx++) {
                if (items.length >= maxCount) {
                    truncated = true;
                    break;
                }
                const start = matches[matchIdx];
                const length = lengths?.[matchIdx] ?? query.length;
                items.push({
                    id: `p${pageIdx + 1}-m${matchIdx}-${start}-${length}`,
                    index: items.length,
                    pageNumber: pageIdx + 1,
                    pageMatchIndex: matchIdx,
                    start,
                    length,
                });
            }
            if (truncated) {
                break;
            }
        }

        const prevIndex = this.result.index;
        this.result = {
            keyword: query,
            finished: finished && !truncated,
            total: items.length,
            index: prevIndex >= 0 && prevIndex < items.length ? prevIndex : -1,
            items,
        };
    }

    private getPageDoc(pageNumber: number): IPdfDocument | undefined {
        return this.renderer.getDocuments().find((d) => d.pageNumber === pageNumber);
    }

    private getSearchPageView(pageNumber: number): PdfSearchPageView | undefined {
        const pageView = this.renderer.getPageView(pageNumber);
        if (!pageView) {
            return undefined;
        }
        const textHighlighter: unknown = pageView._textHighlighter
        return {
            div: pageView.div,
            pdfPage: isPdfPageProxy(pageView.pdfPage) ? pageView.pdfPage : undefined,
            _textHighlighter: isPageTextMappingSource(textHighlighter)
                ? textHighlighter
                : undefined,
            textLayer: pageView.textLayer ?? undefined,
        };
    }

    private hasTextLayerDom(pageEl: HTMLElement | undefined): boolean {
        if (!pageEl) {
            return false;
        }
        return (
            !!pageEl.querySelector("svg.custom-text-layer text") ||
            !!pageEl.querySelector(".textLayer span")
        );
    }

    private async waitForTextLayer(pageNumber: number, timeoutMs = 2500): Promise<boolean> {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const pageView = this.getSearchPageView(pageNumber);
            if (this.hasTextLayerDom(pageView?.div)) {
                return true;
            }
            await new Promise<void>((resolve) => {
                window.setTimeout(resolve, 40);
            });
        }
        return this.hasTextLayerDom(this.getSearchPageView(pageNumber)?.div);
    }

    private async getPageLayerText(pageNumber: number): Promise<string> {
        const cached = this.pageLayerTextCache.get(pageNumber);
        if (cached != null) {
            return cached;
        }
        const pageView = this.getSearchPageView(pageNumber);
        const fromHighlighter = readPageViewTextItems(pageView);
        if (fromHighlighter?.length) {
            const layerText = buildLayerText(fromHighlighter);
            this.pageLayerTextCache.set(pageNumber, layerText);
            return layerText;
        }
        const pdfPage = (await this.renderer.getPdfPage(pageNumber)) ?? pageView?.pdfPage;
        if (!pdfPage) {
            return "";
        }
        const textContent = await pdfPage.getTextContent({ disableNormalization: true });
        const mapping = buildTextLayerMapping(textContent.items);
        const layerText = buildLayerText(mapping.texts);
        this.pageLayerTextCache.set(pageNumber, layerText);
        return layerText;
    }

    async ensureShowText(item: PdfSearchMatch): Promise<string> {
        if (item.showText) {
            return item.showText;
        }
        // pageMatches offsets are in TextHighlighter / texts.join("") space.
        const layerText = await this.getPageLayerText(item.pageNumber);
        if (!layerText) {
            // Page text not available yet ?keep unset so UI can retry.
            return "";
        }
        item.showText = buildShowTextSnippet(layerText, item.start, item.length);
        return item.showText;
    }

    private async ensureMatchRects(item: PdfSearchMatch): Promise<void> {
        if (item.rects?.length) {
            return;
        }
        const pageView = this.getSearchPageView(item.pageNumber);
        const pageEl = pageView?.div;
        if (!pageEl || !this.hasTextLayerDom(pageEl)) {
            return;
        }
        const pdfPage = (await this.renderer.getPdfPage(item.pageNumber)) ?? pageView?.pdfPage;
        if (!pdfPage) {
            return;
        }
        const { rects } = await resolveMatchRectsFromDom(
            pageEl,
            pdfPage,
            item.pageNumber,
            item.start,
            item.length,
            pageView,
        );
        if (rects.length > 0) {
            item.rects = rects;
        }
    }

    private async paintPageMatches(pageNumber: number): Promise<void> {
        const doc = this.getPageDoc(pageNumber);
        if (!doc?.getContentContainer()) {
            return;
        }
        const pageItems = this.result.items.filter((x) => x.pageNumber === pageNumber);
        if (pageItems.length === 0) {
            return;
        }
        const activeId =
            this.result.index >= 0 ? this.result.items[this.result.index]?.id : undefined;
        for (const item of pageItems) {
            await this.ensureMatchRects(item);
            if (!item.rects?.length) {
                continue;
            }
            paintSearchHitOnPage(doc, item, item.rects, item.id === activeId);
        }
    }
}
