import { HtmlLayoutMetrics } from "./HtmlLayoutMetrics";
import { HtmlOptions } from "../../HtmlOptions";
import { ViewportCssVariableNames } from "./ViewportCssVariableNames";
import { OptionsProvider } from "../../../../kernal/OptionsProvider";
import { Reader } from "../../../../kernal/Reader";
import { FlipMode, IDevice, IDisposable, Options } from "../../../../kernal";
import { HtmlContainerBuilder } from "../documents/HtmlContainerBuilder";
import { injectCssContent } from "../../../../kernal/html/injector";
import { HtmlSettings } from "../../HtmlSettings";
import { IRendererViewport } from "../../../../kernal/IRendererViewport";

export class HtmlRendererViewport implements IRendererViewport<HtmlLayoutMetrics>, IDisposable {
    private layout: HtmlLayoutMetrics;
    private readonly options: Options
    private readonly rendererContainer: HTMLElement;
    private readonly scrollElement: HTMLElement;
    private readonly contentsShadowContainer: HTMLElement;
    private readonly contentsContainer: HTMLElement;
    private readonly device: IDevice;
    private updateCssVariablesTimeoutId: any;
    private readonly optionsProvider: OptionsProvider;
    private readonly htmlOptions: HtmlOptions;
    private readonly containerBuilder: HtmlContainerBuilder;
    constructor(private readonly owner: Reader, private readonly readerContainer: HTMLElement, optionsProvider: OptionsProvider, htmlOptions: HtmlOptions) {
        this.options = this.owner.options;
        this.device = this.owner.device;
        this.optionsProvider = optionsProvider;
        this.htmlOptions = htmlOptions;
        this.containerBuilder = new HtmlContainerBuilder(htmlOptions);
        const { rendererContainer, rendererCss, otherCss } = this.containerBuilder.createContainers();
        injectCssContent(this.readerContainer.ownerDocument, rendererCss + otherCss, true, "html-renderer-style");
        this.readerContainer.appendChild(rendererContainer);
        this.rendererContainer = rendererContainer;
        this.scrollElement = this.rendererContainer;
        this.contentsShadowContainer = this.rendererContainer.querySelector('.' + HtmlSettings.ContentsShadowContainerCssName) as HTMLElement;
        this.contentsContainer = this.rendererContainer.querySelector('.' + HtmlSettings.ContentsContainerCssName) as HTMLElement;
    }

    getRendererContainer(): HTMLElement {
        return this.rendererContainer;
    }

    getScrollElement(): HTMLElement {
        return this.rendererContainer;
    }

    getLayoutMetrics(): HtmlLayoutMetrics {
        if (!this.layout) {
            this.applyCssVariables();
            this.layout = this.buildLayoutMetrics();
        }
        return this.layout;
    }

    applyCssVariables(): void {
        const rendererCssVariables = this.prepareRendererCssVariables();
        const otherCssVariables = this.prepareOtherCssVariables();
        const vars = new Map<string, string>();
        rendererCssVariables.forEach((v, k) => {
            vars.set(k, v);
        })
        otherCssVariables.forEach((v, k) => {
            vars.set(k, v);
        })
        const rootContainer = this.owner.getRootContainer();
        vars.forEach((v, k) => {
            rootContainer.style.setProperty(k, v);
        })
        this.layout = this.buildLayoutMetrics();
    }

    private prepareRendererCssVariables() {
        const flipMode = this.getFlipMode();
        const overflow = flipMode == 'page' ? 'hidden' : 'auto'
        const vars = new Map<string, string>();
        const contentWrapperMarginBottom = flipMode == 'page' ? 0 : (this.htmlOptions.contentWrapperMarginBottom ?? 10)
        const contentWrapperMarginTop = flipMode == 'page' ? 0 : (this.htmlOptions.contentWrapperMarginTop ?? 10)
        vars.set(ViewportCssVariableNames.ContentWrapperMarginTop, contentWrapperMarginTop + 'px');
        vars.set(ViewportCssVariableNames.ContentWrapperMarginBottom, contentWrapperMarginBottom + 'px');
        vars.set(ViewportCssVariableNames.ContentWrapperBorderRadius, (this.htmlOptions.contentWrapperBorderRadius ?? 0) + 'px');
        vars.set(ViewportCssVariableNames.ScrollElementOverflow, overflow);
        return vars;
    }

