import { containValues } from "../../../kernal/common/array";
import { deepClone } from "../../../kernal/common/object";
import { IDocumentsProvider, IFileParser, INavPointProvider, Nav, NavPoint, SymbolType } from "../../../kernal";
import { IPdfDocument, PdfPageGeometry } from "./IPdfDocument";
import { IPdfFileParser } from "../fileParser/IPdfFileParser";
import { IPdfDocumentsProvider } from "./documents/IPdfDocumentsProvider";

export class PdfNavPointProvider implements INavPointProvider {
    readonly fileParser: IFileParser;
    private flattingNavPoints: NavPoint[] = [];
    // Must not be initialized here
    private reversedFlattingNavPoints: NavPoint[];
    private isInitNav: boolean = false;
    constructor(public readonly documentsProvider: IDocumentsProvider<IPdfDocument, IPdfFileParser>) {
        this.fileParser = documentsProvider.fileParser;
    }
    async getFlattingNavPoints(): Promise<NavPoint[]> {
        return await this.getInternalFlattingNavPoints();
    }

    private async getInternalFlattingNavPoints(reversed?: boolean): Promise<NavPoint[]> {
        if (!this.isInitNav) {
            const nav = await this.fileParser.getNav();
            this.initialNav(nav);
            this.isInitNav = true;
        }
        if (reversed) {
            if (!this.reversedFlattingNavPoints) {
                if (this.flattingNavPoints && this.flattingNavPoints.length > 0) {
                    this.reversedFlattingNavPoints = deepClone<NavPoint[]>(this.flattingNavPoints).reverse();
                    return this.reversedFlattingNavPoints;
                }
                else {
                    this.reversedFlattingNavPoints = []
                    return this.reversedFlattingNavPoints;
                }
            }
            return this.reversedFlattingNavPoints;
        }
        return this.flattingNavPoints;
    }

    async getCurrentNavPoint(): Promise<NavPoint> {
        const flattingNavPoints = await this.getFlattingNavPoints();
        if (flattingNavPoints.length == 0)
            return undefined;

        const pageNumber = this.resolveCurrentPageNumber();
        if (!pageNumber)
            return undefined;

        const doc = this.documentsProvider.getDocuments().find(x => x.pageNumber == pageNumber)
            ?? this.documentsProvider.getDocument(`${pageNumber}.pdf`);
        if (!doc)
            return this.findUpwardNavPoint(
                pageNumber,
                flattingNavPoints,
                await this.getInternalFlattingNavPoints(true)
            );

        // Prefer a visible element so same-page XYZ can refine which heading is active.
        const visibleInWindow = doc.getVisibleElements?.(true) ?? [];
        const visibleElements = visibleInWindow.length > 0
            ? visibleInWindow
            : (doc.getVisibleElements?.() ?? []);
        if (visibleElements.length > 0) {
            return await this.getNavPoint(doc.url, visibleElements[0], 'char');
        }

        return await this.getNavPoint(doc.url, pageNumber, 'char');
    }

    async getNavPoint(url: string, target: Element | number, _symbolType: SymbolType): Promise<NavPoint> {
        const flattingNavPoints = await this.getFlattingNavPoints();
        if (flattingNavPoints.length == 0) {
            return undefined;
        }
        const reversedFlattingNavPoints = await this.getInternalFlattingNavPoints(true);
        const doc = this.documentsProvider.getDocument(url);
        const pageNumber = typeof target === "number"
            ? target
            : (doc?.pageNumber ?? this.resolveCurrentPageNumber());
        if (!pageNumber || pageNumber < 1) {
            return undefined;
        }

        if (typeof target !== "number" && doc) {
            const geometry = doc.getPageGeometry();
            const samePageNavPoints = flattingNavPoints.filter(x => x.startPageNumber == pageNumber);
            if (samePageNavPoints.length > 0 && geometry) {
                // Same page: scan last→first, pick the latest heading the reading position has passed
                const navPoints = samePageNavPoints.slice().reverse();
                const targetRect = target.getBoundingClientRect();
                for (const navPoint of navPoints) {
                    if (this.isElementAtOrPastPdfDest(targetRect, navPoint.pdfDest, geometry)) {
                        return this.cloneNavPoint(navPoint, flattingNavPoints);
                    }
                }
                // Entered this page but not past any in-page XYZ yet → first nav on this page
                return this.cloneNavPoint(samePageNavPoints[0], flattingNavPoints);
            }
        }

        return this.findUpwardNavPoint(pageNumber, flattingNavPoints, reversedFlattingNavPoints);
    }

