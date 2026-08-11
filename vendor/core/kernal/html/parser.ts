import { BrowserCapabilities } from "../web/BrowserCapabilities";

type ParseDocType = "html" | "xml" | "xhtml";

/** HTML void elements: self-closing form is valid when re-parsed as text/html. */
const HTML_VOID_ELEMENTS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
]);

/**
 * XML/XHTML serialization emits `<script .../>` for empty elements.
 * HTML parsing does not treat script/style/title/div/etc. as void, so the
 * trailing `/` is ignored and the tag stays open, swallowing the rest of the
 * document. Expand non-void self-closing tags before text/html reparse.
 */
const expandNonVoidSelfClosingTags = (html: string) =>
    html.replace(/<([A-Za-z][\w:-]*)([^>]*)\/>/g, (match, tagName: string, attrs: string) => {
        if (HTML_VOID_ELEMENTS.has(tagName.toLowerCase())) {
            return match;
        }
        return `<${tagName}${attrs}></${tagName}>`;
    });

const hasXmlDeclaration = (html: string) =>
    /<\?xml[\s\S]*?\?>/i.test(html);

const hasXhtmlNamespace = (html: string) =>
    /xmlns\s*=\s*["']?http:\/\/www\.w3\.org\/1999\/xhtml["']?/i.test(html);

const hasNonVoidSelfClosingTag = (html: string) => {
    const selfClosingTagPattern = /<([A-Za-z][\w:-]*)[^>]*\/>/g;
    let match: RegExpExecArray | null;
    while ((match = selfClosingTagPattern.exec(html)) !== null) {
        if (!HTML_VOID_ELEMENTS.has(match[1].toLowerCase())) {
            return true;
        }
    }
    return false;
};

const parseAsHtmlDocument = (html: string) =>
    new DOMParser().parseFromString(expandNonVoidSelfClosingTags(html), "text/html");

const parseAsXhtmlOrHtml = (html: string): { document: Document; docType: ParseDocType } => {
    const xhtmlDocument = new DOMParser().parseFromString(html, "application/xhtml+xml");
    if (xhtmlDocument.querySelector("parsererror")) {
        return {
            document: parseAsHtmlDocument(html),
            docType: "html",
        };
    }
    return { document: xhtmlDocument, docType: "xhtml" };
};

const parseHtml = (html: string): { document: Document; docType: ParseDocType } => {
    if (hasXmlDeclaration(html) || hasXhtmlNamespace(html)) {
        return parseAsXhtmlOrHtml(html);
    }

    // Non-void self-closing tags (e.g. <script .../>) break a direct text/html parse.
    // Keep them on the XML path and convert with expansion later.
    if (hasNonVoidSelfClosingTag(html)) {
        const xmlDocument = new DOMParser().parseFromString(html, "application/xml");
        if (xmlDocument.querySelector("parsererror")) {
            return {
                document: parseAsHtmlDocument(html),
                docType: "html",
            };
        }
        return { document: xmlDocument, docType: "xml" };
    }

    // HTML5 / ordinary HTML without XML/XHTML signals.
    return {
        document: parseAsHtmlDocument(html),
        docType: "html",
    };
};

export const convertToHtml5Document = (doc: Document) => {
    const root = doc.documentElement;
    if (!root) {
        return new DOMParser().parseFromString("<!DOCTYPE html><html></html>", "text/html");
    }

    // outerHTML never includes doctype / xml declaration; always force HTML5 doctype.
    const loadingContent = expandNonVoidSelfClosingTags(`<!DOCTYPE html>${root.outerHTML}`);
    return new DOMParser().parseFromString(loadingContent, "text/html");
};

export const getFormatDocument = (html: string, convertToHtml5?: boolean): Document => {
    const { document: parsedDocument, docType } = parseHtml(html);
    if (docType === "html" || !convertToHtml5) {
        return parsedDocument;
    }
    return convertToHtml5Document(parsedDocument);
};

export const getFormatDocumentAsync = async (html: string, convertToHtml5?: boolean) => {
    const { document: parsedDocument, docType } = parseHtml(html);
    await BrowserCapabilities.yieldToMain();
    if (docType === "html" || !convertToHtml5) {
        return parsedDocument;
    }
    const html5Document = convertToHtml5Document(parsedDocument);
    await BrowserCapabilities.yieldToMain();
    return html5Document;
};
