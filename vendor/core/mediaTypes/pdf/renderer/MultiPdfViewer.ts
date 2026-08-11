import { TextFormatOptions, IDisposable, SpineFile, asyncDebounce, IDevice } from "../../../kernal";
import * as pdfjsLib from '../../../pdfjs/legacy/build/pdf.mjs';
import * as pdfjsViewer from '../../../pdfjs/legacy/web/pdf_viewer.mjs';

import { PDFViewerOptions } from "../../../pdfjs/types/web/pdf_viewer";
import { PdfOptions } from "../PdfOptions";
import { getPageText } from "../shared/text/pageText";

export class MultiPDFViewer extends pdfjsViewer.PDFViewer implements IDisposable {
   private isMultiDocument: boolean;
   #scrollModePageState = null;

   constructor(pdfViewerOptions: PDFViewerOptions,private readonly options: PdfOptions) {
      super(pdfViewerOptions);
      this.isMultiDocument = false;
      this.bindEvents();
      this.#scrollModePageState = {
         previousPageNumber: 1,
         scrollDown: true,
         pages: [],
      }
   }

   private bindEvents() {
      this.eventBus.on("pagerendered", this.onPageRendered);
   }

   private unbindEvents() {
      this.eventBus.off("pagerendered", this.onPageRendered);
   }

   private onPageRendered = async () => {
      // await this.delayClearNoUsedResource();
      // await this.clearNoUsedResource();
   }

   private docs = new Map<number, { doc: pdfjsLib.PDFDocumentProxy, page: pdfjsLib.PDFPageProxy }>();
   private otherPages: pdfjsViewer.PDFPageView[];
   private callback?: (spineFile: SpineFile, pageNumber: number) => Promise<{ doc: pdfjsLib.PDFDocumentProxy, page: pdfjsLib.PDFPageProxy }>
   async setOtherPages(otherPages: pdfjsViewer.PDFPageView[], callback?: (spineFile: SpineFile, pageNumber: number) => Promise<{ doc: pdfjsLib.PDFDocumentProxy, page: pdfjsLib.PDFPageProxy }>): Promise<void> {
      this.otherPages = otherPages;
      if (otherPages && otherPages.length > 0) {
         this.isMultiDocument = true;
         otherPages.forEach(pageView => {
            pageView["originDestroy"] = pageView.destroy;
            pageView.destroy = () => {
               pageView["originDestroy"]();
               pageView.pdfPage = null;
               const obj = this.docs.get(pageView.id);
               if (obj) {
                  this.docs.delete(pageView.id);
                  obj.doc.destroy().then(() => {
                     obj.doc.cleanup();
                  })
               }
            }
            this._pages.push(pageView);
         })
      }
      this.callback = callback;
   }

   getPageText = async (pageNumber: number, options?: TextFormatOptions) => {
      if (this.otherPages && pageNumber > 1) {
         const pageView = this._pages.find(x => x.id == pageNumber);
         const spineFile = pageView["spineFile"];
         if (spineFile) {
            let result = this.docs.get(pageView.id);
            let fromRemote = false;
            if (!result) {
               result = await this.callback(spineFile, 1);
               fromRemote = true;
            }
            const text = await getPageText(result.page, options);
            if (fromRemote) {
               const doc = result.doc;
               await doc.cleanup(false);
               if (doc.loadingTask) {
                  await doc.loadingTask.destroy();
               }
               await doc.destroy();
            }
            return text;
         }
         return ""
      }
      else {
         const page = await this.pdfDocument.getPage(pageNumber);
         return await getPageText(page, options);
      }
   }
   
   forceRenderingQueue = new Map<number, number>();
   override forceRendering(currentlyVisiblePages: any): boolean {
      const visiblePages = currentlyVisiblePages || this._getVisiblePages();
      const scrollAhead = this.#getScrollAhead(visiblePages);
      const preRenderExtra =
         this._spreadMode !== pdfjsViewer.SpreadMode.NONE &&
         this._scrollMode !== pdfjsViewer.ScrollMode.HORIZONTAL;

      const pageView = this.renderingQueue.getHighestPriority(
         visiblePages,
         this._pages,
         scrollAhead,
         preRenderExtra
      );

      if (pageView) {
         this.previousPageNumber = pageView.id;
         if (this.forceRenderingQueue.get(pageView.id)) {
            return;
         }
         this.forceRenderingQueue.set(pageView.id, pageView.id);
         if (this.isMultiDocument) {
            this.delayEnsurePdfPageLoaded(pageView).then((pdfPage) => {
               this.forceRenderingQueue.delete(pageView.id);
               if (pageView.pdfPage) {
                  this.renderingQueue.renderView(pageView);
               }
               else if (pdfPage) {
                  const newPageView = this._pages[pdfPage["customPageNumber"] - 1]
                  if (!newPageView.pdfPage) {
                     newPageView.setPdfPage(pdfPage);
                  }
                  this.renderingQueue.renderView(newPageView);
               }
            });
         }
         else {
            //如果是单个文档，不用等待
            this.#ensurePdfPageLoaded(pageView).then((pdfPage) => {
               this.forceRenderingQueue.delete(pageView.id);
               if (pageView.pdfPage) {
                  this.renderingQueue.renderView(pageView);
               }
               else if (pdfPage) {
                  const newPageView = this._pages[pdfPage["customPageNumber"] - 1]
                  if (!newPageView.pdfPage) {
                     newPageView.setPdfPage(pdfPage);
                  }
                  this.renderingQueue.renderView(newPageView);
               }
            });
         }
         return true;
      }
      return false;
   }
   private previousPageNumber = 1;

   #getScrollAhead(visible) {
      if (visible.first?.id === 1) {
         return true;
      } else if (visible.last?.id === this.pagesCount) {
         return false;
      }

      switch (this._scrollMode) {
         case pdfjsViewer.ScrollMode.PAGE:
            return this.#scrollModePageState.scrollDown;
         // return true;
         case pdfjsViewer.ScrollMode.HORIZONTAL:
            return this.scroll.right;
      }
      return this.scroll.down;
   }

   async #ensurePdfPageLoaded(pageView: pdfjsViewer.PDFPageView) {
      if (pageView.pdfPage) {
         return pageView.pdfPage;
      }
      try {
         const spineFile = pageView["spineFile"];
         let pdfPage: any;
         if (spineFile) {
            pdfPage = await this.loadRemotePdf(pageView.id);
         }
         else {
            pdfPage = await this.pdfDocument.getPage(pageView.id);
         }

         pdfPage["customPageNumber"] = pageView.id
         if (!pageView.pdfPage) {
            pageView.setPdfPage(pdfPage);
         }
         // if (!(this.linkService as pdfjsViewer.PDFLinkService)._cachedPageNumber?.(pdfPage.ref)) {
         //    this.linkService.cachePageRef(pageView.id, pdfPage.ref);
         // }

         return pdfPage;
      } catch (reason) {
         console.error("Unable to get page for page view", reason);
         return null; // Page error -- there is nothing that can be done.
      }
   }

   private delayEnsurePdfPageLoaded = asyncDebounce(this.#ensurePdfPageLoaded, 25)

   private loadRemotePdf = async (pageNumber: number) => {
      const pageView = this._pages[pageNumber - 1];
      if (pageView.pdfPage) {
         return pageView.pdfPage;
      }
      const spineFile = pageView["spineFile"];
      if (spineFile) {
         let result = this.docs.get(pageNumber);
         if (!result) {
            result = await this.callback(spineFile, 1);
            this.docs.set(pageView.id, result);
         }
         return result.page;
      }

      return null;
   }

   async dispose(): Promise<void> {
      this.unbindEvents();
      if(this.#scaleTimeoutId){
         clearTimeout(this.#scaleTimeoutId)
         this.#scaleTimeoutId=null;
      }
      for (const [key, value] of this.docs.entries()) {
         try {
            if (value.doc) {
               await value.doc.cleanup();
            }

            if (value.doc?.loadingTask) {
               await value.doc.loadingTask.destroy();
            }
            if (value.doc) {
               await value.doc.destroy();
            }
         } catch (e) {
            //
         }
      }
      this.docs.clear();
      if(this.otherPages){
         this.otherPages.splice(0)
      }
      if(this.forceRenderingQueue){
         this.forceRenderingQueue.clear();
      }
   }

   //overrides

   readonly DEFAULT_SCALE_DELTA = 1.1;
   readonly MAX_AUTO_SCALE = 1.25;
   readonly MAX_SCALE = 10
   readonly MIN_SCALE = 0.1;
   override increaseScale({
      drawingDelay,
      scaleFactor,
      steps,
   }: {
      drawingDelay?: number;
      scaleFactor?: number;
      steps?: number;
   } = {}): void {
      if (!this.pdfDocument) {
         return;
      }
      let newScale = this._currentScale;
      if (scaleFactor !== undefined && scaleFactor > 1) {
         newScale = Math.round(newScale * scaleFactor * 100) / 100;
      } else {
         steps ??= 1;
         do {
            newScale =
               Math.ceil((newScale * this.DEFAULT_SCALE_DELTA).toFixed(2) as any * 10) / 10;
         } while (--steps > 0 && newScale < this.MAX_SCALE);
      }
      this.#setScale(Math.min(this.MAX_SCALE, newScale), {
         noScroll: false,
         drawingDelay,
      });
   }

   override decreaseScale({
      drawingDelay,
      scaleFactor,
      steps,
   }: {
      drawingDelay?: number;
      scaleFactor?: number;
      steps?: number;
   } = {}): void {
      if (!this.pdfDocument) {
         return;
      }
      let newScale = this._currentScale;
      if (scaleFactor !== undefined && scaleFactor > 0 && scaleFactor < 1) {
         newScale = Math.round(newScale * scaleFactor * 100) / 100;
      } else {
         steps ??= 1;
         do {
            newScale =
               Math.floor((newScale / this.DEFAULT_SCALE_DELTA).toFixed(2) as any * 10) / 10;
         } while (--steps > 0 && newScale > this.MIN_SCALE);
      }
      this.#setScale(Math.max(this.MIN_SCALE, newScale), {
         noScroll: false,
         drawingDelay,
      });
   }

   override _updateScrollMode(pageNumber?: null): void {
      const scrollMode = this._scrollMode,
         viewer = this.viewer;

      viewer.classList.toggle(
         "scrollHorizontal",
         scrollMode === pdfjsViewer.ScrollMode.HORIZONTAL
      );
      viewer.classList.toggle("scrollWrapped", scrollMode === pdfjsViewer.ScrollMode.WRAPPED);

      if (!this.pdfDocument || !pageNumber) {
         return;
      }

      if (scrollMode === pdfjsViewer.ScrollMode.PAGE) {
         this.#ensurePageViewVisible();
      } else if (this._previousScrollMode === pdfjsViewer.ScrollMode.PAGE) {
         // Ensure that the current spreadMode is still applied correctly when
         // the *previous* scrollMode was `ScrollMode.PAGE`.
         this._updateSpreadMode();
      }
      // Non-numeric scale values can be sensitive to the scroll orientation.
      // Call this before re-scrolling to the current page, to ensure that any
      // changes in scale don't move the current page.
      if (this._currentScaleValue && isNaN(this._currentScaleValue)) {
         this.#setScale(this._currentScaleValue, { noScroll: true });
      }
      this._customSetCurrentPageNumber(pageNumber, /* resetCurrentPageView = */ true);
      this.update();
   }
   override _updateSpreadMode(pageNumber?: null): void {
      if (!this.pdfDocument) {
         return;
      }
      const viewer = this.viewer,
         pages = this._pages;

      if (this._scrollMode === pdfjsViewer.ScrollMode.PAGE) {
         this.#ensurePageViewVisible();
      } else {
         // Temporarily remove all the pages from the DOM.
         viewer.textContent = "";

         if (this._spreadMode === pdfjsViewer.SpreadMode.NONE) {
            for (const pageView of this._pages) {
               viewer.append(pageView.div);
            }
         } else {
            const parity = this._spreadMode - 1;
            let spread = null;
            for (let i = 0, ii = pages.length; i < ii; ++i) {
               if (spread === null) {
                  spread = document.createElement("div");
                  spread.className = "spread";
                  viewer.append(spread);
               } else if (i % 2 === parity) {
                  spread = spread.cloneNode(false);
                  viewer.append(spread);
               }
               spread.append(pages[i].div);
            }
         }
      }

      if (!pageNumber) {
         return;
      }
      // Non-numeric scale values can be sensitive to the scroll orientation.
      // Call this before re-scrolling to the current page, to ensure that any
      // changes in scale don't move the current page.
      if (this._currentScaleValue && isNaN(this._currentScaleValue)) {
         this.#setScale(this._currentScaleValue, { noScroll: true });
      }
      this._customSetCurrentPageNumber(pageNumber, /* resetCurrentPageView = */ true);
      this.update();
   }

   override set pagesRotation(rotation: number) {
      if (!this.isValidRotation(rotation)) {
         throw new Error("Invalid pages rotation angle.");
      }
      if (!this.pdfDocument) {
         return;
      }
      // Normalize the rotation, by clamping it to the [0, 360) range.
      rotation %= 360;
      if (rotation < 0) {
         rotation += 360;
      }
      if (this._pagesRotation === rotation) {
         return; // The rotation didn't change.
      }
      this._pagesRotation = rotation;

      const pageNumber = this._currentPageNumber;

      this.refresh(true, { rotation });

      // Prevent errors in case the rotation changes *before* the scale has been
      // set to a non-default value.
      if (this._currentScaleValue) {
         this.#setScale(this._currentScaleValue, { noScroll: true });
      }

      this.eventBus.dispatch("rotationchanging", {
         source: this,
         pagesRotation: rotation,
         pageNumber,
      });

      if (this.defaultRenderingQueue) {
         this.update();
      }
   }
   override get pagesRotation(): number {
      return super.pagesRotation;
   }

   override set currentScaleValue(arg: string) {
      if (!this.pdfDocument) {
         return;
      }
      this.#setScale(arg, { noScroll: false });
   }
   override get currentScaleValue(): string {
      return super.currentScaleValue;
   }

   override set currentScale(arg: number) {
      if (isNaN(arg)) {
         throw new Error("Invalid numeric scale.");
      }
      if (!this.pdfDocument) {
         return;
      }
      this.#setScale(arg, { noScroll: false });
   }
   override get currentScale(): number {
      return super.currentScale;
   }

   #isSameScale(newScale: any) {
      return (
         newScale === this._currentScale ||
         Math.abs(newScale - this._currentScale) < 1e-15
      );
   }
   #scaleTimeoutId = null;
   #setScaleUpdatePages(
      newScale,
      newValue,
      { noScroll = false, preset = false, drawingDelay = -1 }
   ) {
      this._currentScaleValue = newValue.toString();

      if (this.#isSameScale(newScale)) {
         if (preset) {
            this.eventBus.dispatch("scalechanging", {
               source: this,
               scale: newScale,
               presetValue: newValue,
            });
         }
         return;
      }

      (this.viewer as any).style.setProperty(
         "--scale-factor",
         newScale * pdfjsLib.PixelsPerInch.PDF_TO_CSS_UNITS
      );

      const postponeDrawing = drawingDelay >= 0 && drawingDelay < 1000;
      this.refresh(true, {
         scale: newScale,
         drawingDelay: postponeDrawing ? drawingDelay : -1,
      });

      if (postponeDrawing) {
         this.#scaleTimeoutId = setTimeout(() => {
            this.#scaleTimeoutId = null;
            this.refresh();
         }, drawingDelay);
      }

      this._currentScale = newScale;

      if (!noScroll) {
         let page = this._currentPageNumber,
            dest;
         if (
            this._location &&
            !(this.isInPresentationMode || this.isChangingPresentationMode)
         ) {
            page = this._location.pageNumber;
            dest = [
               null,
               { name: "XYZ" },
               this._location.left,
               this._location.top,
               null,
            ];
         }
         this.scrollPageIntoView({
            pageNumber: page,
            destArray: dest,
            allowNegativeOffset: true,
         });
      }

      this.eventBus.dispatch("scalechanging", {
         source: this,
         scale: newScale,
         presetValue: preset ? newValue : undefined,
      });

      if (this.defaultRenderingQueue) {
         this.update();
      }
   }
   get #pageWidthScaleFactor() {
      if (
         this._spreadMode !== pdfjsViewer.SpreadMode.NONE &&
         this._scrollMode !== pdfjsViewer.ScrollMode.HORIZONTAL
      ) {
         return 2;
      }
      return 1;
   }

   #setScale(value, options) {
      let scale = parseFloat(value);
      // PDF.js scale is a multiplier (1 = 100%). Accept UI strings like "75%".
      if (
         typeof value === "string" &&
         value.trim().endsWith("%") &&
         Number.isFinite(scale) &&
         scale > 0
      ) {
         scale = scale / 100;
         // Persist as multiplier so resize logic treats it as absolute, not a preset.
         value = String(scale);
      }

      if (scale > 0) {
         options.preset = false;
         this.#setScaleUpdatePages(scale, value, options);
      } else {
         const currentPage = this._pages[this._currentPageNumber - 1] as pdfjsViewer.PDFPageView;
         if (!currentPage) {
            return;
         }

         //custom padding
         let hPadding = this.options.horizontalPadding ? this.options.horizontalPadding : 10,
            vPadding = this.options.verticalPadding ? this.options.verticalPadding : 0;
         if (hPadding < 0)
            hPadding = 0;
         if (vPadding < 0)
            vPadding = 0;
         if (this._spreadMode !== pdfjsViewer.SpreadMode.NONE) {
            if (!this.options.removeHorizonalMargin) {
               hPadding += 10;//padding is 10
            }
         }

         if (this.isInPresentationMode) {
            // Pages have a 2px (transparent) border in PresentationMode, see
            // the `web/pdf_viewer.css` file.
            hPadding = vPadding = 4; // 2 * 2px
            if (this._spreadMode !== pdfjsViewer.SpreadMode.NONE) {
               // Account for two pages being visible in PresentationMode, thus
               // "doubling" the total border width.
               hPadding *= 2;
            }
         } else if (!this.removePageBorders) {
            // .page uses --page-border: 9px; scale uses content-box width, so reserve
            // border on each side or page-width/auto will overflow the container.
            // Extra 1px avoids subpixel/round(down) toggling a horizontal scrollbar
            // (that shrinks content-box and can fire ResizeObserver → scroll bounce).
            const pageBorderPadding = 9 * 2 + 1;
            hPadding += pageBorderPadding * this.#pageWidthScaleFactor;
            // pdf.js VERTICAL_PADDING is 5 with borders; negative --page-margin absorbs
            // most vertical border stacking between pages — do not add full 18px.
            vPadding += 5;
            if (this._scrollMode === pdfjsViewer.ScrollMode.HORIZONTAL) {
               [hPadding, vPadding] = [vPadding, hPadding]; // Swap the padding values.
            }
         } else if (this._scrollMode === pdfjsViewer.ScrollMode.HORIZONTAL) {
            // removePageBorders: custom horizontal/verticalPadding already applied above
            [hPadding, vPadding] = [vPadding, hPadding]; // Swap the padding values.
         }
         const pageWidthScale =
            (((this.container.clientWidth - hPadding) / currentPage.width) *
               currentPage.scale) /
            this.#pageWidthScaleFactor;
         const pageHeightScale =
            ((this.container.clientHeight - vPadding) / currentPage.height) *
            currentPage.scale;
         switch (value) {
            case "page-actual":
               scale = 1;
               break;
            case "page-width":
               scale = pageWidthScale;
               break;
            case "page-height":
               scale = pageHeightScale;
               break;
            case "page-fit":
               scale = Math.min(pageWidthScale, pageHeightScale);
               break;
            case "auto":
               // For pages in landscape mode, fit the page height to the viewer
               // *unless* the page would thus become too wide to fit horizontally.
               const horizontalScale = this.isPortraitOrientation(currentPage)
                  ? pageWidthScale
                  : Math.min(pageHeightScale, pageWidthScale);
               scale = Math.min(this.MAX_AUTO_SCALE, horizontalScale);
               break;
            default:
               console.error(`#setScale: "${value}" is an unknown zoom value.`);
               return;
         }
         options.preset = true;
         this.#setScaleUpdatePages(scale, value, options);
      }
   }
   #resetCurrentPageView() {
      const pageView = this._pages[this._currentPageNumber - 1];

      if (this.isInPresentationMode) {
         // Fixes the case when PDF has different page sizes.
         this.#setScale(this._currentScaleValue, { noScroll: true });
      }
      this.#scrollIntoView(pageView);
   }

   #scrollIntoView(pageView, pageSpot = null) {
      const { div, id } = pageView;

      // Ensure that `this._currentPageNumber` is correct, when `#scrollIntoView`
      // is called directly (and not from `#resetCurrentPageView`).
      if (this._currentPageNumber !== id) {
         this._customSetCurrentPageNumber(id);
      }
      if (this._scrollMode === pdfjsViewer.ScrollMode.PAGE) {
         this.#ensurePageViewVisible();
         // Ensure that rendering always occurs, to avoid showing a blank page,
         // even if the current position doesn't change when the page is scrolled.
         this.update();
      }

      if (!pageSpot && !this.isInPresentationMode) {
         const left = div.offsetLeft + div.clientLeft,
            right = left + div.clientWidth;
         const { scrollLeft, clientWidth } = this.container;
         if (
            this._scrollMode === pdfjsViewer.ScrollMode.HORIZONTAL ||
            left < scrollLeft ||
            right > scrollLeft + clientWidth
         ) {
            pageSpot = { left: 0, top: 0 };
         }
      }
      this.scrollIntoView(div, pageSpot);

      // Ensure that the correct *initial* document position is set, when any
      // OpenParameters are used, for documents with non-default Scroll/Spread
      // modes (fixes issue 15695). This is necessary since the scroll-handler
      // invokes the `update`-method asynchronously, and `this._location` could
      // thus be wrong when the initial zooming occurs in the default viewer.
      if (!this._currentScaleValue && this._location) {
         this._location = null;
      }
   }

   #ensurePageViewVisible() {
      if (this._scrollMode !== pdfjsViewer.ScrollMode.PAGE) {
         throw new Error("#ensurePageViewVisible: Invalid scrollMode value.");
      }
      const pageNumber = this._currentPageNumber,
         state = this.#scrollModePageState,
         viewer = this.viewer;

      // Temporarily remove all the pages from the DOM...
      viewer.textContent = "";
      // ... and clear out the active ones.
      state.pages.length = 0;

      if (this._spreadMode === pdfjsViewer.SpreadMode.NONE && !this.isInPresentationMode) {
         // Finally, append the new page to the viewer.
         const pageView = this._pages[pageNumber - 1];
         viewer.append(pageView.div);

         state.pages.push(pageView);
      } else {
         const pageIndexSet = new Set<number>(),
            parity = this._spreadMode - 1;

         // Determine the pageIndices in the new spread.
         if (parity === -1) {
            // PresentationMode is active, with `SpreadMode.NONE` set.
            pageIndexSet.add(pageNumber - 1);
         } else if (pageNumber % 2 !== parity) {
            // Left-hand side page.
            pageIndexSet.add(pageNumber - 1);
            pageIndexSet.add(pageNumber);
         } else {
            // Right-hand side page.
            pageIndexSet.add(pageNumber - 2);
            pageIndexSet.add(pageNumber - 1);
         }

         // Finally, append the new pages to the viewer and apply the spreadMode.
         const spread = document.createElement("div");
         spread.className = "spread";

         if (this.isInPresentationMode) {
            const dummyPage = document.createElement("div");
            dummyPage.className = "dummyPage";
            spread.append(dummyPage);
         }

         for (const i of pageIndexSet) {
            const pageView = this._pages[i];
            if (!pageView) {
               continue;
            }
            spread.append(pageView.div);

            state.pages.push(pageView);
         }
         viewer.append(spread);
      }

      state.scrollDown = pageNumber >= state.previousPageNumber;
      state.previousPageNumber = pageNumber;
   }

   rescrollIntoView(pageNumber: number) {
      this._location = null;
      this.#setScale(this._currentScaleValue, { noScroll: false });
      this._customSetCurrentPageNumber(pageNumber, true)
   }

   private _customSetCurrentPageNumber(val, resetCurrentPageView = false) {
      if (this._currentPageNumber === val) {
         if (resetCurrentPageView) {
            this.#resetCurrentPageView();
         }
         return true;
      }

      if (!(0 < val && val <= this.pagesCount)) {
         return false;
      }
      const previous = this._currentPageNumber;
      this._currentPageNumber = val;

      this.eventBus.dispatch("pagechanging", {
         source: this,
         pageNumber: val,
         pageLabel: this._pageLabels?.[val - 1] ?? null,
         previous,
      });

      if (resetCurrentPageView) {
         this.#resetCurrentPageView();
      }
      return true;
   }

   private scrollIntoView(element, spot, scrollMatches = false) {
      // Assuming offsetParent is available (it's not available when viewer is in
      // hidden iframe or object). We have to scroll: if the offsetParent is not set
      // producing the error. See also animationStarted.
      let parent = element.offsetParent;
      if (!parent) {
         console.error("offsetParent is not set -- cannot scroll");
         return;
      }
      let offsetY = element.offsetTop + element.clientTop;
      let offsetX = element.offsetLeft + element.clientLeft;
      while (
         (parent.clientHeight === parent.scrollHeight &&
            parent.clientWidth === parent.scrollWidth) ||
         (scrollMatches &&
            (parent.classList.contains("markedContent") ||
               getComputedStyle(parent).overflow === "hidden"))
      ) {
         offsetY += parent.offsetTop;
         offsetX += parent.offsetLeft;

         parent = parent.offsetParent;
         if (!parent) {
            return; // no need to scroll
         }
      }
      if (spot) {
         if (spot.top !== undefined) {
            offsetY += spot.top;
         }
         if (spot.left !== undefined) {
            offsetX += spot.left;
            parent.scrollLeft = offsetX;
         }
      }
      parent.scrollTop = offsetY;
   }
   private isPortraitOrientation(size: pdfjsViewer.PDFPageView) {
      return size.width <= size.height;
   }
   private isValidRotation(angle: number) {
      return Number.isInteger(angle) && angle % 90 === 0;
   }

   refresh(noUpdate = false, updateArgs = Object.create(null)) {
      if (!this.pdfDocument) {
         return;
      }
      for (const pageView of this._pages) {
         pageView.update(updateArgs);
      }
      if (this.#scaleTimeoutId !== null) {
         clearTimeout(this.#scaleTimeoutId);
         this.#scaleTimeoutId = null;
      }
      if (!noUpdate) {
         this.update();
      }
   }


   // override _getVisiblePages() {
   //    const views =
   //       this._scrollMode === pdfjsViewer.ScrollMode.PAGE
   //          ? this.#scrollModePageState.pages
   //          : this._pages,
   //       horizontal = this._scrollMode === pdfjsViewer.ScrollMode.HORIZONTAL,
   //       rtl = horizontal && this._isContainerRtl;
   //    this.logger.debug('views', views)
   //    return this.getVisibleElements({
   //       scrollEl: this.container,
   //       views,
   //       sortByVisibility: true,
   //       horizontal,
   //       rtl,
   //    });
   // }

   // getVisibleElements({
   //    scrollEl,
   //    views,
   //    sortByVisibility = false,
   //    horizontal = false,
   //    rtl = false,
   // }) {
   //    const top = scrollEl.scrollTop,
   //       bottom = top + scrollEl.clientHeight;
   //    const left = scrollEl.scrollLeft,
   //       right = left + scrollEl.clientWidth;

   //    // Throughout this "generic" function, comments will assume we're working with
   //    // PDF document pages, which is the most important and complex case. In this
   //    // case, the visible elements we're actually interested is the page canvas,
   //    // which is contained in a wrapper which adds no padding/border/margin, which
   //    // is itself contained in `view.div` which adds no padding (but does add a
   //    // border). So, as specified in this function's doc comment, this function
   //    // does all of its work on the padding edge of the provided views, starting at
   //    // offsetLeft/Top (which includes margin) and adding clientLeft/Top (which is
   //    // the border). Adding clientWidth/Height gets us the bottom-right corner of
   //    // the padding edge.
   //    const isElementBottomAfterViewTop = (view) => {
   //       const element = view.div;
   //       const elementBottom =
   //          element.offsetTop + element.clientTop + element.clientHeight;
   //       return elementBottom > top;
   //    }
   //    const isElementNextAfterViewHorizontally = (view) => {
   //       const element = view.div;
   //       const elementLeft = element.offsetLeft + element.clientLeft;
   //       const elementRight = elementLeft + element.clientWidth;
   //       return rtl ? elementLeft < right : elementRight > left;
   //    }

   //    const visible = [],
   //       ids = new Set(),
   //       numViews = views.length;
   //    let firstVisibleElementInd = this.binarySearchFirstItem(
   //       views,
   //       horizontal
   //          ? isElementNextAfterViewHorizontally
   //          : isElementBottomAfterViewTop
   //    );

   //    // Please note the return value of the `binarySearchFirstItem` function when
   //    // no valid element is found (hence the `firstVisibleElementInd` check below).
   //    if (
   //       firstVisibleElementInd > 0 &&
   //       firstVisibleElementInd < numViews &&
   //       !horizontal
   //    ) {
   //       // In wrapped scrolling (or vertical scrolling with spreads), with some page
   //       // sizes, isElementBottomAfterViewTop doesn't satisfy the binary search
   //       // condition: there can be pages with bottoms above the view top between
   //       // pages with bottoms below. This function detects and corrects that error;
   //       // see it for more comments.
   //       firstVisibleElementInd = this.backtrackBeforeAllVisibleElements(
   //          firstVisibleElementInd,
   //          views,
   //          top
   //       );
   //    }

   //    // lastEdge acts as a cutoff for us to stop looping, because we know all
   //    // subsequent pages will be hidden.
   //    //
   //    // When using wrapped scrolling or vertical scrolling with spreads, we can't
   //    // simply stop the first time we reach a page below the bottom of the view;
   //    // the tops of subsequent pages on the same row could still be visible. In
   //    // horizontal scrolling, we don't have that issue, so we can stop as soon as
   //    // we pass `right`, without needing the code below that handles the -1 case.
   //    let lastEdge = horizontal ? right : -1;

   //    for (let i = firstVisibleElementInd; i < numViews; i++) {
   //       const view = views[i],
   //          element = view.div;
   //       const currentWidth = element.offsetLeft + element.clientLeft;
   //       const currentHeight = element.offsetTop + element.clientTop;
   //       const viewWidth = element.clientWidth,
   //          viewHeight = element.clientHeight;
   //       const viewRight = currentWidth + viewWidth;
   //       const viewBottom = currentHeight + viewHeight;

   //       if (lastEdge === -1) {
   //          // As commented above, this is only needed in non-horizontal cases.
   //          // Setting lastEdge to the bottom of the first page that is partially
   //          // visible ensures that the next page fully below lastEdge is on the
   //          // next row, which has to be fully hidden along with all subsequent rows.
   //          if (viewBottom >= bottom) {
   //             lastEdge = viewBottom;
   //          }
   //       } else if ((horizontal ? currentWidth : currentHeight) > lastEdge) {
   //          break;
   //       }

   //       if (
   //          viewBottom <= top ||
   //          currentHeight >= bottom ||
   //          viewRight <= left ||
   //          currentWidth >= right
   //       ) {
   //          continue;
   //       }

   //       const hiddenHeight =
   //          Math.max(0, top - currentHeight) + Math.max(0, viewBottom - bottom);
   //       const hiddenWidth =
   //          Math.max(0, left - currentWidth) + Math.max(0, viewRight - right);

   //       const fractionHeight = (viewHeight - hiddenHeight) / viewHeight,
   //          fractionWidth = (viewWidth - hiddenWidth) / viewWidth;
   //       const percent = (fractionHeight * fractionWidth * 100) | 0;

   //       visible.push({
   //          id: view.id,
   //          x: currentWidth,
   //          y: currentHeight,
   //          view,
   //          percent,
   //          widthPercent: (fractionWidth * 100) | 0,
   //       });
   //       ids.add(view.id);
   //    }

   //    const first = visible[0],
   //       last = visible.at(-1);

   //    if (sortByVisibility) {
   //       visible.sort(function (a, b) {
   //          const pc = a.percent - b.percent;
   //          if (Math.abs(pc) > 0.001) {
   //             return -pc;
   //          }
   //          return a.id - b.id; // ensure stability
   //       });
   //    }
   //    return { first, last, views: visible, ids };
   // }

   // binarySearchFirstItem(items, condition, start = 0) {
   //    let minIndex = start;
   //    let maxIndex = items.length - 1;

   //    if (maxIndex < 0 || !condition(items[maxIndex])) {
   //       return items.length;
   //    }
   //    if (condition(items[minIndex])) {
   //       return minIndex;
   //    }

   //    while (minIndex < maxIndex) {
   //       const currentIndex = (minIndex + maxIndex) >> 1;
   //       const currentItem = items[currentIndex];
   //       if (condition(currentItem)) {
   //          maxIndex = currentIndex;
   //       } else {
   //          minIndex = currentIndex + 1;
   //       }
   //    }
   //    return minIndex; /* === maxIndex */
   // }

   // backtrackBeforeAllVisibleElements(index, views, top) {
   //    // binarySearchFirstItem's assumption is that the input is ordered, with only
   //    // one index where the conditions flips from false to true: [false ...,
   //    // true...]. With vertical scrolling and spreads, it is possible to have
   //    // [false ..., true, false, true ...]. With wrapped scrolling we can have a
   //    // similar sequence, with many more mixed true and false in the middle.
   //    //
   //    // So there is no guarantee that the binary search yields the index of the
   //    // first visible element. It could have been any of the other visible elements
   //    // that were preceded by a hidden element.

   //    // Of course, if either this element or the previous (hidden) element is also
   //    // the first element, there's nothing to worry about.
   //    if (index < 2) {
   //       return index;
   //    }

   //    // That aside, the possible cases are represented below.
   //    //
   //    //     ****  = fully hidden
   //    //     A*B*  = mix of partially visible and/or hidden pages
   //    //     CDEF  = fully visible
   //    //
   //    // (1) Binary search could have returned A, in which case we can stop.
   //    // (2) Binary search could also have returned B, in which case we need to
   //    // check the whole row.
   //    // (3) Binary search could also have returned C, in which case we need to
   //    // check the whole previous row.
   //    //
   //    // There's one other possibility:
   //    //
   //    //     ****  = fully hidden
   //    //     ABCD  = mix of fully and/or partially visible pages
   //    //
   //    // (4) Binary search could only have returned A.

   //    // Initially assume that we need to find the beginning of the current row
   //    // (case 1, 2, or 4), which means finding a page that is above the current
   //    // page's top. If the found page is partially visible, we're definitely not in
   //    // case 3, and this assumption is correct.
   //    let elt = views[index].div;
   //    let pageTop = elt.offsetTop + elt.clientTop;

   //    if (pageTop >= top) {
   //       // The found page is fully visible, so we're actually either in case 3 or 4,
   //       // and unfortunately we can't tell the difference between them without
   //       // scanning the entire previous row, so we just conservatively assume that
   //       // we do need to backtrack to that row. In both cases, the previous page is
   //       // in the previous row, so use its top instead.
   //       elt = views[index - 1].div;
   //       pageTop = elt.offsetTop + elt.clientTop;
   //    }

   //    // Now we backtrack to the first page that still has its bottom below
   //    // `pageTop`, which is the top of a page in the first visible row (unless
   //    // we're in case 4, in which case it's the row before that).
   //    // `index` is found by binary search, so the page at `index - 1` is
   //    // invisible and we can start looking for potentially visible pages from
   //    // `index - 2`. (However, if this loop terminates on its first iteration,
   //    // which is the case when pages are stacked vertically, `index` should remain
   //    // unchanged, so we use a distinct loop variable.)
   //    for (let i = index - 2; i >= 0; --i) {
   //       elt = views[i].div;
   //       if (elt.offsetTop + elt.clientTop + elt.clientHeight <= pageTop) {
   //          // We have reached the previous row, so stop now.
   //          // This loop is expected to terminate relatively quickly because the
   //          // number of pages per row is expected to be small.
   //          break;
   //       }
   //       index = i;
   //    }
   //    return index;
   // }
}