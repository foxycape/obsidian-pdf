import { isNullOrWhiteSpace } from "../common/text";

const ptToEmMap = new Map<number, number>();
ptToEmMap.set(9, 0.75);
ptToEmMap.set(11, 0.875);
ptToEmMap.set(13, 1.063);
ptToEmMap.set(14, 1.125);
ptToEmMap.set(15, 1.25);
ptToEmMap.set(16, 1.313);

const extractTransform = (transform: string) => {
    if (!transform) {
        return ''
    }
    const start = transform.indexOf('(');
    const end = transform.lastIndexOf(')');
    if (start === -1 || end === -1) return null;

    return transform.slice(start + 1, end);
};

const extractTransformAsArray = (transform: string) => {
    const params = extractTransform(transform);
    if (!params)
        return [];

    return params.split(',').map(p => {
        const trimmed = p.trim();
        const num = parseFloat(trimmed);
        return isNaN(num) ? 0 : num;
    });
};

/**
 * Get a transform length value. Only translateX and translateY are supported.
 */
export const getTransformLength = (element: Element, axis: 'x' | 'y', raw?: boolean) => {
    const ownerDocument = element?.ownerDocument;
        if (!ownerDocument || !ownerDocument?.defaultView || isNullOrWhiteSpace(axis))
        return 0;
    let transform = (element as HTMLElement).style?.transform?.toLowerCase();
    if (!transform || !(transform.startsWith("translatex") || transform.startsWith("translate") || transform.startsWith("translate3d"))) {
        transform = element.ownerDocument.defaultView.getComputedStyle(element).transform?.toLowerCase();
    }
    if (!transform || transform == "none")
        return 0;

    const transformValues = extractTransformAsArray(transform);
    if (axis == "y") {
        let y = 0;
        if (transformValues.length > 0 && (transform.startsWith("translatex") || transform.startsWith("translate") || transform.startsWith("translate3d"))) {
            y = transform.startsWith("translatey") ? transformValues[0] : transformValues[1];
        }
        else {
            y = parseFloat(transform.split(',')[5]);
        }
        if(isNaN(y)) {
            return 0;
        }
        if (raw) {
            return y;
        }
        return Math.abs(y);
    }

    let x = 0;
    if (transformValues.length > 0 && (transform.startsWith("translatex") || transform.startsWith("translate") || transform.startsWith("translate3d"))) {
        x = transformValues[0]
    }
    else {
        x = parseFloat(transform.split(',')[4]);
    }

    if(isNaN(x)) {
        return 0;
    }
    if (raw) {
        return x;
    }
    return Math.abs(x);

};

export const replaceFontSize = (cssContent: string) => {
    if (!cssContent) {
        return cssContent;
    }

    let newCssContent = cssContent.replace(/font-size\s*?:\s*?(\d+)(pt|px)(;)?/gi, (match, s1, s2, s3) => {
        if (s2?.toLowerCase() == "pt") {
            const existEm = ptToEmMap.get(parseFloat(s1))
            if (existEm) {
                return "font-size:" + existEm + "em" + (s3 ?? "")
            }
            return "font-size:" + s1 / 12 + "em" + (s3 ?? "")
        }
        else if (s2?.toLowerCase() == "px") {
            return "font-size:" + s1 / 16 + "em" + (s3 ?? "")
        }
        return match
    })

    newCssContent = newCssContent.replace(/font-size\s*?:\s*?(xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large)(;)?/gi, (match, s1, s2) => {
        if (s1) {
            return "font-size:inherit" + (s2 ?? "");
        }
        return match
    })
    return newCssContent;
};

export const removeTextIndent = (cssContent: string) => {
    if (!cssContent) {
        return cssContent;
    }
    const whitespaceRegex = /[\s]+/g;
    return cssContent.replace(/text-indent\s*?:\s*?(\d+)(pt|px|em|rem|in|cm|mm|%)?(\s*;)?/gi, (match, s1, s2, s3) => {
        if (!match) {
            return "";
        }
        if (match.length > 20 && match.replace(whitespaceRegex, '').length > 20) {
            return match;
        }
        return "";
    })
};

/**
 * Append `text-indent: 0` after `text-align: center|right`.
 * Must run after removeTextIndent, otherwise the zero indent would be removed.
 */
export const appendZeroTextIndentForCenterRightAlign = (cssContent: string) => {
    if (!cssContent) {
        return cssContent;
    }
    return cssContent.replace(/text-align\s*:\s*(center|right)\b/gi, (match) => `${match}; text-indent: 0;`);
};

/** Disable the context menu */
export const preventContextMenu = (element: HTMLElement) => {
    element.oncontextmenu = () => { return false; }
};

/**
 * Scroll the element into view.
 * @param target The element to scroll into view.
 * @param options The options for the scrollIntoView method.
 * @param scrollIntoViewIfNeeded Whether to scroll the element into view if it is not in view.
 * @param preserveScrollDocument The document to preserve the scroll position.
 */
export const scrollElementIntoView = (
    target: Element,
    options?: ScrollIntoViewOptions,
    scrollIntoViewIfNeeded?: boolean,
    preserveScrollDocument?: Document
) => {
    if (!target)
        return;
    const ownerDocument = preserveScrollDocument ?? target.ownerDocument;
    if (!ownerDocument)
        return;
    const readerWrapperOwnerScrollTop = ownerDocument.documentElement.scrollTop;

    let readerWrapperParentOwnerScrollTop = 0;
    if (ownerDocument.defaultView != ownerDocument.defaultView?.parent) {
        readerWrapperParentOwnerScrollTop = ownerDocument.defaultView.parent.document.documentElement.scrollTop;
    }
    if (scrollIntoViewIfNeeded && "scrollIntoViewIfNeeded" in target) {
        (target as any).scrollIntoViewIfNeeded();
    }
    else {
        try {
            if (options) {
                const opts = { ...options };
                if (opts.behavior == "smooth") {
                    opts.behavior = "auto";
                }
                target.scrollIntoView(opts);
            }
            else {
                target.scrollIntoView();
            }
        } catch (e) {
            target.scrollIntoView();
        }
    }
    if (readerWrapperOwnerScrollTop > 0) {
        ownerDocument.documentElement.scrollTop = readerWrapperOwnerScrollTop;
    }
    if (readerWrapperParentOwnerScrollTop > 0) {
        ownerDocument.defaultView.parent.document.documentElement.scrollTop = readerWrapperParentOwnerScrollTop;
    }
};
