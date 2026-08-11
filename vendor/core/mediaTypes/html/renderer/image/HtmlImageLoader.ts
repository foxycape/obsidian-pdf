import { convertArrayBufferToString } from "../../../../kernal/common/encoding";
import { parseNumber } from "../../../../kernal/common/number";
import { isNullOrWhiteSpace, startsWith } from "../../../../kernal/common/text";
import { checkIsAbsoluteUrl, checkIsBlobUrl } from "../../../../kernal/common/url";
import { compareTagName, getDocumentBody } from "../../../../kernal/html/finder";
import { getImageSize } from "../../../../kernal/html/image";
import { injectCssContent } from "../../../../kernal/html/injector";
import { getFormatDocument } from "../../../../kernal/html/parser";
import {
    asyncDebounce,
    BrowserCapabilities,
    ElementInitialNumberName,
    EventNames,
    IDocument,
    IDocumentsProvider,
    IEventEmitter,
    ILogger,
    IStorage,
} from "../../../../kernal";
import { HtmlOptions } from "../../HtmlOptions";
import { HtmlSettings } from "../../HtmlSettings";
import { IHtmlDocument } from "../IHtmlDocument";
import { HtmlLayoutMetrics } from "../layout/HtmlLayoutMetrics";
import { ContentLayoutCssVariableNames } from "../style/ContentLayoutCssVariableNames";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import errorImageUrl from "./error-image.png";
import { IHtmlImageLoader } from "./IHtmlImageLoader";

const SVG_STYLE_CLASS = "lhx-svg";
const IMAGE_SIZES_TABLE_PREFIX = "imageSizes-";
const PRELOAD_IMAGE_COUNT = 5;

type ImageSizeDescriptor = {
    url: string;
    width: number;
    height: number;
    checked: boolean;
};

type ImageSizesSummary = {
    total: number;
    checkedCount: number;
    descriptors: Map<string, ImageSizeDescriptor>;
};

type ImageElement = HTMLImageElement | SVGImageElement;

type ResetImageSizeTask = {
    image: ImageElement;
    columnWidth: number;
    columnHeight: number;
};

export class HtmlImageLoader implements IHtmlImageLoader {
    private readonly documentImageSizesSummaries = new Map<Document, ImageSizesSummary>();
    private readonly blobUrls = new Map<IDocument, string[]>();
    private readonly events: IEventEmitter;
    private readonly logger: ILogger;
    private isDisposed = false;
    private resetImageSizeTasks: ResetImageSizeTask[] = [];

    constructor(
        private readonly documentsProvider: IDocumentsProvider<IHtmlDocument>,
        private readonly rendererViewport: IRendererViewport<HtmlLayoutMetrics>,
        private readonly htmlOptions: HtmlOptions
    ) {
        this.events = this.documentsProvider.owner.events;
        this.logger = this.documentsProvider.owner.loggerFactory.getLogger(this.constructor.name);
        this.bindEvents();
    }

    private bindEvents() {
        this.events.on(EventNames.LayoutChange, this.onLayoutChange);
        this.events.on(EventNames.DocumentDisposing, this.onDocumentDisposing);
        this.events.on(EventNames.ImageElementsVisible, this.delayLoadOnImageElementsVisible);
    }

    private unbindEvents() {
        this.events.off(EventNames.LayoutChange, this.onLayoutChange);
        this.events.off(EventNames.DocumentDisposing, this.onDocumentDisposing);
        this.events.off(EventNames.ImageElementsVisible, this.delayLoadOnImageElementsVisible);
    }

    private onDocumentDisposing = (doc: IDocument) => {
        this.revokeDocumentBlobUrls(doc);
    };

    private addBlobUrl(doc: IDocument, url: string) {
        if (!checkIsBlobUrl(url)) {
            return;
        }
        const list = this.blobUrls.get(doc);
        if (list) {
            list.push(url);
        } else {
            this.blobUrls.set(doc, [url]);
        }
    }

    private revokeDocumentBlobUrls(doc: IDocument) {
        const urls = this.blobUrls.get(doc);
        if (!urls) {
            return;
        }
        for (const url of urls) {
            this.revokeObjectURL(url);
        }
        this.blobUrls.delete(doc);
    }

    private onImageElementsVisible = async (map: Map<IHtmlDocument, Element[]>) => {
        for (const [doc, elements] of map.entries()) {
            await this.loadImages(doc, elements);
        }
    };

