/**
 * Symbol type: custom - custom symbols, char - characters
 */
export type SymbolType = "custom" | "char";
export type PageDirection = 'previous' | 'next'
export type WritingMode = 'horizontal-tb' | 'vertical-rl' | 'vertical-lr';
export type Direction = 'ltr' | 'rtl';
export type FlipMode = 'scroll' | 'page';
export type FlipPageStyle = 'none' | 'slide';
export type ChangeLayoutOptions = {
    flipMode: FlipMode;
    columns: number;
    autoColumns: boolean;
    preserveLocation: boolean;
}

export type TextSymbolOptions = {
    removeHtmlWhitespace?: boolean;
    whitespaceRegex?: RegExp;
    nonWhiteSpaceSymbolTagNames?: string[];
};

export type TagDescriptor = { tagName: string; tagIndex: number };