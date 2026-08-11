import { convertArrayBufferToString, convertStringToUint8Array } from "../../../../kernal/common/encoding";
import { getExtension } from "../../../../kernal/common/path";
import { isNullOrWhiteSpace, startsWithAny } from "../../../../kernal/common/text";
import { checkIsAbsoluteUrl, checkIsBlobUrl, checkIsFileUrl, getFullUrl } from "../../../../kernal/common/url";
import { toBlob } from "../../../../kernal/common/buffer";
import { compareTagName, getDocumentHead } from "../../../../kernal/html/finder";
import { createElement, injectCssContent } from "../../../../kernal/html/injector";
import { replaceFontSize, removeTextIndent, appendZeroTextIndentForCenterRightAlign } from "../../../../kernal/html/style";
import { ILogger, IFileParser, IDocument, LastElementAttributeName } from "../../../../kernal";
import { HtmlSettings } from "../../HtmlSettings";
import { IHtmlDocument } from "../IHtmlDocument";
import { getRandomId } from "../../../../kernal/common/uuid";
import { IHtmlContentProcessor } from "./IHtmlContentProcessor";

/**
 * HTML content preprocessing class
 */
export class HtmlContentProcessor implements IHtmlContentProcessor {
    // /**CSS internal reference other url regular expression */
    // cssInternalUrlReg = new RegExp(/(url[\s]*\([\s]*[\"']?[\s]*)([^\s\"')]*)([^)]*?\/?[\s]*\))/ig);
    protected logger: ILogger;
    private childrenUrls = new Map<string, string>();
    private errorLinks: string[] = [];
    private docBlobUrls = new Map<IDocument, string[]>();
    private opaqueDocumentBaseUrls: string[] = [];

    /**
     * Constructor
     * @param fileParser 
     */
    constructor(public readonly fileParser: IFileParser) {

    }

    /**
     * Prepare the content to be loaded
     * @param doc
     * @returns 
     */
    async preprocess(doc: IHtmlDocument): Promise<void> {
        const virtualDocument = (await doc.getVirtualContentContainer())?.ownerDocument;
        if (!virtualDocument) {
            return;
        }
        this.format(virtualDocument);
        this.injectBaseUrl(virtualDocument, doc.url);
        await this.resetCssHref(virtualDocument, doc);
        await this.resetScriptSrc(virtualDocument, doc);
    }

    private format(virtualDocument: Document) {
        const elements = virtualDocument.getElementsByTagName("*");
        let foundLastElement = false;
        for (let i = elements.length - 1; i >= 0; i--) {
            const element = elements[i] as HTMLElement;
            if (!element.textContent.trim()) {
                element.classList.add("lhx-text-empty");
            }
            if (element.style && (element.style.fontSize || element.style.textIndent)) {
                const style = element.getAttribute("style");
                let newStyle = style;
                if (element.style.fontSize) {
                    newStyle = replaceFontSize(newStyle);
                }
                if (element.style.textIndent) {
                    newStyle = removeTextIndent(newStyle);
                }
                element.setAttribute("style", newStyle);
            }
            if (compareTagName(element.tagName, "TABLE")) {
                element.style.width = "100%";
                element.style.height = "auto";
            }
            if (!foundLastElement) {
                if (compareTagName(element.tagName, "SVG") || (element.children.length == 0 && !compareTagName(element.parentElement.tagName, "SVG"))) {
                    foundLastElement = true;
                    element.setAttribute(LastElementAttributeName, "true");
                }
            }
            if (element.getAttribute("epub:type") == "footnote") {
                element.style.setProperty("display", 'none');
            }
        }
    }

    /**
    * Reset CSS path
    */
    private async resetCssHref(virtualDocument: Document, doc: IDocument): Promise<void> {
        const links = virtualDocument.getElementsByTagName("link");
        for (let i = links.length - 1; i >= 0; i--) {
            // let href=links[i].href;//After adding base href, the property cannot be used directly
            const href = links[i].getAttribute("href");
            if (!links[i].rel || links[i].rel.toLowerCase() != "stylesheet" || isNullOrWhiteSpace(href))
                continue;
            const { href: newHref, cssContent, isHref } = await this.getActualCssLink(href, doc);
            if (isHref && href) {
                links[i].href = newHref;
                links[i].setAttribute(HtmlSettings.LinkOriginHrefPropertyName, href);
            }
            else if (cssContent) {
                const id = getRandomId(true);
                injectCssContent(virtualDocument, cssContent, false, id);
                links[i].parentElement?.removeChild(links[i]);
            }
        }
    }