    private delayLoadOnImageElementsVisible = asyncDebounce(this.onImageElementsVisible, 100);

    private onLayoutChange = async () => {
        await this.delayResetAllImageSize();
    };

    private resetAllImageSize = async () => {
        for (const doc of this.documentsProvider.getLoadedDocuments()) {
            await this.resetImageSize(doc);
        }
    };

    private delayResetAllImageSize = asyncDebounce(this.resetAllImageSize, 100);

    /**
     * Preprocess document images (placeholder, size probing, inline styles).
     * Intended to be registered on documentPreprocesses.
     */
    async preprocessImages(doc: IDocument): Promise<void> {
        const htmlDocument = doc as IHtmlDocument;
        const ownerDocument = (await htmlDocument.getVirtualContentContainer())?.ownerDocument;
        if (!ownerDocument) {
            return;
        }
        await this.prepareImageSize(htmlDocument, ownerDocument);
        await this.setImagePreviewUrl(ownerDocument);
    }

    private async setImagePreviewUrl(virtualDocument: Document): Promise<void> {
        const { default: placeholderImageUrl } = await import("./placeholder.png");
        const images = virtualDocument.getElementsByTagName("img");
        const svgImages = virtualDocument.getElementsByTagName("image");

        for (let i = 0; i < images.length; i++) {
            this.applyPreviewUrl(images[i], images[i].getAttribute("src"), placeholderImageUrl, false);
        }
        for (let i = 0; i < svgImages.length; i++) {
            const svgImage = svgImages[i];
            const svgImageUrl = svgImage.getAttribute("xlink:href") ?? svgImage.getAttribute("href");
            this.applyPreviewUrl(svgImage, svgImageUrl, placeholderImageUrl, true);
        }
    }

    private applyPreviewUrl(
        element: ImageElement,
        imageUrl: string | null,
        placeholderImageUrl: string,
        isSvgImage: boolean
    ) {
        let currentPreviewUrl = element.getAttribute("data-preview-src");
        if (isNullOrWhiteSpace(currentPreviewUrl)) {
            currentPreviewUrl = placeholderImageUrl;
            element.setAttribute("data-preview-src", placeholderImageUrl);
        }

        if (imageUrl != placeholderImageUrl) {
            const currentDataSrc = element.getAttribute("data-src");
            if (currentDataSrc != placeholderImageUrl) {
                element.setAttribute("data-src", imageUrl ?? "");
            }
        } else {
            element.removeAttribute("data-loaded");
        }

        if (isSvgImage) {
            element.setAttribute("xlink:href", currentPreviewUrl);
        } else {
            (element as HTMLImageElement).src = currentPreviewUrl;
        }
        element.setAttribute("data-preset-preview-url", "true");
        this.setImageStyle(element);
    }

    private setImageStyle(element: ImageElement) {
        const parent = element.parentElement;
        if (parent && parent.children.length == 1 && isNullOrWhiteSpace(parent.innerText)) {
            if (!BrowserCapabilities.supportCssHas()) {
                parent.classList.add(HtmlSettings.BreakInsideAvoid);
            }
            parent.style.removeProperty("width");
            parent.style.removeProperty("height");
        }
    }

    private prepareImageSize = async (doc: IHtmlDocument, virtualDocument: Document): Promise<void> => {
        const css = `.${SVG_STYLE_CLASS} {width: 100% !important; height: auto !important; }`;
        injectCssContent(virtualDocument, css, false, "lhx-svg-style");

        const images: ImageElement[] = [
            ...virtualDocument.getElementsByTagName("img"),
            ...virtualDocument.getElementsByTagName("image"),
        ] as ImageElement[];
        const imageSizesSummary = this.getImageSizesSummary(virtualDocument);
        imageSizesSummary.total = images.length;

        const documents = this.documentsProvider.getDocuments();
        const docIndex = documents.indexOf(doc);
        const resourceId = this.getResourceId();
        const storage = await this.getStorage();
        let imageSizes: ImageSizeDescriptor[] | null = null;
        if (docIndex >= 0 && storage && resourceId) {
            imageSizes = await storage.get(IMAGE_SIZES_TABLE_PREFIX + resourceId, docIndex.toString());
        }

        const requireEmitProgress = images.length > 100;
        for (let i = 0; i < images.length; i++) {
            if (this.isDisposed) {
                return;
            }
            try {
                const image = images[i];
                if (image.parentElement && compareTagName(image.parentElement.tagName, "SVG")) {
                    image.parentElement.classList.add(SVG_STYLE_CLASS);
                }
                const imageUrl = this.getImageUrl(image);
                let imageSize = imageSizes?.find((x) => x.url == imageUrl);
                if (!imageSize) {
                    imageSize = await this.prefetchImageSize(doc, image, true);
                }
                if (imageSize) {
                    this.resetImageStyles(image, imageSize.width, imageSize.height);
                    this.resetInlineImageSize(image);
                }
                if (requireEmitProgress && i % 10 == 0) {
                    this.events.emit(EventNames.ProcessedImageCount, {
                        doc,
                        totalImageCount: images.length,
                        processedImageCount: i,
                    });
                    await BrowserCapabilities.yieldToMain();
                }
            } catch (e) {
                this.logger.error(e);
            }
        }

        if (docIndex >= 0 && storage && resourceId) {
            await this.persistImageSizes(storage, resourceId, docIndex.toString(), imageSizes, imageSizesSummary);
        }
    };

