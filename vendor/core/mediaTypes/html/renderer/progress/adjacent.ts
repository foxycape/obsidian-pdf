import { cutString, getByteLength } from "../../../../kernal/common/text";
import type { IDocumentsProvider } from "../../../../kernal";
import { compareTagName } from "../../../../kernal/html/finder";
import { IHtmlDocument } from "../IHtmlDocument";

const findMoreText = (
    htmlBlockTags: string[],
    extension: string,
    startElement: Element,
    existText: string,
    maxByteLength: number
): string => {
    startElement = getContainNextElementSiblingElement(extension, startElement);
    if (!startElement)
        return existText;
    const whitespaceRegex = /[\s]+/g;
    let textByteLength = getByteLength(existText)
    let finished = false;
    while (startElement?.nextElementSibling) {
        const currentText = startElement.nextElementSibling.textContent.replace(whitespaceRegex, ' ');
        let currentTextByteLength = getByteLength(currentText)
        if (textByteLength + currentTextByteLength >= maxByteLength) {
            const partialText = cutString(currentText, maxByteLength - textByteLength, "..");
            const isBlockTag = checkIsBlockTag(htmlBlockTags, startElement.nextElementSibling.tagName);
            if (isBlockTag) {
                existText += " " + partialText;
            }
            else {
                existText += partialText;
            }

            finished = true
            break;
        }
        else {
            const isBlockTag = checkIsBlockTag(htmlBlockTags, startElement.nextElementSibling.tagName);
            if (isBlockTag) {
                existText += " " + currentText;
            }
            else {
                existText += currentText
            }

            textByteLength += currentTextByteLength
            startElement = startElement.nextElementSibling;
        }
    }
    if (!finished) {
        return findMoreText(htmlBlockTags, extension, startElement, existText, maxByteLength)
    }
    else {
        return existText;
    }
};

const getContainNextElementSiblingElement = (extension: string, startElement: Element) => {
    if (!startElement || compareTagName(startElement.tagName, "BODY") || compareTagName(startElement.tagName, "HTML") || (extension == ".pdf" && startElement.classList.contains("page")))
        return null;
    while (!startElement.nextElementSibling) {
        if (compareTagName(startElement.tagName, "BODY") || compareTagName(startElement.tagName, "HTML") || !startElement.parentElement || (extension == ".pdf" && startElement.classList.contains("page"))) {
            break;
        }
        startElement = startElement.parentElement;
    }
    return startElement;
};

export const checkIsBlockTag = (htmlBlockTags: string[], tagName: string) => {
    if (!tagName || !htmlBlockTags) {
        return true
    }
    return htmlBlockTags.includes(tagName.toLowerCase());
};

/**
 * Get text adjacent to an element.
 */
export const getAdjacentText = (
    documentsProvider: IDocumentsProvider<IHtmlDocument>,
    htmlBlockTags: string[],
    extension: string,   
    startElement?: Element,
    maxCharacterCount?: number
) => {
    const defaultCharacterCount = 32;
    maxCharacterCount = maxCharacterCount ?? defaultCharacterCount;
    if (maxCharacterCount <= 0) {
        maxCharacterCount = defaultCharacterCount
    }
    const maxByteLength = maxCharacterCount * 2;
    let element = startElement;
    if (!startElement) {
        const visibleDocuments = documentsProvider.getVisibleDocuments();
        if (visibleDocuments.length == 0)
            return "";
        let doc: IHtmlDocument;
        for (let i = 0; i < visibleDocuments.length; i++) {
            doc = visibleDocuments[i];
            const elements = doc.getVisibleElements(true);
            if (elements.length > 0) {
                element = elements[0];
                break;
            }
        }
        if (!element) {
            return "";
        }
    }
    const whitespaceRegex = /[\s]+/g;
    let text = element.textContent.replace(whitespaceRegex, ' ');
    let textByteLength = getByteLength(text)
    if (textByteLength >= maxByteLength) {
        return cutString(text, maxByteLength, "..");
    }
    if (text.length >= 10 && extension != ".pdf") {
        return text;
    }

    return findMoreText(htmlBlockTags, extension, element, text, maxByteLength);
};