    private async getActualCssLink(href: string, doc: IDocument): Promise<{ href: string, cssContent: string, isHref: boolean }> {
        if (isNullOrWhiteSpace(href)) {
            return { href, cssContent: '', isHref: true };
        }
        if (checkIsAbsoluteUrl(href)) {
            return { href, cssContent: '', isHref: true };
        }

        try {
            // this.logger.debug("loadLinkHref,href:" + href);
            // const bytes = await this.fileParser.getFileBytes(fullKey);
            // const cssContent = convertUint8ArrayToString(bytes);

            const file = await this.fileParser.getFile(href, doc.url, 'blob');
            const cssContent = convertArrayBufferToString(await file.arrayBuffer());

            const childrenUrlMatches = cssContent.matchAll(/url\(["']?(.*?)["']?\)/gi);
            for (const m of childrenUrlMatches) {
                const childHref = m[1];
                if (this.childrenUrls.get(childHref)) {
                    continue;
                }
                const extension = getExtension(childHref);
                if (extension && extension.toLowerCase() == ".css") {
                    if (isNullOrWhiteSpace(childHref) || checkIsAbsoluteUrl(childHref)) {
                        continue;
                    }
                    //todo: Nested CSS, if the internal is not using an absolute path, the path calculated here may be incorrect, so the CSS here is relative to the parent CSS, not the HTML document
                    const { href: actualCssUrl } = await this.getActualCssLink(childHref, doc);
                    this.childrenUrls.set(childHref, actualCssUrl);
                }
                else {
                    const actualResourceUrl = getFullUrl(childHref, href);
                    if (!startsWithAny(actualResourceUrl.toString(), true, "http://", "https://")) {
                        continue;
                    }
                    const resourceKey = (actualResourceUrl.pathname + actualResourceUrl.search).substring(1);
                    if (this.errorLinks.indexOf(resourceKey) >= 0) {
                        continue;
                    }
                    else {
                        try {
                            // const resourceBytes = await this.fileParser.getFileBytes(resourceKey);

                            const blob = await this.fileParser.getFile(resourceKey, '', 'blob');
                            const linkHref = URL.createObjectURL(blob);
                            this.childrenUrls.set(childHref, linkHref);
                        } catch (err) {
                            if (this.errorLinks.indexOf(resourceKey) < 0) {
                                this.errorLinks.push(resourceKey);
                            }
                            this.logger.error(err);
                            this.childrenUrls.set(childHref, actualResourceUrl.toString());
                        }
                    }
                }
            }

            let newCssContent = cssContent.replace(/url\(["']?(.*?)["']?\)/gi, (match, href) => {
                // this.logger.debug("resetLinkHref,match:" + match + ",href:" + href);
                if (checkIsAbsoluteUrl(href)) {
                    return match;
                }
                else {
                    //Do not use links, the links inside have already used css content blocks
                    // const newHref = this.childrenUrls.get(href);
                    // if (newHref) {
                    //     return match.replace(href, newHref);
                    // }
                    // else {
                    //     return href;
                    // }
                    return '';
                }
            });

            //Convert font units in CSS, not comprehensive, add conversion according to actual situation
            newCssContent = replaceFontSize(newCssContent)
            newCssContent = removeTextIndent(newCssContent)
            newCssContent = appendZeroTextIndentForCenterRightAlign(newCssContent)

            const newBytes = convertStringToUint8Array(newCssContent);
            const blob = toBlob(newBytes, { type: "text/css" });
            const linkHref = URL.createObjectURL(blob);
            this.childrenUrls.set(href, linkHref);
            return { href: linkHref, cssContent: newCssContent, isHref: false };
        }
        catch (err) {
            this.logger.error(err);
            return { href, cssContent: '', isHref: true };
        }
    }

    async dispose() {
        this.childrenUrls.clear();
        if (this.errorLinks) {
            this.errorLinks.splice(0);
        }
        this.docBlobUrls.clear();
        for (const url of this.opaqueDocumentBaseUrls) {
            try {
                URL.revokeObjectURL(url);
            } catch {
                // ignore
            }
        }
        this.opaqueDocumentBaseUrls = [];
    }

    /**
     * Reset script path
     * @param virtualDocument 
     * @returns 
     */
    private async resetScriptSrc(virtualDocument: Document, doc: IDocument): Promise<void> {
        let docRoot = doc.getRoot();
        if (!docRoot)
            docRoot = "";
        const scripts = virtualDocument.getElementsByTagName("script");
        for (let i = 0; i < scripts.length; i++) {
            let src = scripts[i].getAttribute("src");
            if (!src || src.startsWith("/"))
                continue;
            if (!checkIsAbsoluteUrl(src)) {
                const uri = getFullUrl(src, docRoot);
                if (checkIsAbsoluteUrl(docRoot)) {
                    src = uri.toString();
                }
                else {
                    src = uri.pathname + uri.search;
                    src = src.substring(1);
                }
            }

            if (checkIsAbsoluteUrl(src)) {
                continue;
            }
            else {
                const fullUrl = getFullUrl(src, docRoot);
                let locationUrl = fullUrl.pathname + fullUrl.search;
                locationUrl = locationUrl.substring(1);
                // const bytes = await this.fileParser.getFileBytes(locationUrl);
                // const blob = new Blob([bytes]);
                const blob = await this.fileParser.getFile(src, doc.url, 'blob');
                const newSrc = URL.createObjectURL(blob);
                scripts[i].src = newSrc;
                scripts[i].setAttribute(HtmlSettings.LinkOriginHrefPropertyName, src);
            }
        }
    }

    /**
     * Add baseUrl, for relative address parsing within the page.
     * about:blank / srcdoc inherit the host page baseURI; an explicit <base>
     * must not point at the host origin or relative assets will load the test page.
     */
    private injectBaseUrl(virtualDocument: Document, htmlUrl: string | undefined): void {
        const bases = virtualDocument.getElementsByTagName("base");
        for (let i = 0; i < bases.length; i++) {
            if (!isNullOrWhiteSpace(bases[i].href)) {
                return;
            }
        }

        let baseUrl = htmlUrl;
        const hasUsableAbsoluteBase = !isNullOrWhiteSpace(baseUrl) && checkIsAbsoluteUrl(baseUrl);

        if (!hasUsableAbsoluteBase) {
            baseUrl = this.createOpaqueDocumentBaseUrl();
        }

        const baseElement = createElement(virtualDocument, "base", null, { "href": baseUrl });
        const head = getDocumentHead(virtualDocument);
        head.insertBefore(baseElement, head.firstChild);
    }

    private createOpaqueDocumentBaseUrl(): string {
        const url = URL.createObjectURL(new Blob(["<!doctype html><title></title>"], { type: "text/html" }));
        this.opaqueDocumentBaseUrls.push(url);
        return url;
    }
}