    private async persistImageSizes(
        storage: IStorage,
        resourceId: string,
        docKey: string,
        existing: ImageSizeDescriptor[] | null,
        summary: ImageSizesSummary
    ) {
        const newImageSizes = Array.from(summary.descriptors.values()).filter((x) => x.width > 0);
        if (newImageSizes.length == 0) {
            return;
        }
        const tableName = IMAGE_SIZES_TABLE_PREFIX + resourceId;
        if (existing && existing.length > 0) {
            const urls = new Set(existing.map((x) => x.url));
            const diff = newImageSizes.filter((x) => !urls.has(x.url));
            if (diff.length > 0) {
                existing.push(...diff);
                await storage.set(tableName, docKey, existing);
            }
        } else {
            await storage.set(tableName, docKey, newImageSizes);
        }
    }

    private getResourceId(): string {
        const context = this.documentsProvider.owner.context;
        return isNullOrWhiteSpace(context.simpleId) ? context.id : context.simpleId;
    }

    private async getStorage(): Promise<IStorage | undefined> {
        return await this.documentsProvider.owner.services.get("storage");
    }

    private getImageSizesSummary(ownerDocument: Document): ImageSizesSummary {
        let summary = this.documentImageSizesSummaries.get(ownerDocument);
        if (!summary) {
            summary = { total: 0, checkedCount: 0, descriptors: new Map() };
            this.documentImageSizesSummaries.set(ownerDocument, summary);
        }
        return summary;
    }

    private getImageUrl = (image: ImageElement) => {
        const presetPreviewUrl = image.getAttribute("data-preset-preview-url") == "true";
        if (compareTagName(image.tagName, "IMAGE")) {
            if (presetPreviewUrl) {
                return image.getAttribute("data-src")
                    ?? image.getAttribute("xlink:href")
                    ?? image.getAttribute("href");
            }
            return image.getAttribute("xlink:href") ?? image.getAttribute("href");
        }
        if (presetPreviewUrl) {
            return image.getAttribute("data-src");
        }
        return image.getAttribute("src");
    };

    private async prefetchImageSize(doc: IHtmlDocument, image: ImageElement, required: boolean) {
        const imageUrl = this.getImageUrl(image);
        const imageWidth = image.getAttribute("data-width");
        if (imageWidth != undefined) {
            const imageHeight = parseNumber(image.getAttribute("data-height"), 0);
            return this.addImageDescriptor(image, imageUrl, parseNumber(imageWidth, 0), imageHeight, true);
        }

        if (!required) {
            return this.addImageDescriptor(image, imageUrl, 0, 0, false);
        }

        const imageSizesSummary = this.getImageSizesSummary(image.ownerDocument);
        const cached = imageSizesSummary.descriptors.get(imageUrl);
        if (cached) {
            return cached;
        }

        let width = 0;
        let height = 0;
        try {
            if (checkIsAbsoluteUrl(imageUrl)) {
                const imageSize = await getImageSize(imageUrl);
                width = imageSize.width;
                height = imageSize.height;
            } else {
                const blob = await doc.fileParser.getFile(imageUrl, doc.url, "blob");
                const data = blob && blob.size > 0 ? blob : errorImageUrl;
                try {
                    const imageSize = await getImageSize(data);
                    width = imageSize.width;
                    height = imageSize.height;
                } catch {
                    // keep 0
                }
            }
        } catch (e) {
            this.logger.error(e);
        }

        return this.addImageDescriptor(image, imageUrl, width, height, width <= 0);
    }

