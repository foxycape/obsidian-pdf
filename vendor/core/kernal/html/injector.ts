import { isNullOrWhiteSpace } from "../common/text";
import { computeUniqueId } from "../common/uuid";
import { Direction, WritingMode } from "../types";
import { getDocumentBody, getDocumentHead } from "./finder";

const appendElementToTarget = (rootElement: Document | HTMLElement, objectId: string, element: HTMLElement, callback?: (container: Document | Element, content: Element) => void) => {
    const ownerDocument = rootElement.ownerDocument ? rootElement.ownerDocument : rootElement as Document;
    const loadedElement = ownerDocument.getElementById(objectId);
    if (!loadedElement) {
        if (rootElement.ownerDocument && rootElement != ownerDocument.documentElement) {
            if (callback) {
                callback(rootElement, element);
            }
            else {
                rootElement.appendChild(element);
            }
        }
        else {
            const head = getDocumentHead(ownerDocument);
            if (callback) {
                callback(head, element);
            }
            else {
                head.appendChild(element);
            }
        }
    }
};

const injectHeadObject = (rootElement: Document | HTMLElement, content: string, replace: boolean, objectId: string, type: string, callback?: (container: Element, content: Element) => void): void => {
    if (!rootElement) {
        return;
    }
    if (isNullOrWhiteSpace(content)) {
        return;
    }
    if (isNullOrWhiteSpace(objectId)) {
        objectId = computeUniqueId(content);
    }
    const ownerDocument = rootElement.ownerDocument ? rootElement.ownerDocument : rootElement as Document;
    const existElement = ownerDocument.getElementById(objectId);
    if (existElement) {
        if (!replace)
            return;
        const parentElement = existElement.parentElement;
        parentElement?.removeChild(existElement);
    }

    let element: HTMLElement;
    if (type == "css") {
        const style = createElement(ownerDocument, "style", objectId, { "type": "text/css" });
        style.appendChild(ownerDocument.createTextNode(content))
        element = style;
    }
    else if (type == "script") {
        const scriptElement = createElement(ownerDocument, "script", objectId, "");
        scriptElement.type = "text/javascript";
        scriptElement.text = "//<![CDATA[\r\n" + content + "\r\n//]]>";
        scriptElement.async = false;
        element = scriptElement;
    }
    else {
        return;
    }
    appendElementToTarget(rootElement, objectId, element, callback);
};

/**
 * Create an element.
 */
export const createElement = <K extends keyof HTMLElementTagNameMap>(rootElement: Document | HTMLElement, tagName: K, id?: string, classNameOrAttributes?: string | Object): HTMLElementTagNameMap[K] => {
    const ownerDocument = rootElement.ownerDocument ? rootElement.ownerDocument : rootElement as Document;
    const element = ownerDocument.createElement(tagName);
    if (!isNullOrWhiteSpace(id))
        element.setAttribute("id", id);
    if (classNameOrAttributes == undefined)
        return element;
    if (typeof classNameOrAttributes == "string") {
        if (isNullOrWhiteSpace(classNameOrAttributes))
            return element;
        element.setAttribute("class", classNameOrAttributes);
    }
    else {
        const keys = Object.keys(classNameOrAttributes);
        keys.forEach((key) => {
            const value = classNameOrAttributes[key];
            element.setAttribute(key, value);
        })
    }
    return element;
};

export const existsElement = (rootElement: Document | HTMLElement, elementId: string) => {
    const ownerDocument = rootElement.ownerDocument ? rootElement.ownerDocument : rootElement as Document;
    return !!ownerDocument?.getElementById(elementId)
};

export const removeElement = (rootElement: Document | HTMLElement, objectId: string) => {
    if (isNullOrWhiteSpace(objectId)) {
        return;
    }
    const ownerDocument = rootElement.ownerDocument ? rootElement.ownerDocument : rootElement as Document;
    const existElement = ownerDocument.getElementById(objectId);
    if (existElement) {
        const parentElement = existElement.parentElement;
        parentElement?.removeChild(existElement);
    }
};

