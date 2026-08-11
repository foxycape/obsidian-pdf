import type { TextFormatOptions } from "../IDocument";

export const isNullOrWhiteSpace = (value: string | undefined | null): boolean => {
    if (!value) {
        return true;
    }
    if (typeof value != "string") {
        return false;
    }
    return value.trim().length == 0;
};

export const startsWithAny = (value: string, ignoreCase: boolean, ...searchStrings: string[]) => {
    let found = false;
    let origin = value;
    if (ignoreCase) {
        origin = value.toLowerCase();
    }
    for (let i = 0; i < searchStrings.length; i++) {
        const searchString = ignoreCase ? searchStrings[i].toLowerCase() : searchStrings[i];
        if (origin.indexOf(searchString) == 0) {
            found = true;
            break;
        }
    }
    return found;
};

export const startsWith = (value: String, searchString: string, ignoreCase?: boolean, position?: number) => {
    if (!value) {
        return false;
    }
    if (!searchString)
        return false;
    if (ignoreCase) {
        return value.toLowerCase().indexOf(searchString.toLowerCase(), position) == 0
    }
    else {
        return value.indexOf(searchString, position) == 0
    }
};

export const getByteLength = (value: string) => {
    if (value == undefined || value == null)
        return 0;
    let length = 0;
    for (let i = 0; i < value.length; i++) {
        if (value.charCodeAt(i) > 255) {
            length += 2;
        } else {
            length++;
        }
    }
    return length;
};

export const is32Bit = (c: string) => {
    return c.codePointAt(0) > 0xFFFF;
};

export const cutString = (value: string, byteLength: number, end: string = "") => {
    if (!value)
        return ""
    const length = value.length;
    let i = 0;
    for (; i < byteLength && i < length; i++) {
        if (value.codePointAt(i) > 0xFF) {
            byteLength--;
        }
    }
    if (byteLength < i && i > 0)
        byteLength = i - 1;
    else if (byteLength > length)
        byteLength = length;
    if (byteLength < length) {
        let newValue = value.substring(0, byteLength);
        const newValueLength = newValue.length;
        if (newValue.codePointAt(newValueLength - 1) != value.codePointAt(newValueLength - 1)) {
            newValue = newValue.substring(0, newValueLength - 1);
        }
        return newValue + end;
    }
    return value.substring(0, byteLength);
};

const splitos = [".", "。", "？", "?", "!", "！"];

/**
 * Format text (e.g. remove consecutive whitespace, collapse consecutive blank lines into a single newline)
 */
export const formatText = (text: string, options: TextFormatOptions) => {

    if (typeof text != "string") {
        return ''
    }

    if (!text) {
        return text;
    }

    if (options?.removeCJWhitespace) {
        text = removeCJCharWhitespace(text)
    }
    if (options?.combineLines) {
        let newText = "";
        const splitTexts = text.split('\n');
        for (const splitText of splitTexts) {
            const value = splitText?.trim() ?? '';
            if (!value) {
                continue;
            }

            newText += value;
            const lastChar = value.substring(value.length - 1);
            if (splitos.includes(lastChar)) {
                newText += '\n'
            }
        }
        text = newText;
    }
    if (options?.removeConsecutiveWhitespaceCharacters) {
        text = text.replace(/[\f\t\v]+/g, '');
        text = text.replace(/^\s*[\r\n]\s*/gm, '');
    }

    if (options?.removeConsecutiveBlankLine) {
        text = text.replace(/[\r\n\t]+/g, '\r\n');
    }
    return text;
};

/** CJK Unified Ideographs and Compatibility zones (aligned with `checkIsCJKChars`); excludes `\w` so spaces between digits/Latin and CJK (e.g. "05 如何") are preserved */
const CJK_IDEOGRAPH_CLASS = '[\\u2E00-\\u312F\\u3190-\\u9FFF]';
const CJK_IDEOGRAPH_REGEX = /[\u2E00-\u312F\u3190-\u9FFF]/;

export const isCjkIdeographChar = (char: string): boolean => {
    if (!char) {
        return false;
    }
    return CJK_IDEOGRAPH_REGEX.test(char);
};

export const endsWithCjkIdeograph = (text: string): boolean => {
    if (!text) {
        return false;
    }
    return isCjkIdeographChar(text.charAt(text.length - 1));
};

export const startsWithCjkIdeograph = (text: string): boolean => {
    if (!text) {
        return false;
    }
    return isCjkIdeographChar(text.charAt(0));
};

const removeCJCharWhitespaceForSafari = (text: string) => {
    if (!text) {
        return ''
    }
    const re = new RegExp(`(${CJK_IDEOGRAPH_CLASS})( +)(${CJK_IDEOGRAPH_CLASS})`, 'g');
    let prev = '';
    while (prev !== text) {
        prev = text;
        text = text.replace(re, '$1$3');
    }
    return text;
};

/**
 * Remove whitespace between CJK characters
 */
export const removeCJCharWhitespace = (text: string) => {
    if (!text) {
        return ''
    }
    if (typeof text != "string") {
        return ''
    }
    try {
        return text.replace(new RegExp(`(?<=${CJK_IDEOGRAPH_CLASS}) +(?=${CJK_IDEOGRAPH_CLASS})`, 'g'), '');
    }
    catch (_e) {
        return removeCJCharWhitespaceForSafari(text);
    }
};

/**
 * Check whether the text contains CJK characters
 */
export const checkIsCJKChars = (text: string) => {
    return new RegExp(/[\u2E00-\u312F\u3190-\u9FFF]/g).test(text)
};

/**
 * Remove consecutive punctuation marks
 */
export const removeConsecutivePunctuations = (text: string, count: number = 3) => {
    if (!text) {
        return text;
    }

    if (count < 2) {
        count = 2;
    }
    const punctuationRegex = new RegExp("/[\p{P}\p{S}]{" + count + ",}/gu")
    return text.replace(punctuationRegex, '');
};