    private revokeObjectURL(imageUrl: string) {
        if (!imageUrl || !startsWith(imageUrl, "blob:", true)) {
            return;
        }
        try {
            URL.revokeObjectURL(imageUrl);
        } catch {
            // ignore
        }
    }

    private addImageDescriptor(
        image: ImageElement,
        imageUrl: string,
        width: number,
        height: number,
        checked: boolean
    ): ImageSizeDescriptor {
        const imageSizesSummary = this.getImageSizesSummary(image.ownerDocument);
        let descriptor = imageSizesSummary.descriptors.get(imageUrl);
        if (!descriptor) {
            descriptor = { url: imageUrl, width, height, checked };
            if (checked) {
                imageSizesSummary.checkedCount += 1;
            }
            imageSizesSummary.descriptors.set(imageUrl, descriptor);
            return descriptor;
        }
        if (!descriptor.checked && checked) {
            imageSizesSummary.checkedCount += 1;
        }
        descriptor.width = width;
        descriptor.height = height;
        descriptor.url = imageUrl;
        descriptor.checked = checked;
        return descriptor;
    }

    private setWidthAndHeight(image: ImageElement, width: number, height: number) {
        if (width > 0 && height > 0) {
            const imageWidth = parseNumber(image.getAttribute("data-width"), 0, "parseInt");
            if (imageWidth <= 0) {
                image.setAttribute("data-width", `${width}`);
                image.setAttribute("data-height", `${height}`);
            }
        }
    }

    private getColumnMetrics(): { columnWidth: number; columnHeight: number } {
        const metrics = this.rendererViewport.getLayoutMetrics();
        return {
            columnWidth: metrics.columnWidth,
            columnHeight: metrics.columnHeight,
        };
    }

    private resetImageStyles = (
        image: ImageElement,
        width: number,
        height: number
    ) => {
        if (width <= 0 || height <= 0 || !BrowserCapabilities.supportCssAspectRatio()) {
            return;
        }
        this.setWidthAndHeight(image, width, height);
        let targetElement: HTMLElement = image as HTMLElement;
        if (compareTagName(image.tagName, "IMAGE")) {
            targetElement = image.parentElement;
        }
        if (!targetElement) {
            return;
        }
        targetElement.setAttribute("width", `${width}`);
        targetElement.setAttribute("height", `${height}`);
        const aspectRatio = width / height;
        const { columnWidth, columnHeight } = this.getColumnMetrics();
        let maxHeight = height;
        if (columnWidth > 0 && width > columnWidth) {
            maxHeight = (columnWidth / width) * height;
        }
        const maxHeightValue = columnHeight > 0
            ? `min(${maxHeight}px,${columnHeight}px)`
            : `${maxHeight}px`;
        const widthValue = `calc(100% * var(${ContentLayoutCssVariableNames.MaxImageWidthRatio}))`;
        if (targetElement.getAttribute("style")) {
            targetElement.style.width = widthValue;
            targetElement.style.height = "auto";
            targetElement.style.maxWidth = widthValue;
            targetElement.style.maxHeight = maxHeightValue;
            targetElement.style.aspectRatio = `${aspectRatio}`;
        } else {
            targetElement.setAttribute(
                "style",
                `max-width:${widthValue};height:auto;max-height:${maxHeightValue};aspect-ratio:${aspectRatio};width:${widthValue}`
            );
        }
    };

    private resetImageWidthHeight = (task: ResetImageSizeTask) => {
        if (task.image.style) {
            task.image.style.setProperty("width", "auto", "important");
            task.image.style.setProperty("max-width", "100%", "important");
            task.image.style.setProperty("max-height", "100%", "important");
        } else {
            task.image.setAttribute("style", "width:auto !important;max-width:100% !important;max-height:100% !important");
        }
        this.resetImageHeight(task.image, task.columnWidth, task.columnHeight, this.htmlOptions.maxImageHeightRatio);
    };

    private flushResetImageSizeTasks = async () => {
        if (BrowserCapabilities.supportCssAspectRatio()) {
            this.resetImageSizeTasks = [];
            return;
        }
        while (this.resetImageSizeTasks.length > 0) {
            if (this.isDisposed) {
                this.resetImageSizeTasks = [];
                return;
            }
            const task = this.resetImageSizeTasks.shift();
            if (!task) {
                break;
            }
            this.resetImageWidthHeight(task);
            await BrowserCapabilities.yieldToMain();
        }
    };