export const injectJSContent = (rootElement: Document | HTMLElement, jsContent: string, replace: boolean, scriptId: string = ""): void => {
    injectHeadObject(rootElement, jsContent, replace, scriptId, "script");
};

export const injectCssContent = (rootElement: Document | HTMLElement, cssContent: string, replace: boolean, cssId: string = "", callback?: (container: Element, content: Element) => void): void => {
    injectHeadObject(rootElement, cssContent, replace, cssId, "css", callback);
};

export const injectExternalJS = async (rootElement: Document | HTMLElement, url: string, replace: boolean, scriptId: string = "", options?: { defer?: boolean, async?: boolean, elementCallback?: (element: Element) => void, type?: string }): Promise<void> => {
    if (!rootElement) {
        return;
    }
    if (isNullOrWhiteSpace(url)) {
        return;
    }

    if (isNullOrWhiteSpace(scriptId)) {
        scriptId = computeUniqueId(url);
    }
    const ownerDocument = rootElement.ownerDocument ? rootElement.ownerDocument : rootElement as Document;
    const existElement = ownerDocument.getElementById(scriptId);
    if (existElement) {
        if (replace) {
            const parentElement = existElement.parentElement;
            parentElement?.removeChild(existElement);
        }
        else {
            if (existElement.getAttribute("data-load-state") == "loading") {
                return new Promise<void>((resolve, reject) => {
                    existElement.addEventListener("load", (_e) => { resolve(); }, false);
                    existElement.addEventListener("error", (_e) => { reject(_e.error); }, false);
                })
            }
            else {
                return;
            }
        }
    }
    return new Promise<void>((resolve, reject) => {
        const scriptElement = createElement(rootElement, "script", scriptId);
        if (options?.type) {
            scriptElement.type = options?.type;
        }
        scriptElement.src = url;
        if (options?.defer) {
            scriptElement.defer = true
        }
        if (options?.async) {
            scriptElement.async = true
        }
        if (options?.elementCallback) {
            options?.elementCallback(scriptElement);
        }
        scriptElement.setAttribute("data-load-state", "loading");
        scriptElement.addEventListener("load", (_e) => {
            scriptElement.setAttribute("data-load-state", "success");
            resolve()
        }, false);
        scriptElement.addEventListener("error", (_e) => {
            scriptElement.setAttribute("data-load-state", "fail");
            reject(_e)
        }, false);
        appendElementToTarget(rootElement, scriptId, scriptElement);
    })
};

export const injectExternalCss = async (rootElement: Document | HTMLElement, url: string, replace: boolean, cssId: string = ""): Promise<void> => {
    if (!rootElement) {
        return;
    }
    if (isNullOrWhiteSpace(url)) {
        return;
    }
    if (isNullOrWhiteSpace(cssId)) {
        cssId = computeUniqueId(url);
    }
    const ownerDocument = rootElement.ownerDocument ? rootElement.ownerDocument : rootElement as Document;
    const existElement = ownerDocument.getElementById(cssId);
    if (existElement) {
        if (!replace)
            return;
        const parentElement = existElement.parentElement;
        parentElement?.removeChild(existElement);
    }

    if (ownerDocument.defaultView) {
        return new Promise<void>((resolve, reject) => {
            const linkElement = createElement(rootElement, "link", cssId);
            linkElement.type = "text/css";
            linkElement.rel = "stylesheet";
            linkElement.href = url;
            linkElement.onload = (_e) => {
                resolve();
            };
            linkElement.onerror = reject;
            appendElementToTarget(rootElement, cssId, linkElement);
        })
    }
    else {
        const linkElement = createElement(rootElement, "link", cssId);
        linkElement.type = "text/css";
        linkElement.rel = "stylesheet";
        linkElement.href = url;
        appendElementToTarget(rootElement, cssId, linkElement);
    }
};