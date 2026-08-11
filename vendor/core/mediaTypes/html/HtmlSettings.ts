export class HtmlSettings {
    /** Style to prevent column break-inside */
    static readonly BreakInsideAvoid = "break-inside-avoid";

    /** CSS class name for the contents container wrapper */
    static readonly ContentsContainerCssName = "contents-container";

    /** CSS class name for the slide-flip content container wrapper */
    static readonly TransformContainerCssName = "transform-container";

    /** CSS class name for the slide-flip content shadow container wrapper */
    static readonly ContentsShadowContainerCssName = "contents-shadow";

    /** CSS class name for the div that wraps the iframe */
    static readonly FileContentContainerClassName = "file-content-container";

    /** CSS class name for the default height of the div that wraps the iframe */
    static readonly FileContentContainerHeightClassName = "file-content-container-height";

    /** CSS class name for slide flip pages */
    static readonly TransformPagesClassName = "transform-pages";

    /** Attribute name for the original link value */
    static readonly LinkOriginHrefPropertyName = "lhx-origin-data-url";

    /** Attribute name for the document's current page */
    static readonly HtmlDocumentCurrentPagePropertyName = "data-page-index";

    /** Attribute name for the document's total page count */
    static readonly HtmlDocumentNumperOfPagesPropertyName = "data-number-of-pages";

    /** CSS class name for the goto animation */
    static readonly HtmlDocumentGotoAnimationCssName = "goto-animation";

    /** CSS class name that sets the last element's bottom margin to 0 in multi-column mode */
    static readonly WithoutMarginBottomCssName = "without-margin-bottom";

    static readonly PageMovingAttributeName = "page-moving";
}