    resetImageSize = async (doc: IDocument) => {
        const ownerDocument = doc.getContentContainer()?.ownerDocument;
        if (!ownerDocument || !getDocumentBody(ownerDocument)) {
            return;
        }
        const { columnWidth, columnHeight } = this.getColumnMetrics();
        const images = [
            ...ownerDocument.getElementsByTagName("img"),
            ...ownerDocument.getElementsByTagName("image"),
        ] as ImageElement[];

        if (this.checkIsOnlyOneImageInDocument(ownerDocument)) {
            const element = images[0];
            this.handleOnlyOneImageInDocument(columnWidth, columnHeight, element);
            await this.loadSingleImage(doc as IHtmlDocument, element);
            return;
        }

        for (const image of images) {
            this.resetImageSizeTasks.push({ image, columnWidth, columnHeight });
        }
        await this.flushResetImageSizeTasks();

        for (let i = 0; i < Math.min(PRELOAD_IMAGE_COUNT, images.length); i++) {
            await this.loadSingleImage(doc as IHtmlDocument, images[i]);
        }
    };

    private resetInlineImageSize(element: ImageElement) {
        const width = parseNumber(element.getAttribute("data-width"), 0);
        const height = parseNumber(element.getAttribute("data-height"), 0);
        if (width <= 0 || height <= 0) {
            return;
        }

        let foundInlineImage = false;
        if (height <= 200) {
            foundInlineImage = this.checkIsInlineImage(element, width, height).foundInlineImage;
        } else {
            const hasAdjacentText =
                (element.previousSibling?.nodeType == Node.TEXT_NODE && element.previousSibling.textContent?.trim()?.length > 0)
                || (element.nextSibling?.nodeType == Node.TEXT_NODE && element.nextSibling.textContent?.trim()?.length > 0);
            if (hasAdjacentText) {
                foundInlineImage = this.checkIsInlineImage(element, width, height).foundInlineImage;
            }
        }

        const targetElement = compareTagName(element.tagName, "IMG")
            ? (element as HTMLImageElement)
            : element.parentElement;
        if (!foundInlineImage || !targetElement) {
            return;
        }

        const actualHeight = "1em";
        if (element.getAttribute("style")) {
            element.style.setProperty("width", "auto", "important");
            element.style.setProperty("max-width", "100%", "important");
            element.style.setProperty("height", actualHeight, "important");
            element.style.setProperty("margin-block-start", "0", "important");
            element.style.setProperty("margin-block-end", "0", "important");
        } else {
            element.setAttribute(
                "style",
                `width:auto !important;max-width:100% !important;height:${actualHeight} !important;margin-block-start:0 !important;margin-block-end:0 !important;`
            );
        }
        targetElement.style.setProperty("vertical-align", "-0.2em", "important");
        targetElement.setAttribute("data-inline-image", "true");
    }

    private handleOnlyOneImageInDocument(
        columnWidth: number,
        columnHeight: number,
        element: ImageElement
    ) {
        const ownerDocument = element.ownerDocument;
        const body = getDocumentBody(ownerDocument);
        if (!isNullOrWhiteSpace(body.getAttribute("data-handled-one-image"))) {
            return;
        }
        body.setAttribute("data-handled-one-image", "true");
        body.style.setProperty("display", "flex", "important");
        body.style.setProperty("height", "100%", "important");
        body.style.setProperty("justify-content", "center", "important");
        body.style.setProperty("align-items", "center", "important");

        let targetElement: HTMLElement = element as HTMLImageElement;
        if (compareTagName(element.parentElement?.tagName, "SVG")) {
            targetElement = element.parentElement;
            element.style.setProperty("width", "auto", "important");
            element.style.setProperty("max-width", "100%", "important");
            element.style.setProperty("max-height", columnHeight + "px", "important");
            element.style.setProperty("display", "block", "important");
        }
        targetElement.style.setProperty("width", "auto", "important");
        targetElement.style.setProperty("max-width", "100%", "important");
        targetElement.style.setProperty("display", "block", "important");
        if (targetElement.parentElement) {
            targetElement.parentElement.style.textAlign = "center";
        }
        this.resetImageHeight(element, columnWidth, columnHeight, 0.95, true);
    }

