import { MTTAG, STTAG, whitespaceRegex } from "../../kernal/Constants";
import type { Direction, FlipMode, FlipPageStyle, SymbolType, WritingMode } from "../../kernal/types";

/**
 * Configuration dedicated to HTML / reflowable document media types
 */
export class HtmlOptions {
    
    /** Writing mode */
    writingMode: WritingMode="horizontal-tb";

    /** Text direction */
    direction: Direction="ltr";

    /** Flip mode: auto-web prefers scroll, mobile prefers page; scroll - continuous scroll, page - paginated */
    flipMode: FlipMode = "scroll";

    /** Number of layout columns, default: 1 */
    columns: number = 1;

    /** Whether to auto-split columns based on layout width */
    autoColumns: boolean = true;

    /** Whether to force HTML documents to display in scroll mode */
    forceScroll: boolean=false;

    /** Flip page style: none - no style, slide - sliding */
    flipPageStyle: FlipPageStyle = "none";

    /** Whether to prevent the parent element from scrolling */
    preventParentElementScroll: boolean=false;

    /** Maximum number of columns */
    maxColumns: number=10;

    /** Column gap in px */
    columnGap: number = 40;

    /** Whether to enable column rule styles */
    enableColumnRule: boolean = true;

    /** Column threshold width in px */
    columnWidth: number = 768;

    /** Maximum allowed width of the content scroll area */
    maxScrollContentWidth?: number;

    /** Whether to auto-fit page width */
    enableAutoFitPageWidth?: boolean;

    /** Maximum single-column width in page (paginated) mode */
    maxColumnWidth?: number;

    /** When multiple columns are specified, width factor of each column relative to single-column width (between 0.5 and 1) */
    multiColumnWidthFactor: number = 0.8;

    /** Whether to enable redirect animation */
    enableRedirectAnimation = true;

    /** Content container bottom margin in px */
    contentWrapperMarginBottom: number = 10;
    contentWrapperMarginTop: number = 10;
    contentWrapperBorderRadius: number = 3;
    enableContentWrapperBorderRadius: boolean = true;

    /** Content margin */
    contentsShadowMargin: number = 10;

    /** Number of files to preload (how many files above and below the current file) */
    preloadFileCount: number = 1;

    /** Maximum allowed file size for a single document */
    singleDocMaxSize: number = 50 * 1024 * 1024;

    /** Maximum image width ratio (relative to the current visible area height) */
    maxImageWidthRatio: number = 0.7;
    /** Maximum image height ratio (relative to the current visible area height) */
    maxImageHeightRatio: number = 0.7;

    /** Default font family */
    fontFamily: string = "'Roboto','Helvetica Neue', 'Helvetica', 'Arial','Microsoft YaHei','PingFang SC', 'sans-serif'";

    /** Default font weight */
    fontWeight: string = "normal";

    /** Lighter font weight */
    lighterFontWeight: string = "300";

    /** Default font size */
    fontSize: string = "18px";

    /** Whether to prefer the srcdoc attribute */
    preferSrcdoc: boolean = false;

    /** Set of non-plain-text visible element tag names */
    nonWhiteSpaceSymbolTagNames = ["object", "svg", "embed", "audio", "video", "canvas", "img"];

    /** HTML block-level tags */
    htmlBlockTags = [
        "" + MTTAG.toLowerCase() + "",
        "h1", "h2", "h3", "h4", "h5", "h6", "div", "p", "ol", "ul", "li", "dl", "dt", "dd", "hr",
        "center", "pre", "table", "tr", "td", "thead", "tbody", "tfoot", "caption", "address",
        "fieldset", "form", "legend", "noscript", "noframes", "style", "script", "link",
        "object", "svg", "embed", "audio", "video", "canvas", "img",
    ];

    /** HTML inline tags */
    htmlInlineTags = [
        "" + STTAG.toLowerCase() + "",
        "a", "abbr", "acronym", "b", "bdo", "big", "br", "cite", "code", "dfn", "em", "font",
        "i", "input", "kbd", "label", "q", "s", "samp", "select", "small", "span", "strike",
        "strong", "sub", "sup", "textarea", "tt", "u",
    ];

    /** Default method for counting document symbols (characters and multimedia) */
    symbolType: SymbolType = "custom";

    /** Whitespace character regex (excluding space) */
    whitespaceRegex = whitespaceRegex;

    /** Whether to remove whitespace characters from HTML documents (excluding space) */
    removeHtmlWhitespace: boolean = true;

    /** Whether to forcibly remove spaces between tags */
    forceRemoveHtmlChar32BetweenTags = false;

    /** Custom tags */
    customTags = ["t", "tn", "n"];

    /** Supported file extensions */
    htmlExtensions = [".html", ".xhtml", ".xml"];
}

/** Common HtmlOptions property names */
export const HtmlOptionKeys = [
    "maxColumnWidth",
    "maxScrollContentWidth",
    "enableAutoFitPageWidth",
    "maxColumns",
    "contentWrapperMarginBottom",
    "contentWrapperBorderRadius",
    "enableContentWrapperBorderRadius",
    "contentsShadowMargin",
] as const satisfies readonly (keyof HtmlOptions)[];

export type HtmlOptionKey = typeof HtmlOptionKeys[number];

export const isHtmlOptionKey = (path: string): path is HtmlOptionKey =>
    (HtmlOptionKeys as readonly string[]).includes(path);
