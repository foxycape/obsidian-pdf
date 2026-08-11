/**
 * Clear all children without assigning to innerHTML (Obsidian plugin review).
 */
export const emptyElement = (element: Element): void => {
    element.replaceChildren();
};

/**
 * Parse an HTML string into a DocumentFragment owned by `ownerDocument`.
 * Uses DOMParser instead of assigning to innerHTML.
 */
export const parseHtmlToFragment = (ownerDocument: Document, html: string): DocumentFragment => {
    const fragment = ownerDocument.createDocumentFragment();
    if (!html) {
        return fragment;
    }
    const parsed = new DOMParser().parseFromString(html, "text/html");
    fragment.append(...Array.from(parsed.body.childNodes));
    return fragment;
};

/**
 * Replace element contents with nodes parsed from an HTML string.
 */
export const setElementHtml = (element: Element, html: string): void => {
    emptyElement(element);
    if (!html) {
        return;
    }
    element.appendChild(parseHtmlToFragment(element.ownerDocument, html));
};