    private resetImageHeight(
        element: ImageElement,
        columnWidth: number,
        columnHeight: number,
        maxImageHeightRatio: number,
        preferRatioNumber?: boolean
    ) {
        const targetElement: HTMLElement | SVGElement | null = compareTagName(element.tagName, "IMAGE")
            ? element.parentElement
            : element;
        if (!targetElement) {
            return;
        }
        const width = parseNumber(element.getAttribute("data-width"), 0);
        const height = parseNumber(element.getAttribute("data-height"), 0);
        if (width <= 0 || height <= 0) {
            return;
        }
        this.forceSetImageHeight(targetElement, columnWidth, columnHeight, width, height, maxImageHeightRatio, preferRatioNumber);
    }

    private forceSetImageHeight(
        element: HTMLElement | SVGElement,
        columnWidth: number,
        columnHeight: number,
        width: number,
        height: number,
        maxImageHeightRatio: number,
        preferRatioNumber?: boolean
    ) {
        if (BrowserCapabilities.supportCssMinMaxFunction()) {
            let styleValue: string;
            if (maxImageHeightRatio && preferRatioNumber) {
                styleValue = `min(calc(${height}px * ${maxImageHeightRatio}),calc(var(${ContentLayoutCssVariableNames.ColumnHeight}) * ${maxImageHeightRatio}),calc(var(${ContentLayoutCssVariableNames.ColumnWidth}) / ${width} * ${height} * ${maxImageHeightRatio}))`;
            } else {
                styleValue = `min(calc(${height}px * var(${ContentLayoutCssVariableNames.MaxImageHeightRatio})),calc(var(${ContentLayoutCssVariableNames.ColumnHeight}) * var(${ContentLayoutCssVariableNames.MaxImageHeightRatio})),calc(var(${ContentLayoutCssVariableNames.ColumnWidth}) / ${width} * ${height} * var(${ContentLayoutCssVariableNames.MaxImageHeightRatio})))`;
            }
            element.style.setProperty("height", styleValue, "important");
        } else {
            const actualHeight = this.calcImageHeight(columnWidth, columnHeight, width, height) * maxImageHeightRatio;
            element.style.setProperty("height", actualHeight + "px", "important");
        }
    }

    private calcImageHeight(columnWidth: number, columnHeight: number, width: number, height: number) {
        if (columnHeight >= height && columnWidth >= width) {
            return height;
        }
        const columnRatio = columnWidth / columnHeight;
        const imageRatio = width / height;
        if (columnRatio <= imageRatio) {
            return (columnWidth / width) * height;
        }
        return columnHeight;
    }

    private checkIsOnlyOneImageInDocument(ownerDocument: Document): boolean {
        const body = getDocumentBody(ownerDocument);
        if (!body || body.textContent.trim()) {
            return false;
        }
        return body.getElementsByTagName("img").length == 1 || body.getElementsByTagName("image").length == 1;
    }

    private checkIsInlineTag(node: Node) {
        const nodeName = node.nodeName;
        if (isNullOrWhiteSpace(nodeName)) {
            return false;
        }
        return this.htmlOptions.htmlInlineTags.indexOf(nodeName.toLowerCase()) >= 0;
    }

    private checkIsInlineImage(
        element: ImageElement,
        _originWidth?: number,
        originHeight?: number
    ): { foundInlineImage: boolean; imageHeight: number } {
        let { foundInlineImage, imageHeight } = this.getInlineImageProperties(element, originHeight);
        if (foundInlineImage) {
            return { foundInlineImage, imageHeight };
        }

        let parentElement = element.parentElement;
        let lastElement: Element = element;
        while (parentElement && !compareTagName(parentElement.tagName, "BODY")) {
            if (parentElement.children.length > 1 || (parentElement.children.length == 1 && parentElement.textContent.trim().length > 0)) {
                return this.getInlineImageProperties(lastElement, originHeight);
            }
            lastElement = parentElement;
            parentElement = parentElement.parentElement;
        }
        return { foundInlineImage, imageHeight };
    }

    private findSiblingNodes(element: Element) {
        let previousSiblingNode: Node = element.previousSibling;
        let nextSiblingNode: Node = element.nextSibling;
        while (previousSiblingNode != null) {
            if (!isNullOrWhiteSpace(previousSiblingNode.textContent)) {
                break;
            }
            if (previousSiblingNode.nodeType == Node.ELEMENT_NODE) {
                break;
            }
            previousSiblingNode = previousSiblingNode.previousSibling;
        }
        while (nextSiblingNode != null) {
            if (!isNullOrWhiteSpace(nextSiblingNode.textContent)) {
                break;
            }
            if (nextSiblingNode.nodeType == Node.ELEMENT_NODE) {
                break;
            }
            nextSiblingNode = nextSiblingNode.nextSibling;
        }
        return { previousSiblingNode, nextSiblingNode };
    }