    private prepareOtherCssVariables() {
        const rootContainer = this.owner.getRootContainer();
        const flipMode = this.getFlipMode();
        if (flipMode == "page") {
            this.scrollElement?.scrollTo(0, 0);
        }

        const columnGap = (this.htmlOptions.columnGap ?? 40);
        const shadowContainer = this.contentsShadowContainer;
        const rendererWidth = this.rendererContainer.clientWidth;
        const rendererHeight = this.rendererContainer.clientHeight;

        this.rendererContainer.setAttribute("data-client-width", `${rendererWidth}`)
        this.rendererContainer.setAttribute("data-client-height", `${rendererHeight}`)
        const contentsContainerWidthNumber = this.getContentsContainerWidth();

        const contentsContainerWidth = contentsContainerWidthNumber + 'px';
        const scrollElementVerticalScrollBarWidth = this.rendererContainer.offsetWidth - this.rendererContainer.clientWidth;
        const scrollElementHorizontalScrollBarHeight = this.rendererContainer.offsetHeight - this.rendererContainer.clientHeight;

        const vars = new Map<string, string>();
        vars.set(ViewportCssVariableNames.ScrollElementVerticalScrollBarWidth, scrollElementVerticalScrollBarWidth + "px");
        vars.set(ViewportCssVariableNames.ScrollElementHorizontalScrollBarHeight, scrollElementHorizontalScrollBarHeight + "px");

        rootContainer.style.setProperty(ViewportCssVariableNames.ContentsContainerWidth, contentsContainerWidth)
        vars.set(ViewportCssVariableNames.ContentsContainerWidth, contentsContainerWidth);

        let contentsContainerPadding = 0;
        if (flipMode == "page") {
            contentsContainerPadding = 0;
        }

        if (rendererWidth - contentsContainerWidthNumber - 2 < 2 * contentsContainerPadding) {
            contentsContainerPadding = 0;
        }

        let contentsContainerPaddingString = "";
        if (contentsContainerPadding > 0) {
            contentsContainerPaddingString = "" + contentsContainerPadding + "px 0"
        }
        else {
            contentsContainerPaddingString = "0"
        }
        rootContainer.style.setProperty(ViewportCssVariableNames.ContentsContainerPadding, contentsContainerPaddingString)
        vars.set(ViewportCssVariableNames.ContentsContainerPadding, contentsContainerPaddingString);

        const columns = this.calculateColumns(contentsContainerWidthNumber);
        this.htmlOptions.columns = columns;
        const factor = this.getContentPaddingFactor();
        const shadowMargin = this.getContentsShadowMargin() + Math.min(20, contentsContainerWidthNumber * factor)

        const { columnWidth, remainder } = this.getFinalColumnWidth(contentsContainerWidthNumber - shadowMargin * 2, columns, columnGap)
        if (flipMode == "page") {
            if (remainder != 0) {
                shadowContainer.style.margin = `0 ${shadowMargin + (remainder / 2)}px`
            }
            else {
                shadowContainer.style.margin = `0 ${shadowMargin}px`
            }
        } else {
            shadowContainer.style.margin = `0px`
        }
        const shadowWidth = shadowContainer.getBoundingClientRect().width;
        this.rendererContainer.setAttribute("data-transform-length", (shadowWidth + columnGap).toString())
        this.rendererContainer.setAttribute("data-shadow-width", (shadowWidth).toString())

        this.rendererContainer.setAttribute("data-column-width", columnWidth.toString())
        this.rendererContainer.setAttribute("data-column-gap", columnGap.toString())
        this.rendererContainer.setAttribute("data-page-width", `${columnWidth}`)

        const { contentWrapperPaddingBottomNumber, contentWrapperPaddingTopNumber, contentWrapperPadding, contentWrapperPaddingTopBottom } = this.getContentWrapperPadding(contentsContainerWidthNumber, columnGap)

        this.rendererContainer.setAttribute("data-page-height", `${(rendererHeight - contentWrapperPaddingTopNumber - contentWrapperPaddingBottomNumber)}`)

        vars.set(ViewportCssVariableNames.ContentWrapperWidth, shadowWidth + 'px');
        if (flipMode == "scroll") {
            vars.set(ViewportCssVariableNames.ContentWrapperMinWidth, (shadowWidth) + 'px');
        } else {
            vars.set(ViewportCssVariableNames.ContentWrapperMinWidth, (columnWidth + columnGap / 2) + 'px');
        }
        vars.set(ViewportCssVariableNames.ContentWrapperHeight, this.getContentWrapperHeight());
        vars.set(ViewportCssVariableNames.ContentWrapperMinHeight, rendererHeight + "px");
        vars.set(ViewportCssVariableNames.ContentWrapperMaxHeight, rendererHeight + "px");
        vars.set(ViewportCssVariableNames.ContentWrapperPadding, contentWrapperPadding);

        if (flipMode == "page") {
            vars.set(ViewportCssVariableNames.ContentContainerWidth, columnWidth + 'px');
        }
        else {
            vars.set(ViewportCssVariableNames.ContentContainerWidth, '100%');
        }

        const contentContainerHeight = `calc(var(${ViewportCssVariableNames.ContentWrapperHeight}) - ${contentWrapperPaddingTopBottom})`
        vars.set(ViewportCssVariableNames.ContentContainerHeight, contentContainerHeight);
        vars.set(ViewportCssVariableNames.ContentColumnGap, columnGap + 'px');

        if (this.rendererContainer) {
            vars.set(ViewportCssVariableNames.ContentsContainerOffsetLeft, "calc((" + this.rendererContainer.clientWidth + "px - " + contentsContainerWidth + ") / 2)");
            this.updateCssVariablesTimeoutId = setTimeout(() => {
                const offsetLeftVars = new Map<string, string>();
                offsetLeftVars.set(ViewportCssVariableNames.ContentsContainerOffsetLeft, this.contentsContainer.offsetLeft + "px");
                offsetLeftVars.forEach((v, k) => {
                    rootContainer.style.setProperty(k, v);
                })
                if (rootContainer) {
                    offsetLeftVars.forEach((v, k) => {
                        rootContainer.style.setProperty(k, v);
                    })
                }
            }, 1000);
        }
        return vars;
    }