    private resolveCurrentPageNumber(): number | undefined {
        const pdfProvider = this.documentsProvider as unknown as IPdfDocumentsProvider;
        const currentPage = pdfProvider.currentPage;
        if (currentPage > 0) {
            return currentPage;
        }
        const visible = this.documentsProvider.getFirstVisibleDocument()
            ?? this.documentsProvider.getVisibleDocuments()[0];
        return visible?.pageNumber > 0 ? visible.pageNumber : undefined;
    }

    /**
     * Upward lookup: nearest nav point at or before the current page.
     * e.g. page 5 has TOC, pages 6–7 have none → return page 5;
     * page 8 has TOC → return page 8 (first on that page when no Y position).
     *
     * IMPORTANT: ignore startPageNumber <= 0. Outline items with failed dest resolution
     * keep page 0; because we scan a reversed list, those trailing zeros would otherwise
     * always match first and pin the highlight to the last TOC entry.
     */
    private findUpwardNavPoint(
        pageNumber: number,
        flattingNavPoints: NavPoint[],
        reversedFlattingNavPoints: NavPoint[]
    ): NavPoint {
        const samePageNavPoints = flattingNavPoints.filter(x => x.startPageNumber == pageNumber);
        if (samePageNavPoints.length > 0) {
            // Without Y: first nav on this page (not last — avoids jumping to page-end TOC)
            return this.cloneNavPoint(samePageNavPoints[0], flattingNavPoints);
        }

        const navPoint = reversedFlattingNavPoints.find(
            x => x.startPageNumber > 0 && x.startPageNumber <= pageNumber
        );
        if (!navPoint) {
            return undefined;
        }
        return this.cloneNavPoint(navPoint, flattingNavPoints);
    }

    private cloneNavPoint(navPoint: NavPoint, flattingNavPoints: NavPoint[]): NavPoint {
        const originalNavPoint = flattingNavPoints.find(x => x.key == navPoint.key)
            ?? flattingNavPoints.find(x => x.url == navPoint.url && x.startPageNumber == navPoint.startPageNumber)
            ?? navPoint;
        return deepClone<NavPoint>(originalNavPoint);
    }

    /**
     * Whether the element has reached or passed the XYZ destination on the page.
     */
    private isElementAtOrPastPdfDest(
        targetRect: DOMRect,
        pdfDest: string | undefined,
        geometry: PdfPageGeometry
    ): boolean {
        if (!pdfDest || pdfDest.indexOf("XYZ") <= 0) {
            return false;
        }
        let pdfDestArray: any[];
        try {
            pdfDestArray = JSON.parse(pdfDest) as any[];
        } catch {
            return false;
        }
        const rawY = parseFloat(pdfDestArray[3]);
        if (!Number.isFinite(rawY) || geometry.rawHeight <= 0) {
            return false;
        }

        const { rotation, rawHeight, displayWidth, displayHeight, pageRect } = geometry;
        // Scale with display size to avoid mixing pageRect width/height
        const alongReading = rotation % 180 == 0
            ? (rawY / rawHeight) * displayHeight
            : (rawY / rawHeight) * displayWidth;

        if (rotation == 0) {
            // PDF Y grows upward; DOM top grows downward
            return displayHeight - alongReading <= targetRect.top - pageRect.top;
        }
        if (rotation == 90) {
            return displayWidth - alongReading <= pageRect.right - targetRect.right;
        }
        if (rotation == 180) {
            return displayHeight - alongReading <= pageRect.bottom - targetRect.bottom;
        }
        if (rotation == 270) {
            return displayWidth - alongReading <= targetRect.left - pageRect.left;
        }
        return false;
    }

    async dispose(): Promise<void> {
        if (this.flattingNavPoints) {
            this.flattingNavPoints.splice(0);
        }
        if (this.reversedFlattingNavPoints) {
            this.reversedFlattingNavPoints.splice(0);
        }
    }


    private initialNav(nav: Nav) {
        this.flattingNavPoints = [];
        this.reversedFlattingNavPoints = undefined;
        if (!containValues(nav?.navPoints))
            return;
        this.initialNavPoints(nav.navPoints);
    }

    private initialNavPoints(navPoints: NavPoint[]) {
        if (navPoints.length == 0)
            return;
        navPoints.forEach((navPoint) => {
            // Only index entries with a resolved page. Page 0 means dest resolution failed;
            // including them in the reversed upward scan pins selection to the last TOC item.
            if (navPoint.startPageNumber > 0) {
                this.flattingNavPoints.push(navPoint);
            }
            if (containValues(navPoint.children)) {
                this.initialNavPoints(navPoint.children);
            }
        })
    }
}
