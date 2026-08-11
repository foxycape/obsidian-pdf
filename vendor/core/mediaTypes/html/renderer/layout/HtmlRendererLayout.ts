import { HtmlLayoutMetrics } from "./HtmlLayoutMetrics";
import { HtmlOptions } from "../../HtmlOptions";
import { Direction, EventNames, FlipMode, IDocumentsProvider, IProgressTracker, Reader, Theme, WritingMode } from "../../../../kernal";
import { ColumnOptions, IHtmlRendererLayout } from "./IHtmlRendererLayout";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";
import { IHtmlDocument } from "../IHtmlDocument";
import { ContentLayoutCssVariableNames } from "../style/ContentLayoutCssVariableNames";
import { getDocumentBody } from "../../../../kernal/html/finder";
import { HtmlSettings } from "../../HtmlSettings";
import { injectCssContent } from "../../../../kernal/html/injector";
import { isNullOrWhiteSpace } from "../../../../kernal/common/text";

export class HtmlRendererLayout implements IHtmlRendererLayout {
    /**Column layout style name */
    private readonly DocumentLayoutCssName = "document-layout";
    private readonly DocumentPageModeCssName = "document-page-mode";
    /**Vertical writing scroll mode style name */
    private readonly WritingVerticalScollDocumentLayoutCssName = "vertical-document-layout";

    constructor(private readonly owner: Reader,
        private readonly documentsProvider: IDocumentsProvider<IHtmlDocument>,
        private readonly renererviewport: IRendererViewport<HtmlLayoutMetrics>,
        private readonly progress: IProgressTracker,
        private readonly htmlOptions: HtmlOptions) {

    }