    private getInlineImageProperties(element: Element, originHeight?: number) {
        const { previousSiblingNode, nextSiblingNode } = this.findSiblingNodes(element);
        let foundInlineImage = false;
        let imageHeight: number;
        if (!previousSiblingNode && !nextSiblingNode) {
            return { foundInlineImage, imageHeight };
        }

        const iframeWindow = previousSiblingNode?.ownerDocument?.defaultView
            ?? nextSiblingNode?.ownerDocument?.defaultView;
        let baselineElement: Element;
        if (previousSiblingNode?.nodeType == Node.TEXT_NODE && !isNullOrWhiteSpace(previousSiblingNode.nodeValue)) {
            baselineElement = previousSiblingNode.parentElement;
        } else if (nextSiblingNode?.nodeType == Node.TEXT_NODE && !isNullOrWhiteSpace(nextSiblingNode.nodeValue)) {
            baselineElement = nextSiblingNode.parentElement;
        } else if (previousSiblingNode && this.checkIsInlineTag(previousSiblingNode)) {
            baselineElement = previousSiblingNode as Element;
        } else if (nextSiblingNode && this.checkIsInlineTag(nextSiblingNode)) {
            baselineElement = nextSiblingNode as Element;
        }

        if (!baselineElement) {
            return { foundInlineImage, imageHeight };
        }

        const coefficient = 1.25;
        const css = iframeWindow?.getComputedStyle(baselineElement);
        let fontSize: number;
        let lineHeight: number;
        let currentHeight: number;
        if (css) {
            fontSize = parseFloat(css.fontSize);
            lineHeight = parseFloat(css.lineHeight);
            currentHeight = parseFloat(css.height);
        } else {
            fontSize = 20;
            lineHeight = fontSize * coefficient;
            currentHeight = lineHeight;
        }

        const maxLineHeight = lineHeight > fontSize * coefficient ? fontSize * coefficient : lineHeight;
        if (this.checkElementIsFootnote(element)
            || (compareTagName(element.parentElement?.tagName, "A")
                && (compareTagName(element.parentElement?.parentElement?.tagName, "SUB")
                    || compareTagName(element.parentElement?.parentElement?.tagName, "SUP")))) {
            imageHeight = fontSize;
        } else if (currentHeight && currentHeight <= maxLineHeight) {
            imageHeight = currentHeight;
        } else {
            imageHeight = maxLineHeight;
        }

        if (originHeight && originHeight < imageHeight) {
            imageHeight = originHeight;
        }
        foundInlineImage = true;
        return { foundInlineImage, imageHeight };
    }

    private checkElementIsFootnote(element: Element): boolean {
        if (element.getAttribute("class")?.indexOf("footnote") >= 0
            || element.getAttribute("epub:type") == "noteref"
            || compareTagName(element.tagName, "SUB")
            || compareTagName(element.tagName, "SUP")) {
            return true;
        }
        if (element.children.length > 0) {
            return this.checkElementIsFootnote(element.children[0]);
        }
        return false;
    }

    async loadImages(doc: IDocument, visibleElements: Element[]): Promise<void> {
        const htmlDocument = doc as IHtmlDocument;
        if (!htmlDocument || !visibleElements?.length) {
            return;
        }
        for (const element of visibleElements) {
            if (this.isDisposed || !element) {
                return;
            }
            const currentWindow = element.ownerDocument.defaultView;
            if (!currentWindow) {
                continue;
            }
            if (element instanceof currentWindow.HTMLImageElement || element instanceof currentWindow.SVGImageElement) {
                const initialNumber = element.getAttribute(ElementInitialNumberName);
                const originElement = element.ownerDocument.querySelector(
                    `[${ElementInitialNumberName}='${initialNumber}']`
                ) as ImageElement | null;
                if (originElement) {
                    await this.loadSingleImage(htmlDocument, originElement);
                }
            } else {
                const imgs = element.getElementsByTagName("img");
                for (let i = 0; i < imgs.length; i++) {
                    await this.loadSingleImage(htmlDocument, imgs[i]);
                }
                const initialNumber = element.getAttribute(ElementInitialNumberName);
                const currentElement = doc.getContentContainer()?.querySelector(
                    `[${ElementInitialNumberName}='${initialNumber}']`
                );
                const svgImages = (currentElement && currentElement != element
                    ? currentElement.getElementsByTagName("image")
                    : element.getElementsByTagName("image")) as HTMLCollectionOf<SVGImageElement>;
                for (let i = 0; i < svgImages.length; i++) {
                    await this.loadSingleImage(htmlDocument, svgImages[i]);
                }
            }
        }
    };