    private buildLayoutMetrics() {
        const flipMode = this.getFlipMode();
        const layoutMetrics = new HtmlLayoutMetrics();
        const rendererContainer = this.rendererContainer;
        const { clientWidth, clientHeight } = rendererContainer;
        const moveLength = parseFloat(rendererContainer.getAttribute("data-transform-length"))
        layoutMetrics.clientWidth = clientWidth;
        let pageHeight: number;
        if (flipMode == "scroll") {
            const innerHeight = this.rendererContainer.ownerDocument.defaultView.innerHeight;
            pageHeight = innerHeight - this.optionsProvider.getHeaderHeight() - this.optionsProvider.getFooterHeight();
        }
        else {
            pageHeight = parseFloat(rendererContainer.getAttribute("data-page-height"))
        }
        layoutMetrics.clientHeight = clientHeight;
        layoutMetrics.pageHeight = pageHeight;
        layoutMetrics.columnHeight = pageHeight;
        layoutMetrics.columnGap = parseFloat(rendererContainer.getAttribute("data-column-gap"))
        layoutMetrics.columnWidth = parseFloat(rendererContainer.getAttribute("data-column-width"))
        layoutMetrics.pageWidth = parseFloat(rendererContainer.getAttribute("data-page-width"));
        layoutMetrics.pageMoveLength = moveLength
        layoutMetrics.shadowWidth = parseFloat(rendererContainer.getAttribute("data-shadow-width"))
        return layoutMetrics;
    }

    private getContentWrapperHeight() {
        if (this.getFlipMode() == "page") {
            return `${this.rendererContainer.clientHeight}px`;
        }
        if (this.owner.inIframe) {
            return "100%";
        }
        else {
            return 'auto'
        }
    }

    private getContentsShadowMargin() {
        return this.htmlOptions.contentsShadowMargin ?? 10
    }

    private getContentWrapperPadding(contentsContainerWidthNumber: number, columnGap: number) {
        const flipMode = this.getFlipMode();
        const factor = this.getContentPaddingFactor();
        let contentWrapperPaddingTopNumber = flipMode == 'scroll' ? 30 : 0;
        const paddingTopOrBottomNumber = this.getContentsShadowMargin();

        if (flipMode == "page") {
            contentWrapperPaddingTopNumber += paddingTopOrBottomNumber
        }
        const contentWrapperPaddingTop = contentWrapperPaddingTopNumber + 'px';

        let contentWrapperPaddingBottomNumber = flipMode == "scroll" ? 30 : 0;
        if (flipMode == "page") {
            contentWrapperPaddingBottomNumber += paddingTopOrBottomNumber
        }
        if (flipMode == "scroll" && contentWrapperPaddingBottomNumber < this.options.minFooterHeight) {
            contentWrapperPaddingBottomNumber = this.options.minFooterHeight
        }

        const paddingLeftOrRightNumber = this.getContentsShadowMargin() + Math.min(20, contentsContainerWidthNumber * factor);

        const contentWrapperPaddingBottom = contentWrapperPaddingBottomNumber + 'px';
        const contentWrapperPaddingLeft = flipMode == 'scroll' ? `${paddingLeftOrRightNumber}px` : '0'
        const contentWrapperPaddingRight = flipMode == 'scroll' ? `${paddingLeftOrRightNumber}px` : '0'
        const contentWrapperPaddingLeftRight = flipMode == 'scroll' ? `${columnGap}px` : '0'
        const contentWrapperPaddingTopBottom = `${contentWrapperPaddingTopNumber + contentWrapperPaddingBottomNumber}px`;
        const contentWrapperPadding = flipMode == 'scroll' ? `${contentWrapperPaddingTopNumber}px ${paddingLeftOrRightNumber}px ${contentWrapperPaddingBottomNumber}px ${paddingLeftOrRightNumber}px` : `${contentWrapperPaddingTopNumber}px 0 0 0px`;
        return {
            contentWrapperPaddingTop,
            contentWrapperPaddingLeft,
            contentWrapperPaddingRight,
            contentWrapperPaddingBottom,
            contentWrapperPaddingLeftRight,
            contentWrapperPaddingTopBottom,
            contentWrapperPadding,
            contentWrapperPaddingTopNumber,
            contentWrapperPaddingBottomNumber
        }
    }

