import { compareTagName, getDocumentBody } from "../../../../kernal/html/finder";
import { BrowserCapabilities, ElementInitialNumberName, EventNames, IDisposable, IDocumentsProvider, IEventEmitter } from "../../../../kernal";
import { HtmlOptions } from "../../HtmlOptions";
import { IHtmlDocument } from "../IHtmlDocument";

/**
 * HTML observer for image elements.
 */
export class HtmlImageObserver implements IDisposable {
    private imageIntersectionObserver: IntersectionObserver;
    private docImagesMap = new Map<IHtmlDocument, Element[]>();
    private elementMap = new Map<Element, IHtmlDocument>();
    private visibleImages = new Set<Element>();
    /** Preload the specified number of images before and after the current visible images */
    private readonly preloadImageCount = 5;
    private readonly events: IEventEmitter;

    constructor(
        private readonly documentsProvider: IDocumentsProvider<IHtmlDocument>,
        private readonly htmlOptions: HtmlOptions
    ) {
        this.events = this.documentsProvider.owner.events;
        this.bindEvents();
    }

    private bindEvents() {
        this.events.on(EventNames.DocumentLoad, this.onDocumentLoad);
        this.events.on(EventNames.DocumentDisposing, this.onDocumentDisposing);
    }

    private unbindEvents() {
        this.events.off(EventNames.DocumentLoad, this.onDocumentLoad);
        this.events.off(EventNames.DocumentDisposing, this.onDocumentDisposing);
    }

    private onDocumentLoad = async (doc: IHtmlDocument) => {
        await this.observe(doc);
    }

    private onDocumentDisposing = (doc: IHtmlDocument) => {
        this.unobserve(doc);
    }

    async dispose() {
        this.unbindEvents();
        this.unregister();
    }

    register() {
        this.imageIntersectionObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                const target = entry.target;
                const isIntersecting = entry.isIntersecting || entry.intersectionRatio > 0;
                // SVG <image>： In some environments, the intersection detection is unstable, so even if it is not intersecting, it is纳入可见集合
                if (isIntersecting || compareTagName(target.tagName, "IMAGE")) {
                    this.visibleImages.add(target);
                } else {
                    this.visibleImages.delete(target);
                }
            }

            if (this.visibleImages.size == 0) {
                return;
            }

            const docsMap = new Map<IHtmlDocument, Element[]>();
            const entryElements = new Set<Element>();
            for (const visibleImage of this.visibleImages) {
                const doc = this.elementMap.get(visibleImage);
                if (!doc) {
                    continue;
                }
                entryElements.add(visibleImage);
                const list = docsMap.get(doc);
                if (list) {
                    list.push(visibleImage);
                } else {
                    docsMap.set(doc, [visibleImage]);
                }
            }

            if (docsMap.size == 0) {
                return;
            }

            const rendererContainerWidth = this.documentsProvider.getRendererContainer().clientWidth;
            const isPageFlipMode = this.htmlOptions.flipMode == "page";

            for (const [doc, visibleInDoc] of docsMap.entries()) {
                const imageElements = this.docImagesMap.get(doc);
                if (!imageElements || imageElements.length == 0) {
                    continue;
                }

                const preloadSet = new Set(visibleInDoc);
                const firstImageElement = visibleInDoc[0];
                const lastImageElement = visibleInDoc[visibleInDoc.length - 1];
                const firstImageElementIndex = imageElements.indexOf(firstImageElement);
                const lastImageElementIndex = imageElements.indexOf(lastImageElement);

                if (firstImageElementIndex > 0) {
                    const firstImageElementRect = firstImageElement.getBoundingClientRect();
                    for (let i = 0; i < firstImageElementIndex; i++) {
                        const preloadImageElement = imageElements[firstImageElementIndex - i];
                        if (!preloadImageElement) {
                            continue;
                        }
                        if (!entryElements.has(preloadImageElement) && !preloadSet.has(preloadImageElement)) {
                            visibleInDoc.unshift(preloadImageElement);
                            preloadSet.add(preloadImageElement);
                        }

                        if (i > 0 && i % this.preloadImageCount == 0) {
                            if (!isPageFlipMode
                                || Math.abs(preloadImageElement.getBoundingClientRect().x - firstImageElementRect.x) > 2 * rendererContainerWidth) {
                                break;
                            }
                        }
                    }
                }

                if (lastImageElementIndex >= 0) {
                    const lastImageElementRect = lastImageElement.getBoundingClientRect();
                    const imageElementsLength = imageElements.length;
                    for (let i = 0; i < imageElementsLength - lastImageElementIndex; i++) {
                        const preloadImageElement = imageElements[lastImageElementIndex + i];
                        if (!preloadImageElement) {
                            continue;
                        }
                        if (!entryElements.has(preloadImageElement) && !preloadSet.has(preloadImageElement)) {
                            visibleInDoc.push(preloadImageElement);
                            preloadSet.add(preloadImageElement);
                        }

                        if (i > 0 && i % this.preloadImageCount == 0) {
                            if (!isPageFlipMode
                                || Math.abs(preloadImageElement.getBoundingClientRect().x - lastImageElementRect.x) > 2 * rendererContainerWidth) {
                                break;
                            }
                        }
                    }
                }
            }

            this.events.emit(EventNames.ImageElementsVisible, docsMap);
        }, { rootMargin: "1600px" });

        this.observeLoadedDocuments();
    }

    unregister() {
        if (this.imageIntersectionObserver) {
            this.imageIntersectionObserver.disconnect();
            this.imageIntersectionObserver = undefined;
        }

        this.docImagesMap.clear();
        this.elementMap.clear();
        this.visibleImages.clear();
    }

    private observeLoadedDocuments = async () => {
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const doc of loadedDocuments) {
            await this.observe(doc);
        }
    }

    private readonly observedName="observed";
    /**
     * Observe image elements in the document.
     */
    private observe = async (doc: IHtmlDocument) => {
        if (!this.imageIntersectionObserver) {
            return;
        }
        const iframeDocument = doc.getContentContainer().ownerDocument;
        const body = getDocumentBody(iframeDocument);
        if (!body || body.getAttribute(this.observedName)) {
            return;
        }
        body.setAttribute(this.observedName, "true");
        const images = body.querySelectorAll("img,image,svg");
        for (let i = 0; i < images.length; i++) {
            const element = images[i];
            // Only process the original elements, not the subsequent inserted elements
            const initialNumber = parseInt(element.getAttribute(ElementInitialNumberName));
            if (isNaN(initialNumber) || initialNumber < 0) {
                continue;
            }
            if (compareTagName(element.tagName, "IMG") || compareTagName(element.tagName, "IMAGE") || compareTagName(element.tagName, "SVG")) {
                if (!this.elementMap.has(element)) {
                    this.elementMap.set(element, doc);
                    const docImages = this.docImagesMap.get(doc);
                    if (docImages) {
                        docImages.push(element);
                    } else {
                        this.docImagesMap.set(doc, [element]);
                    }
                    this.imageIntersectionObserver.observe(element);
                }
            }
            if (i % 100 == 0) {
                // If the scheduler is supported, yield every 100 elements to avoid long time blocking the main thread
                await BrowserCapabilities.yieldToMain();
            }
        }
    }

    private unobserve(doc: IHtmlDocument) {
        const imageElements = this.docImagesMap.get(doc) ?? [];
        for (const element of imageElements) {
            this.elementMap.delete(element);
            this.visibleImages.delete(element);
            this.imageIntersectionObserver?.unobserve(element);
        }
        this.docImagesMap.delete(doc);
    }
}
