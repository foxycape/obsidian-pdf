import { createElement } from "../../../../kernal/html/injector";
import { getRandomId } from "../../../../kernal/common/uuid";
import { Options, Theme } from "../../../../kernal";
import { HtmlSettings } from "../../HtmlSettings";
import { HtmlOptions } from "../../HtmlOptions";
import { ViewportCssVariableNames } from "../layout/ViewportCssVariableNames";

export class HtmlContainerBuilder {
    private readonly htmlOptions: HtmlOptions;
    constructor(htmlOptions: HtmlOptions) {
        this.htmlOptions = htmlOptions;
    }

    createContainers() {
        const { rendererCss, rendererContainer } = this.createRendererContainer();
        const { contentsContainer, transformContainer, contentsContainerCss, transformContainerCss, contentContainerCss } = this.createOtherContainers();
        rendererContainer.appendChild(contentsContainer);
        const otherCss = contentsContainerCss + transformContainerCss + contentContainerCss;
        return { rendererContainer, rendererCss, otherCss, contentsContainer, transformContainer };
    }

    private createRendererContainer() {
        const rendererClassName = "renderer";
        let rendererCss = `.${rendererClassName}{margin-block-start:var(${Options.HeaderHeight});`
        rendererCss += `margin-block-end:var(${Options.FooterHeight});`
        rendererCss += `overflow:auto;outline:none;width:100%;`
        rendererCss += `height:calc(100% - var(${Options.HeaderHeight}) - var(${Options.FooterHeight}));`;
        rendererCss += `overflow-y:var(${ViewportCssVariableNames.ScrollElementOverflow});`;
        rendererCss += `overflow-x:hidden;`;
        rendererCss += `}`;

        const rendererContainer = createElement(document, "div", getRandomId(true), rendererClassName);
        rendererContainer.classList.add(Theme.customScrollerClassName);
        rendererContainer.setAttribute("data-role", "renderer-container");
        return { rendererCss, rendererContainer };
    }

    private createOtherContainers() {
        // All contents container div
        const contentsContainerClassName = HtmlSettings.ContentsContainerCssName;
        let contentsContainerCss = `.${contentsContainerClassName}{width:var(${ViewportCssVariableNames.ContentsContainerWidth});`;
        contentsContainerCss += `margin:0 auto;`;
        contentsContainerCss += `padding:var(${ViewportCssVariableNames.ContentsContainerPadding});`;
        contentsContainerCss += `}`;
        const contentsContainer = createElement(document, "div", getRandomId(true), contentsContainerClassName);
        contentsContainer.setAttribute("data-role", "contents-container");

        // Shadow layer for all contents container
        const contentsContainerShadow = createElement(document, "div", getRandomId(true), HtmlSettings.ContentsShadowContainerCssName);

        // Slide page-turn div
        const transformContainer = createElement(document, "div", getRandomId(true), HtmlSettings.TransformContainerCssName);
        if (this.htmlOptions.flipPageStyle == 'slide') {
            transformContainer.classList.add('slide');
        }
        contentsContainerShadow.appendChild(transformContainer);
        contentsContainer.appendChild(contentsContainerShadow);

        let contentContainerCss = "." + HtmlSettings.FileContentContainerClassName + "{";
        contentContainerCss += "position:relative;";
        contentContainerCss += "width:auto;";
        contentContainerCss += "min-width:var(" + ViewportCssVariableNames.ContentWrapperMinWidth + ");";
        contentContainerCss += "overflow:hidden;height:var(" + ViewportCssVariableNames.ContentWrapperHeight + ");";
        contentContainerCss += "padding:var(" + ViewportCssVariableNames.ContentWrapperPadding + ");";
        contentContainerCss += "margin-block-end: var(" + ViewportCssVariableNames.ContentWrapperMarginBottom + ");";
        if (this.htmlOptions.enableContentWrapperBorderRadius && this.htmlOptions.flipMode == 'scroll') {
            contentContainerCss += "border-radius: var(" + ViewportCssVariableNames.ContentWrapperBorderRadius + ");";
        }
        contentContainerCss += "background:var(" + Theme.ContentBackground + ");";
        contentContainerCss += "}";

        contentContainerCss += "." + HtmlSettings.FileContentContainerClassName + ":first-child{";
        contentContainerCss += "margin-block-start: var(" + ViewportCssVariableNames.ContentWrapperMarginTop + ");";
        contentContainerCss += "}";
        // Touch page-turn styles

        contentContainerCss += "." + HtmlSettings.FileContentContainerClassName + "." + HtmlSettings.FileContentContainerHeightClassName + "{";
        contentContainerCss += "min-height:var(" + ViewportCssVariableNames.ContentWrapperMinHeight + ");";
        contentContainerCss += "max-height:var(" + ViewportCssVariableNames.ContentWrapperMaxHeight + ");";
        contentContainerCss += "}";
        // Touch page-turn styles
        let transformContainerCss = "";
        transformContainerCss += "." + HtmlSettings.TransformPagesClassName + " ." + HtmlSettings.ContentsContainerCssName + "{";
        transformContainerCss += `overflow:hidden;background-color:var(${Theme.ContentBackground})`;
        transformContainerCss += "}";
        transformContainerCss += "." + HtmlSettings.TransformPagesClassName + " ." + HtmlSettings.TransformContainerCssName + "{";
        transformContainerCss += "display:flex;flex-wrap:nowrap;position: relative;transition-property:transform;";
        transformContainerCss += "}";
        transformContainerCss += "." + HtmlSettings.TransformPagesClassName + " ." + HtmlSettings.TransformContainerCssName + ".slide{";
        transformContainerCss += "transition-property:transform;";
        transformContainerCss += "}";
        const columnRuleWidth = 1;
        transformContainerCss += "." + HtmlSettings.TransformPagesClassName + " ." + HtmlSettings.FileContentContainerClassName + "{";
        transformContainerCss += `flex-shrink: 0;padding-inline-end:calc(var(${ViewportCssVariableNames.ContentColumnGap}) / 2 - ${columnRuleWidth}px);margin-inline-end:calc(var(${ViewportCssVariableNames.ContentColumnGap}) / 2);`;
        transformContainerCss += `border-right: ${columnRuleWidth}px solid var(${Theme.ColumnRuleColor});transition-property: transform;`;
        transformContainerCss += "}";
        transformContainerCss += "." + HtmlSettings.TransformPagesClassName + " ." + HtmlSettings.FileContentContainerClassName + ":last-child{";
        transformContainerCss += `border-right:none;`;
        transformContainerCss += "}";

        transformContainerCss += "." + HtmlSettings.TransformPagesClassName + " ." + HtmlSettings.ContentsShadowContainerCssName + "{";
        transformContainerCss += `overflow:hidden;margin:0 ${(this.htmlOptions.contentsShadowMargin ?? 20)}px`;
        transformContainerCss += "}";

        transformContainerCss += "." + HtmlSettings.TransformContainerCssName + "{";
        transformContainerCss += "}";

        return { contentsContainer, transformContainer, contentsContainerCss, transformContainerCss, contentContainerCss };
    }
}