    async applyStyles(): Promise<void> {
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const doc of loadedDocuments) {
            await this.applyDocStyles(doc);
        }
    }

    async applyDocStyles(doc: IHtmlDocument): Promise<void> {
        const contentContainer = doc.getContentContainer() ?? await doc.getVirtualContentContainer();
        const documentElement = contentContainer.ownerDocument.documentElement;
        const flipMode = this.htmlOptions.flipMode;
        const metrics = this.renererviewport.getLayoutMetrics();
        const writingMode = this.htmlOptions.writingMode ?? 'horizontal-tb';
        const direction = this.htmlOptions.direction ?? 'ltr';
        //inject column styles
        const css = await this.prepareDocStyes(documentElement.ownerDocument, writingMode, direction);
        injectCssContent(documentElement.ownerDocument, css, true, 'columns-layout-css');
        const themeProvider = await this.owner.services.get('themeProvider');
        let theme: Theme;
        if (!themeProvider) {
            theme = new Theme();
        }
        else {
            theme = themeProvider.getCurrentTheme();
        }
        const cssVariables = await this.getCssVariables(theme, metrics, flipMode);
        //apply
        for (const [key, value] of cssVariables) {
            documentElement.style.setProperty(key, value);
        }

        this.toggleColumnLayout(documentElement, flipMode, writingMode, direction);
    }

    private async getCssVariables(theme: Theme, metrics: HtmlLayoutMetrics, flipMode: FlipMode) {
        let columnMaxHeight: string;
        if (flipMode == "scroll") {
            columnMaxHeight = "none"
        }
        else {
            columnMaxHeight = metrics.columnHeight + "px"
        }
        const vars = new Map<string, string>();
        vars.set(ContentLayoutCssVariableNames.ColumnWidth, metrics.columnWidth + "px");
        vars.set(ContentLayoutCssVariableNames.ColumnHeight, metrics.columnHeight + "px");
        vars.set(ContentLayoutCssVariableNames.ColumnMaxHeight, columnMaxHeight);
        vars.set(ContentLayoutCssVariableNames.ContentShadowWidth, metrics.shadowWidth + "px");
        vars.set(ContentLayoutCssVariableNames.ColumnWidthNumber, metrics.columnWidth.toString());
        vars.set(ContentLayoutCssVariableNames.ColumnHeightNumber, metrics.columnHeight.toString());

        vars.set(ContentLayoutCssVariableNames.PageWidth, metrics.pageWidth + "px");
        vars.set(ContentLayoutCssVariableNames.PageHeight, metrics.pageHeight + "px");
        vars.set(ContentLayoutCssVariableNames.PageMoveLength, metrics.pageMoveLength + "px");
        vars.set(ContentLayoutCssVariableNames.ColumnGap, this.htmlOptions.columnGap + "px");
        if (this.htmlOptions.enableColumnRule && this.htmlOptions.columns > 1 && !isNullOrWhiteSpace(theme.columnRuleColor)) {
            vars.set(Theme.ColumnRuleColor, theme.columnRuleColor);
        }
        else {
            vars.set(Theme.ColumnRuleColor, "none");
        }

        // const imageRatio = this.runtime.getFlipMode() == "page" ? 0.7 : 1;
        vars.set(ContentLayoutCssVariableNames.MaxImageHeightRatio, `${this.htmlOptions.maxImageHeightRatio}`);
        // vars.set(ReaderCssVariables.MaxImageWidthRatio, `${imageRatio}`);
        vars.set(ContentLayoutCssVariableNames.MaxImageWidthRatio, `${this.htmlOptions.maxImageWidthRatio}`);

        return vars;
    }

    protected async prepareDocStyes(doc: Document, writingMode: WritingMode, direction: Direction): Promise<string> {
        //default document layout
        let css = "";
        css += `html { writing-mode: ${writingMode} !important; direction: ${direction} !important; }`;
        css += `body { writing-mode: ${writingMode} !important; direction: ${direction} !important; }`;

        //writing mode
        css += "." + this.DocumentPageModeCssName + "";
        css += `{`;
        css += "width:var(" + ContentLayoutCssVariableNames.PageWidth + ") !important;";
        css += "height:var(" + ContentLayoutCssVariableNames.PageHeight + ") !important;";
        css += "column-width:var(" + ContentLayoutCssVariableNames.ColumnWidth + ") !important;";
        css += "column-rule:1px solid var(" + Theme.ColumnRuleColor + ") !important;";
        css += "column-fill:auto;column-gap:var(" + ContentLayoutCssVariableNames.ColumnGap + ") !important;";
        css += "page-break-inside:avoid;break-inside:avoid;";
        css += "transition-property: transform;";
        css += "overflow: hidden !important;";
        css += "overflow-wrap: break-word !important;";
        css += "position: static !important;";
        css += "border: 0px !important;";
        css += "margin: 0px !important;";
        css += "padding:0px !important;";
        css += "max-height: none !important;";
        css += "max-width: none !important;";
        css += "}";


        // //Vertical writing, scroll mode layout
        // css += "." + this.WritingVerticalScollColumnsLayoutCssName + "";
        // css += "{";
        // //Vertical layout, height using column width
        // css += "width:100%;height:var(" + ContentLayoutCssVariableNames.ColumnWidth + ") !important;";
        // css += "column-fill:auto;column-width:var(" + ContentLayoutCssVariableNames.ColumnWidth + ") !important;"
        // css += "column-gap:var(" + ContentLayoutCssVariableNames.ColumnGap + ") !important;";
        // css += "page-break-inside:avoid;break-inside:avoid;";
        // css += "margin:0 auto !important;padding:0 !important;";
        // css += "column-rule:1px solid var(" + Theme.ColumnRuleColor + ") !important;";
        // css += "}";

        const contentContainer = getDocumentBody(doc);
        const lastElementChild = contentContainer.lastElementChild;
        if (lastElementChild) {
            css += "." + HtmlSettings.WithoutMarginBottomCssName + "{margin-block-end:0 !important;}";
            lastElementChild.classList.add(HtmlSettings.WithoutMarginBottomCssName);
        }
        return css;
    }

    private toggleColumnLayout(rootElement: HTMLElement, flipMode: FlipMode, writingMode: WritingMode, direction: Direction) {
        rootElement.classList.add(this.DocumentLayoutCssName);
        if (flipMode == "page") {
            rootElement.classList.add(this.DocumentPageModeCssName);
        }
        else {
            rootElement.classList.remove(this.DocumentPageModeCssName);
            if (this.isVerticalWriting(writingMode)) {
                rootElement.classList.add(this.WritingVerticalScollDocumentLayoutCssName);
            }
            else {
                rootElement.classList.remove(this.WritingVerticalScollDocumentLayoutCssName);
            }
        }
    }

    private isVerticalWriting(writingMode: WritingMode) {
        return writingMode == "vertical-lr" || writingMode == "vertical-rl";
    }

    async changeFlipMode(flipMode: FlipMode): Promise<void> {
        if (this.htmlOptions.flipMode === flipMode) {
            return;
        }
        const oldFlipMode = this.htmlOptions.flipMode;
        if (!this.owner.context.currentLocation?.precise) {
            const progress = await this.progress.getProgress(true);
            if (progress) {
                this.owner.context.currentLocation = progress.location;
            }
        }
        this.owner.context.setUserChangedProgress(false);
        this.htmlOptions.flipMode = flipMode;
        this.renererviewport.applyCssVariables();
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const doc of loadedDocuments) {
            await this.applyDocStyles(doc);
        }
        this.owner.events.emit(EventNames.LayoutChange, { flipMode: { previous: oldFlipMode, current: flipMode } });
        await this.documentsProvider.reload();
    }

    async changeColumns(columnOptions: ColumnOptions): Promise<void> {
        if (this.htmlOptions.columns === columnOptions.columns && this.htmlOptions.autoColumns === columnOptions.autoColumns) {
            return;
        }
        const oldColumns = this.htmlOptions.columns;
        const oldAutoColumns = this.htmlOptions.autoColumns;
        if (!this.owner.context.currentLocation?.precise) {
            const progress = await this.progress.getProgress(true);
            if (progress) {
                this.owner.context.currentLocation = progress.location;
            }
        }
        this.owner.context.setUserChangedProgress(false);
        this.htmlOptions.columns = columnOptions.columns;
        this.htmlOptions.autoColumns = columnOptions.autoColumns;
        this.renererviewport.applyCssVariables();
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const doc of loadedDocuments) {
            await this.applyDocStyles(doc);
        }
        this.owner.events.emit(EventNames.LayoutChange, { columns: { previous: oldColumns, current: columnOptions.columns }, autoColumns: { previous: oldAutoColumns, current: columnOptions.autoColumns } });
        await this.documentsProvider.reload();
    }
}
