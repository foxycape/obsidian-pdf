
/**
 * HTML content css variables
 */
export class ContentCssVariables {
    static readonly FontSize = "--font-size";
    static readonly FontFamily = "--font-family";
    static readonly FontWeight = "--font-weight";
    static readonly TextLineHeight = "--text-line-height";
    static readonly ParagraphMarginTop = "--paragraph-margin-top";
    static readonly ParagraphMarginBottom = "--paragraph-margin-bottom";
    static readonly HeadMarginTop = "--head-margin-top";
    static readonly HeadMarginBottom = "--head-margin-bottom";
    static readonly HeadLineHeight = "--head-line-height";
    static readonly TextIndent = "--text-indent";
    static readonly TextAlign = "--text-align";

    private static defaultValues: Map<string, string>;

    static getDefaultVariables(): Map<string, string> {
        if (!this.defaultValues) {
            this.defaultValues = new Map<string, string>();
            this.defaultValues.set(ContentCssVariables.FontSize, "18px")
            this.defaultValues.set(ContentCssVariables.FontFamily, "inherit")
            this.defaultValues.set(ContentCssVariables.FontWeight, "normal")
            this.defaultValues.set(ContentCssVariables.ParagraphMarginTop, "0.5em")
            this.defaultValues.set(ContentCssVariables.ParagraphMarginBottom, "0.5em")
            this.defaultValues.set(ContentCssVariables.TextLineHeight, "1.65em")
            this.defaultValues.set(ContentCssVariables.HeadMarginTop, "0.5em")
            this.defaultValues.set(ContentCssVariables.HeadMarginBottom, "0.5em")
            this.defaultValues.set(ContentCssVariables.HeadLineHeight, "1.5em")
            this.defaultValues.set(ContentCssVariables.TextIndent, "2em")
            this.defaultValues.set(ContentCssVariables.TextAlign, "start")
        }
        return this.defaultValues;
    }
}
