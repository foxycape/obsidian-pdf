import { ElementInitialNumberName } from "../../../kernal/Constants";
import { compareTagName } from "../../../kernal/html/finder";

export type ContentUnitOptions = {
    htmlBlockTags: string[];
};

const NON_CONTENT_TAGS = new Set([
    "script", "style", "link", "noscript", "template", "meta", "head", "title",
]);

const STRUCTURAL_ONLY_TAGS = new Set([
    "html", "body", "ul", "ol", "dl", "thead", "tbody", "tfoot", "tr", "colgroup", "col",
]);

const hasValidInitialNumber = (element: Element) => {
    const initialNumber = parseInt(element.getAttribute(ElementInitialNumberName));
    return !isNaN(initialNumber) && initialNumber >= 0;
};

const isMediaOrSvgRoot = (element: Element) => {
    return compareTagName(element.tagName, "IMG")
        || compareTagName(element.tagName, "IMAGE")
        || compareTagName(element.tagName, "SVG");
};

/** True for nodes inside an SVG tree, excluding the SVG root itself. */
const isSvgInternal = (element: Element) => {
    if (compareTagName(element.tagName, "SVG")) {
        return false;
    }
    let parent = element.parentElement;
    while (parent) {
        if (compareTagName(parent.tagName, "SVG")) {
            return true;
        }
        parent = parent.parentElement;
    }
    return false;
};

const toTagKey = (tagName: string) => tagName.toLowerCase();

const isNonContentTag = (tagName: string) => NON_CONTENT_TAGS.has(toTagKey(tagName));

const isStructuralOnlyTag = (tagName: string) => STRUCTURAL_ONLY_TAGS.has(toTagKey(tagName));

const hasMeaningfulText = (element: Element) => {
    const text = element.textContent ?? "";
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        // skip common whitespace: space, tab, LF, CR, NBSP
        if (code != 32 && code != 9 && code != 10 && code != 13 && code != 160) {
            return true;
        }
    }
    return false;
};

const buildContentBlockTagSet = (htmlBlockTags: string[]) => {
    const set = new Set<string>();
    for (let i = 0; i < htmlBlockTags.length; i++) {
        const tag = toTagKey(htmlBlockTags[i]);
        if (!tag || NON_CONTENT_TAGS.has(tag) || STRUCTURAL_ONLY_TAGS.has(tag)) {
            continue;
        }
        // Media roots are handled separately as always-on units.
        if (tag == "img" || tag == "image" || tag == "svg") {
            continue;
        }
        set.add(tag);
    }
    return set;
};

/**
 * Collect content units used as shared anchors for visibility, progress, and nav.
 *
 * Rules:
 * - Media/svg roots are always units; svg internals are never units.
 * - Block tags split to child blocks when they contain nested content blocks.
 * - Leaf content blocks (block with only inline/text) are selected as a whole.
 * - Pure inline leaves are fallback units only when not covered by a selected block.
 */
export const collectContentUnitElements = (
    root: Element,
    options: ContentUnitOptions
): Element[] => {
    const candidates: Element[] = [];
    const seen = new Set<Element>();
    const contentBlockTags = buildContentBlockTagSet(options.htmlBlockTags ?? []);

    const add = (element: Element) => {
        if (seen.has(element)) {
            return;
        }
        seen.add(element);
        candidates.push(element);
    };

    const isContentBlockTag = (tagName: string) => contentBlockTags.has(toTagKey(tagName));

    /** Whether a descendant can itself become a content-block unit (drives split). */
    const hasContentBlockDescendant = (element: Element): boolean => {
        const children = element.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (isSvgInternal(child) || isNonContentTag(child.tagName)) {
                continue;
            }
            if (isMediaOrSvgRoot(child)) {
                if (hasContentBlockDescendant(child)) {
                    return true;
                }
                continue;
            }
            if (isStructuralOnlyTag(child.tagName)) {
                if (hasContentBlockDescendant(child)) {
                    return true;
                }
                continue;
            }
            if (isContentBlockTag(child.tagName) && hasValidInitialNumber(child)) {
                return true;
            }
            if (hasContentBlockDescendant(child)) {
                return true;
            }
        }
        return false;
    };

    const walk = (element: Element, coveredByBlock: boolean) => {
        if (!hasValidInitialNumber(element)) {
            const children = element.children;
            for (let i = 0; i < children.length; i++) {
                walk(children[i], coveredByBlock);
            }
            return;
        }

        if (isMediaOrSvgRoot(element)) {
            add(element);
            const children = element.children;
            for (let i = 0; i < children.length; i++) {
                walk(children[i], true);
            }
            return;
        }

        if (isSvgInternal(element) || isNonContentTag(element.tagName)) {
            return;
        }

        if (coveredByBlock) {
            const children = element.children;
            for (let i = 0; i < children.length; i++) {
                walk(children[i], true);
            }
            return;
        }

        if (isStructuralOnlyTag(element.tagName)) {
            const children = element.children;
            for (let i = 0; i < children.length; i++) {
                walk(children[i], false);
            }
            return;
        }

        if (isContentBlockTag(element.tagName)) {
            if (hasContentBlockDescendant(element)) {
                const children = element.children;
                for (let i = 0; i < children.length; i++) {
                    walk(children[i], false);
                }
                return;
            }
            add(element);
            const children = element.children;
            for (let i = 0; i < children.length; i++) {
                walk(children[i], true);
            }
            return;
        }

        // Inline / other: prefer children; leaf text nodes are fallback units.
        const children = element.children;
        if (children.length > 0) {
            for (let i = 0; i < children.length; i++) {
                walk(children[i], false);
            }
            return;
        }
        if (hasMeaningfulText(element)) {
            add(element);
        }
    };

    // Document-order sequence for IntersectionObserver sorting (all descendants).
    const elements = root.getElementsByTagName("*");
    for (let i = 0; i < elements.length; i++) {
        elements[i].sequence = i;
    }

    const rootChildren = root.children;
    for (let i = 0; i < rootChildren.length; i++) {
        walk(rootChildren[i], false);
    }

    return candidates;
};