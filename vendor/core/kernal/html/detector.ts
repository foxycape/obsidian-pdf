import type { WritingMode } from "../types";
import { getDocumentBody } from "./finder";

/**
 * Detect the document writing mode / layout direction.
 */
export const detectWritingMode = (rootElement: Document | Element): { found: boolean, element: Element, writingMode: WritingMode } => {
    const container = rootElement.ownerDocument == null ? getDocumentBody(rootElement.ownerDocument) : rootElement as Element;
    if (!container) {
        return { found: false, element: container, writingMode: "horizontal-tb" }
    }

    let element = container;
    while (element.children.length > 0) {
        let foundValidElementCount = 0;
        let foundValidElementIndex = 0;
        for (let i = 0; i < element.children.length; i++) {
            if (element.children[i].clientWidth <= 0 || element.children[i].clientHeight <= 0) {
                continue;
            }
            foundValidElementIndex = i;
            foundValidElementCount++;
            if (foundValidElementCount > 1) {
                break;
            }
        }
        if (foundValidElementCount == 1) {
            element = element.children[foundValidElementIndex];
        }
        else {
            break;
        }
    }

    const ownerWindow = container.ownerDocument?.defaultView;
    if (!ownerWindow) {
        return { found: false, element: container, writingMode: "horizontal-tb" }
    }
    const writingModeString = ownerWindow.getComputedStyle(element).writingMode.toLowerCase();
    let writingMode: WritingMode;
    switch (writingModeString) {
        case "horizontal-tb":
        case "vertical-lr":
        case "vertical-rl":
            {
                writingMode = writingModeString;
                break;
            }
        default: {
            writingMode = "horizontal-tb";
        }
    }
    return { found: true, element: element, writingMode: writingMode }
};
