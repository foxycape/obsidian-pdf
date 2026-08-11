import { containValues } from "../../../../kernal/common/array";
import { deepClone } from "../../../../kernal/common/object";
import { isNullOrWhiteSpace } from "../../../../kernal/common/text";
import { getElementIndex } from "../../../../kernal/html/finder";
import { INavPointProvider, IFileParser, IDocumentsProvider, NavPoint, Nav, SymbolType, BrowserCapabilities } from "../../../../kernal";
import { getElementByProgress } from "../../../../kernal/html/position";
import { IHtmlDocument } from "../IHtmlDocument";
import { IHtmlTextDocument } from "../IHtmlTextDocument";
import { HtmlOptions } from "../../HtmlOptions";

export class HtmlNavPointProvider implements INavPointProvider {
    readonly fileParser: IFileParser;
    private flattingNavPoints: NavPoint[] = [];
    // Must not be initialized
    private reversedFlattingNavPoints: NavPoint[];
    private isInitNav: boolean = false;
    private navUrlWithAnchors = new Map<string, string[]>();
    private navPointsByDocUrl = new Map<string, NavPoint[]>();
    private navPointByFullUrl = new Map<string, NavPoint>();
    private isInitNavUrlWithAnchors = false;
    constructor(
        private readonly documentsProvider: IDocumentsProvider<IHtmlDocument>,
        private readonly options: HtmlOptions
    ) {
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

    private initialNav(nav: Nav) {
        this.flattingNavPoints = [];
        this.reversedFlattingNavPoints = undefined;
        this.clearNavUrlIndexes();
        if (!containValues(nav?.navPoints))
            return;
        this.initialNavPoints(nav.navPoints);
    }

    private initialNavPoints(navPoints: NavPoint[]) {
        if (navPoints.length == 0)
            return;
        navPoints.forEach((navPoint) => {
            if (!isNullOrWhiteSpace(navPoint.url) || navPoint.startPageNumber > 0) {
                this.flattingNavPoints.push(navPoint);
            }
            if (containValues(navPoint.children)) {
                this.initialNavPoints(navPoint.children);
            }
        })
    }

    private docUrls: string[];

    private toDocUrlKey = (url: string) => (url ?? "").toLowerCase();

    private clearNavUrlIndexes = () => {
        this.isInitNavUrlWithAnchors = false;
        this.navUrlWithAnchors = new Map<string, string[]>();
        this.navPointsByDocUrl = new Map<string, NavPoint[]>();
        this.navPointByFullUrl = new Map<string, NavPoint>();
    };

    private getNavPointsForDocUrl = (docUrl: string): NavPoint[] => {
        if (!docUrl)
            return [];
        return this.navPointsByDocUrl.get(this.toDocUrlKey(docUrl)) ?? [];
    };

    private getAnchorsForDocUrl = (docUrl: string): string[] | undefined => {
        if (!docUrl)
            return undefined;
        return this.navUrlWithAnchors.get(this.toDocUrlKey(docUrl));
    };

    private findNavPointByFullUrl = (fullUrl: string, docNavPoints?: NavPoint[]): NavPoint => {
        const exact = this.navPointByFullUrl.get(fullUrl);
        if (exact)
            return exact;
        const list = docNavPoints ?? this.flattingNavPoints;
        return list.find(x => x.url.indexOf(fullUrl) >= 0);
    };

    private cloneNavPoint = (navPoint: NavPoint): NavPoint => {
        if (!navPoint)
            return undefined;
        return deepClone<NavPoint>(navPoint);
    };

    /**
     * Resolve nav point by exact anchor match on elements, then nearest previous anchor by DOM index.
     */
    private resolveNavPointByElements = (
        url: string,
        ownerDocument: Document,
        exactMatchElements: Element[],
        indexElement?: Element
    ): NavPoint => {
        const docNavPoints = this.getNavPointsForDocUrl(url);
        if (docNavPoints.length == 0)
            return undefined;

        if (!indexElement && exactMatchElements.length == 0) {
            return this.cloneNavPoint(docNavPoints[docNavPoints.length - 1]);
        }

        const anchors = this.getAnchorsForDocUrl(url);
        if (!anchors || (anchors.length == 1 && anchors[0] == "")) {
            return this.cloneNavPoint(this.findNavPointByFullUrl(url, docNavPoints));
        }

        if (exactMatchElements.length > 0) {
            const elementIdSet = new Set(this.getElementIds(exactMatchElements));
            if (elementIdSet.size > 0) {
                const existVisibleAnchor = anchors.find(x => x != "" && elementIdSet.has(x));
                if (existVisibleAnchor) {
                    return this.cloneNavPoint(this.findNavPointByFullUrl(url + "#" + existVisibleAnchor, docNavPoints));
                }
            }
        }

        const referenceElement = indexElement ?? exactMatchElements[0];
        if (!referenceElement)
            return this.cloneNavPoint(docNavPoints[docNavPoints.length - 1]);

        const elementIndex = getElementIndex(ownerDocument, referenceElement, "all");
        const anchorIndexMap = new Map<string, number>();
        for (let i = 0; i < anchors.length; i++) {
            const anchor = anchors[i];
            if (anchor == "" || anchorIndexMap.has(anchor))
                continue;
            const anchorElement = ownerDocument.getElementById(anchor);
            if (anchorElement) {
                anchorIndexMap.set(anchor, getElementIndex(ownerDocument, anchorElement, "all"));
            }
        }

        for (let i = anchors.length - 1; i >= 0; i--) {
            const anchor = anchors[i];
            if (anchor == "") {
                return this.cloneNavPoint(this.findNavPointByFullUrl(url, docNavPoints));
            }
            const index = anchorIndexMap.get(anchor);
            if (index !== undefined && index <= elementIndex) {
                return this.cloneNavPoint(this.findNavPointByFullUrl(url + "#" + anchor, docNavPoints));
            }
        }
        return this.cloneNavPoint(docNavPoints[0]);
    };

    private async findPreviousDocNavPoint(docUrl: string): Promise<NavPoint> {
        const documents = await this.fileParser.getTextDocuments();
        const currentIndex = documents.findIndex(x => this.toDocUrlKey(x.url) == this.toDocUrlKey(docUrl));
        if (currentIndex < 0)
            return undefined;

        for (let i = currentIndex; i >= 0; i--) {
            const docNavPoints = this.getNavPointsForDocUrl(documents[i].url);
            if (docNavPoints.length > 0) {
                return this.cloneNavPoint(docNavPoints[docNavPoints.length - 1]);
            }
        }
        return undefined;
    }

    async getCurrentNavPoint(): Promise<NavPoint> {
        const flattingNavPoints = await this.getFlattingNavPoints();
        if (flattingNavPoints.length == 0)
            return undefined;
        await this.initNavUrlWithAnchors();
        await BrowserCapabilities.yieldToMain();
        const firstVisibleDocument = this.documentsProvider.getFirstVisibleDocument();
        if (!firstVisibleDocument) {
            // No visible document
            return undefined;
        }

        const url = firstVisibleDocument.url ?? "";
        const docNavPoints = this.getNavPointsForDocUrl(url);
        if (docNavPoints.length > 0) {
            // Current visible document has nav points
            const visibleElements = firstVisibleDocument.getVisibleElements();
            if (visibleElements.length == 0) {
                return this.cloneNavPoint(docNavPoints[docNavPoints.length - 1]);
            }

            const anchors = this.getAnchorsForDocUrl(url);
            if (!anchors || (anchors.length == 1 && anchors[0] == "")) {
                return this.cloneNavPoint(this.findNavPointByFullUrl(url, docNavPoints));
            }

            const visibleInWindowElements = firstVisibleDocument.getVisibleElements(true);
            const indexElement = visibleInWindowElements.length > 0
                ? visibleInWindowElements[0]
                : visibleElements[visibleElements.length - 1];
            const currentDocument = firstVisibleDocument.getContentContainer()?.ownerDocument;
            if (!currentDocument)
                return undefined;

            return this.resolveNavPointByElements(
                url,
                currentDocument,
                visibleInWindowElements,
                indexElement
            );
        }

        // Current visible document has no nav points
        // Search backward for a document that has nav points
        const documents = this.documentsProvider.getDocuments();
        try {
            const currentIndex = documents.indexOf(firstVisibleDocument);
            // Process in chunks to avoid UI jank
            const group: string[][] = [];
            const step = 25;
            let urls: string[] = [];
            for (let i = 0; i <= currentIndex; i++) {
                urls.push(documents[i].url)
                if (i > 0 && i % step == step - 1) {
                    group.push(urls);
                    urls = [];
                }
            }
            if (urls.length > 0) {
                group.push(urls);
            }
            group.reverse();
            for (let i = 0; i < group.length; i++) {
                const currentUrls = group[i];
                const docNavPoint = this.findGroupNavPoint(currentUrls);
                await BrowserCapabilities.yieldToMain();
                if (docNavPoint) {
                    return this.cloneNavPoint(docNavPoint);
                }
            }

            return undefined;
        } catch (e) {

            return undefined;
        }
        finally {
            // console.timeEnd('find navpoint')
        }
    }


    private findGroupNavPoint = (urls: string[]) => {
        for (let i = urls.length - 1; i >= 0; i--) {
            const docNavPoints = this.getNavPointsForDocUrl(urls[i]);
            if (docNavPoints.length > 0) {
                // Match previous flattingNavPoints.find behavior: first nav point for the doc
                return docNavPoints[0];
            }
        }
        return null;
    }

    async getNavPoint(url: string, target: Element | number, symbolType: SymbolType): Promise<NavPoint> {
        const flattingNavPoints = await this.getFlattingNavPoints();
        if (flattingNavPoints.length == 0)
            return undefined;

        await this.initNavUrlWithAnchors();

        let ownerDocument: Document;
        let element: Element;
        const docUrl = url;

        if (typeof target === "number") {
            const doc = await this.fileParser.getTextDocument(url) as IHtmlTextDocument;
            if (!doc)
                return undefined;
            ownerDocument = await doc.getFormattedDocument();
            if (!ownerDocument) {
                return undefined;
            }
            element = getElementByProgress(ownerDocument, target, symbolType, {
                removeHtmlWhitespace: this.options.removeHtmlWhitespace,
                whitespaceRegex: this.options.whitespaceRegex,
                nonWhiteSpaceSymbolTagNames: this.options.nonWhiteSpaceSymbolTagNames,
            }).element;
        }
        else {
            ownerDocument = target.ownerDocument;
            element = target;
        }

        const docNavPoints = this.getNavPointsForDocUrl(docUrl);
        if (docNavPoints.length > 0) {
            if (!element) {
                return this.cloneNavPoint(docNavPoints[docNavPoints.length - 1]);
            }
            return this.resolveNavPointByElements(docUrl, ownerDocument, [element], element);
        }

        return await this.findPreviousDocNavPoint(docUrl);
    }

    private async initNavUrlWithAnchors(): Promise<void> {
        if (this.isInitNavUrlWithAnchors)
            return;
        const flattingNavPoints = await this.getFlattingNavPoints();
        this.navUrlWithAnchors = new Map<string, string[]>();
        this.navPointsByDocUrl = new Map<string, NavPoint[]>();
        this.navPointByFullUrl = new Map<string, NavPoint>();
        flattingNavPoints.forEach((navPoint) => {
            const url = navPoint.url;
            if (isNullOrWhiteSpace(url))
                return;

            this.navPointByFullUrl.set(url, navPoint);

            const anchorPosition = url.lastIndexOf("#");
            const path = anchorPosition > 0 ? url.substring(0, anchorPosition) : url;
            const anchor = anchorPosition > 0 ? url.substring(anchorPosition + 1) : "";
            const pathKey = this.toDocUrlKey(path);

            if (this.navUrlWithAnchors.has(pathKey)) {
                this.navUrlWithAnchors.get(pathKey).push(anchor);
            }
            else {
                this.navUrlWithAnchors.set(pathKey, [anchor]);
            }

            if (this.navPointsByDocUrl.has(pathKey)) {
                this.navPointsByDocUrl.get(pathKey).push(navPoint);
            }
            else {
                this.navPointsByDocUrl.set(pathKey, [navPoint]);
            }
        });
        this.isInitNavUrlWithAnchors = true;
    }
    /**
     * Collect ids related to the given elements
     * @param elements
     * @returns
     */
    private getElementIds(elements: Element[]) {
        const ids = [];
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (!isNullOrWhiteSpace(element.id)) {
                ids.push(element.id);
            }
            // Observed elements do not include children.
            // In some cases the element is wrapped by a parent (e.g. an <a> tag)
            // that holds the id, which would make nav positioning inaccurate;
            // therefore include the parent element id as well.
            if (element.parentElement && element.parentElement.children.length == 1 && !isNullOrWhiteSpace(element.parentElement.id)) {
                ids.push(element.parentElement.id);
            }
            this.getChildrenIds(element.children, ids);
        }
        return ids;
    }
    private getChildrenIds(elements: HTMLCollection, ids: string[]) {
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (!isNullOrWhiteSpace(element.id)) {
                ids.push(element.id);
            }
            if (element.children.length > 0) {
                this.getChildrenIds(element.children, ids);
            }
        }
    }

    async dispose(): Promise<void> {
        if (this.docUrls) {
            this.docUrls.splice(0)
        }
        if (this.flattingNavPoints) {
            this.flattingNavPoints.splice(0);
        }
        if (this.reversedFlattingNavPoints) {
            this.reversedFlattingNavPoints.splice(0);
        }
        this.clearNavUrlIndexes();
    }
}
