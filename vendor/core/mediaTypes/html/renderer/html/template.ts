import { createElement } from "../../../../kernal/html/injector";
import { formatFileSize } from "../../../../kernal/common/data";
import { BrowserCapabilities } from "../../../../kernal/web/BrowserCapabilities";
import { ViewportCssVariableNames } from "../layout/ViewportCssVariableNames";

export const htmlTemplate = `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title></title></head><body>{custom-htmls}</body></html>`;
export const getHtmlTemplate = (customHtmls: string) => {
    return htmlTemplate.replace("{custom-htmls}", customHtmls);
}
export const getTooBigHtmlTemplate = (contentLength: number) => {
    const html = '<div style="min-height:50px;display:flex;justify-content:center;align-items:center;">The document is too big(' + formatFileSize(contentLength) + '), can\'t be loaded.</div>';
    return htmlTemplate.replace("{custom-htmls}", html);
}

export const createIframe = (ownerDocument: Document, iframeId: string,forceScroll: boolean): HTMLIFrameElement => {
    const iframe = createElement(ownerDocument, "iframe", iframeId);
    if (BrowserCapabilities.isFirefox()) {
        iframe.setAttribute("src", "javascript:");
    }
    else {
        iframe.setAttribute("src", "about:blank");
    }
    iframe.setAttribute("data-role", "content");
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("border", "0");
    iframe.setAttribute("width", "100%");
    iframe.setAttribute("height", "100%");
    iframe.setAttribute("style", "display:block");
    if (forceScroll) {
        iframe.style.setProperty("width", "100%");
    }
    else {
        iframe.style.setProperty("width", "var(" + ViewportCssVariableNames.ContentContainerWidth + ")");
    }
    iframe.style.setProperty("height", "var(" + ViewportCssVariableNames.ContentContainerHeight + ")");
    return iframe;
}