    private getColumnWidth = () => {
        if (this.htmlOptions.maxColumnWidth) {
            return Math.abs(this.htmlOptions.maxColumnWidth)
        }
        return 768;
    }

    private getContentsContainerWidth() {
        const { width } = this.rendererContainer.getBoundingClientRect();
        const clientWidth = width;
        if (this.device.getDeviceType() == 'mobile' && clientWidth <= 768) {
            return clientWidth;
        }

        if (this.getFlipMode() == "scroll") {
            if (this.htmlOptions.enableAutoFitPageWidth) {
                return clientWidth;
            }
            if (this.htmlOptions.maxScrollContentWidth) {
                return Math.min(clientWidth, Math.abs(this.htmlOptions.maxScrollContentWidth));
            }

            return Math.min(clientWidth, this.htmlOptions.columnWidth);
        }

        let currentColumns = this.htmlOptions.columns
        const columnWidth = this.getColumnWidth()
        if (this.htmlOptions.autoColumns) {
            if (!this.htmlOptions.maxColumns) {
                return clientWidth;
            }
            if (clientWidth <= columnWidth) {
                currentColumns = 1;
            }
            else {
                currentColumns = this.htmlOptions.maxColumns;
            }
        }

        const factor = this.getMultiColumnWidthFactor();
        if (currentColumns > 1) {
            return Math.min(clientWidth, currentColumns * columnWidth * factor);
        }

        return Math.min(clientWidth, columnWidth);

    }

    private calculateColumns(contentsContainerWidth: number) {
        let columns = this.htmlOptions.columns ?? 1;
        const columnWidth = this.getColumnWidth()
        if (this.htmlOptions.autoColumns) {
            if (contentsContainerWidth <= columnWidth) {
                columns = 1;
            }
            else {
                columns = Math.floor(contentsContainerWidth / columnWidth);
                const remainder = contentsContainerWidth % columnWidth;
                if (remainder > columnWidth / 5 || remainder > columns * 50) {
                    columns += 1;
                }
                if (this.htmlOptions.maxColumns && columns > this.htmlOptions.maxColumns) {
                    columns = this.htmlOptions.maxColumns;
                }
            }
        }
        return columns;
    }

    private getFinalColumnWidth(moveLength: number, columns: number, columnGap: number) {
        const totalGap = columnGap * (columns - 1);
        let columnWidth = (moveLength - totalGap) / columns;
        let remainder = 0;
        const roundedColumnWidth = Math.round(columnWidth)
        if (roundedColumnWidth != columnWidth) {
            columnWidth = roundedColumnWidth
            remainder = moveLength - (columns * roundedColumnWidth + totalGap)
        }
        return { columnWidth, remainder };
    }

    private getContentPaddingFactor() {
        return this.device.getDeviceType() == 'mobile' ? 0.01 : 0.05;
    }

    private getMultiColumnWidthFactor() {
        let factor = this.htmlOptions.multiColumnWidthFactor;
        if (!factor) {
            factor = 0.8;
        }
        factor = Math.abs(factor);

        if (factor < 0.5)
            factor = 0.5;
        if (factor > 1)
            factor = 1;
        return factor;
    }

    private getFlipMode(): FlipMode {
        if (this.htmlOptions.forceScroll) {
            return "scroll";
        }
        return this.htmlOptions.flipMode;
    }

    async dispose(): Promise<void> {
        if (this.updateCssVariablesTimeoutId) {
            clearTimeout(this.updateCssVariablesTimeoutId)
            this.updateCssVariablesTimeoutId = null;
        }
    }
}
