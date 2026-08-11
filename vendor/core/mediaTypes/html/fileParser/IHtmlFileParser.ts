import { IFileParser, TextSymbolOptions } from "../../../kernal";

export interface IHtmlFileParser extends IFileParser {
    options: HtmlFileParserOptions;
}

/**
 * HTML file parser options (media-specific; not part of IFileParser).
 */
export type HtmlFileParserOptions = TextSymbolOptions & {
    /** Whether to force remove HTML character 32 between tags */
    forceRemoveHtmlChar32BetweenTags?: boolean;
    /** Whether to wrap floating text nodes (e.g. for fulltext translate) */
    wrapFullTextNode?: boolean;
};