    private async loadSingleImage(doc: IHtmlDocument, element: ImageElement): Promise<void> {
        if (!element || !doc) {
            return;
        }
        const loadState = element.getAttribute("data-load-state");
        if (loadState == "loaded" || loadState == "loading" || loadState == "fail") {
            return;
        }
        element.setAttribute("data-load-state", "loading");
        element.onload = () => {
            element.setAttribute("data-load-state", "loaded");
        };
        element.onerror = () => {
            element.setAttribute("data-load-state", "fail");
        };

        let originUrl = element.getAttribute("src") ?? "";
        const dataSrc = element.getAttribute("data-src") ?? "";
        if (!isNullOrWhiteSpace(dataSrc)) {
            originUrl = dataSrc;
        }
        let imageUrl = originUrl;

        if (!checkIsAbsoluteUrl(imageUrl)) {
            const blob = await doc.fileParser.getFile(imageUrl, doc.url, "blob");
            if (blob && blob.size > 0) {
                if (blob.type?.toLowerCase() == "image/svg+xml") {
                    const svgXml = convertArrayBufferToString(await blob.arrayBuffer());
                    const svgDoc = getFormatDocument(svgXml);
                    const svgImage = svgDoc.querySelector("image");
                    if (svgImage) {
                        imageUrl = svgImage.getAttribute("xlink:href") ?? svgImage.getAttribute("href");
                        try {
                            const imageSizeResult = await getImageSize(imageUrl);
                            const width = imageSizeResult.width;
                            const height = imageSizeResult.height;
                            element.setAttribute("data-width", width.toString());
                            element.setAttribute("data-height", height.toString());
                            const { columnWidth, columnHeight } = this.getColumnMetrics();
                            this.forceSetImageHeight(
                                element as HTMLElement,
                                columnWidth,
                                columnHeight,
                                width,
                                height,
                                this.htmlOptions.maxImageHeightRatio
                            );
                        } catch (e) {
                            this.logger.error(e);
                        }
                    } else {
                        imageUrl = "data:image/svg+xml," + encodeURIComponent(svgXml);
                    }
                } else {
                    imageUrl = URL.createObjectURL(blob);
                    this.addBlobUrl(doc, imageUrl);
                }
            } else {
                imageUrl = errorImageUrl;
            }
        }

        if (compareTagName(element.tagName, "IMG")) {
            const imgElement = element as HTMLImageElement;
            imgElement.src = imageUrl;
            if (imgElement.decode) {
                try {
                    await imgElement.decode();
                } catch (e) {
                    this.logger.error("image decode failed", "imageUrl", imageUrl, e);
                    this.revokeObjectURL(imageUrl);
                    setTimeout(async () => {
                        try {
                            const blob2 = await doc.fileParser.getFile(originUrl, doc.url, "blob");
                            if (blob2 && blob2.size > 0) {
                                const imageUrl2 = URL.createObjectURL(blob2);
                                this.addBlobUrl(doc, imageUrl2);
                                imgElement.src = imageUrl2;
                            } else {
                                imgElement.src = errorImageUrl;
                            }
                        } catch (retryError) {
                            this.logger.error(retryError);
                            imgElement.src = errorImageUrl;
                        }
                    }, 500);
                }
            }
        } else if (BrowserCapabilities.isSafari()) {
            (element as SVGImageElement).href.baseVal = imageUrl;
        } else {
            element.setAttribute("xlink:href", imageUrl);
        }
    }

    async dispose(): Promise<void> {
        this.isDisposed = true;
        this.unbindEvents();
        this.documentImageSizesSummaries.clear();
        this.resetImageSizeTasks = [];
        for (const doc of [...this.blobUrls.keys()]) {
            this.revokeDocumentBlobUrls(doc);
        }
        this.blobUrls.clear();
    }
}
