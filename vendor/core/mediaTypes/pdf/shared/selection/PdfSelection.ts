import {
    BrowserCapabilities,
    type IRenderer,
} from "../../../../kernal";
import { isNullOrWhiteSpace, removeCJCharWhitespace } from "../../../../kernal/common/text";
import { mergeClientRectsToLines } from "../geometry/textRects";
import type { CustomRect, IPdfSelection } from "./IPdfSelection";
import { checkIsCrossPage } from "../range";

/** PDF text layer DOM kind: custom SVG `<text>` or pdf.js `.textLayer span`. */
type PdfTextLayerKind = "svg" | "span" | "unknown";

type Bounds = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export class PdfSelection implements IPdfSelection {
    private readonly ranges: Range[] = [];

    constructor(_renderer: IRenderer) {
        // renderer kept for API compatibility with call sites
    }

    getText(range: Range) {
        if (!range) {
            return "";
        }
        const isCrossPage = checkIsCrossPage(range);
        // Cross-page / coarse touch selections: skip geometry reconstruction.
        if (isCrossPage || BrowserCapabilities.isSupportTouch()) {
            return removeCJCharWhitespace(range.toString());
        }
        if (this.ranges.includes(range)) {
            return (range as Range & { computedText?: string }).computedText ?? "";
        }

        const rects = this.getRects(range);
        let text = "";
        try {
            if (rects.some((x) => x.isVertical)) {
                text = removeCJCharWhitespace(range.toString());
                return text;
            }
            text = this.joinLinesAsParagraphs(rects);
            text = removeCJCharWhitespace(text).replace(/\n+$/g, "");
            if (isNullOrWhiteSpace(text)) {
                text = removeCJCharWhitespace(range.toString());
            }
            return text;
        } finally {
            (range as Range & { computedText?: string }).computedText = text;
            this.ranges.unshift(range);
            if (this.ranges.length > 10) {
                this.ranges.splice(10);
            }
        }
    }

    private englishPunctuations = /[ !"'@#$%^&*()\-+=;:<>?,.~`/|\]\[}{]/;
    private latinCharaters = /[\u0000-\u00FF]/;

    /** 句末标点（一句话结束） */
    private sentenceEndPunctuations = ["。", "！", "？", "…", "；", "：", ".", "!", "?", ";"];
    /** 其他行末标点 */
    private otherEndPunctuations = ["，", "、", ",", ":", "）", ")", "》", "」", "』", "]", "】"];

    /**
     * Join visual lines. Base: original alignment heuristic;
     * refine with punctuation + distance to the selection union bbox.
     */
    private joinLinesAsParagraphs(lines: CustomRect[]): string {
        if (lines.length === 0) {
            return "";
        }
        const normalized = lines.map((line) => ({
            ...line,
            endX: line.endX ?? line.x + line.width,
            endY: line.endY ?? line.y + line.height,
            text: line.text ?? "",
        }));
        if (normalized.length === 1) {
            return normalized[0].text;
        }

        // 所有文本行的外接矩形，作为左右空隙的参照
        const maxRect = this.calcMaxRect(normalized);
        let out = normalized[0].text;
        for (let i = 1; i < normalized.length; i++) {
            const prev = normalized[i - 1];
            const next = normalized[i];
            const allowAppend = this.checkAllowAppendToHorizontal(prev, next, maxRect);
            if (!allowAppend) {
                out = out.trimEnd() + "\n" + next.text;
                continue;
            }
            if (this.checkRequireWhiteSpace(prev.text) && !/\s$/.test(out)) {
                out += " ";
            }
            out += next.text;
        }
        return out;
    }

    private calcMaxRect(rects: CustomRect[]): CustomRect {
        const x = Math.min(...rects.map((r) => r.x));
        const y = Math.min(...rects.map((r) => r.y));
        const endX = Math.max(...rects.map((r) => r.endX ?? r.x + r.width));
        const endY = Math.max(...rects.map((r) => r.endY ?? r.y + r.height));
        return { x, y, endX, endY, width: endX - x, height: endY - y };
    }

    private getLineEndKind(text?: string): "sentence" | "other" | "none" {
        const trimmed = (text ?? "").trimEnd();
        if (!trimmed) {
            return "none";
        }
        const ch = trimmed[trimmed.length - 1];
        if (this.sentenceEndPunctuations.includes(ch)) {
            return "sentence";
        }
        if (this.otherEndPunctuations.includes(ch)) {
            return "other";
        }
        return "none";
    }

    /**
     * 是否应软换行拼接（true=不换行，false=换段）。
     * 先按标点分类，再结合相对外接矩形的 rightGap / leftGap，最后回退到原对齐启发式。
     */
    private checkAllowAppendToHorizontal(
        previousRect: CustomRect,
        currentRect: CustomRect,
        groupMaxRect: CustomRect,
    ): boolean {
        const prevEndX = previousRect.endX ?? previousRect.x + previousRect.width;
        const currEndX = currentRect.endX ?? currentRect.x + currentRect.width;
        const boxLeft = groupMaxRect.x;
        const boxRight = groupMaxRect.endX ?? groupMaxRect.x + groupMaxRect.width;
        const rightGap = Math.max(0, boxRight - prevEndX);
        const leftGap = Math.max(0, currentRect.x - boxLeft);

        const previousCharSize =
            previousRect.width / Math.max((previousRect.text ?? "").length, 1);
        const currentCharSize =
            currentRect.width / Math.max((currentRect.text ?? "").length, 1);
        const charSize = Math.max(
            Math.min(previousCharSize, currentCharSize),
            1,
        );

        const endKind = this.getLineEndKind(previousRect.text);
        // 相对外接矩形：右侧空隙约 ≥3 字宽视为短行；左侧 ≥1.5 字宽视为缩进
        const rightEmpty = rightGap > charSize * 3;
        const leftIndented = leftGap > charSize * 1.5;

        // 1) 有标点
        if (endKind === "sentence") {
            // 句末：右侧空或左侧缩进 → 换段；两侧都贴边 → 段内软换行
            if (rightEmpty || leftIndented) {
                return false;
            }
            return true;
        }
        if (endKind === "other") {
            // 其他标点：默认未结束；仅当短行+缩进都明显时换段
            if (rightEmpty && leftIndented) {
                return false;
            }
            return true;
        }

        // 2) 无标点：很可能没说完，默认软换行；短行+缩进才换段
        if (rightEmpty && leftIndented) {
            return false;
        }

        // 回退：原对齐启发式（处理居中/缩进/同宽多行等）
        return this.checkAlignmentAllowsAppend(
            previousRect,
            currentRect,
            prevEndX,
            currEndX,
            previousCharSize,
            currentCharSize,
        );
    }

    /** 原 PdfTextAssistant 对齐启发式（true=继续拼接） */
    private checkAlignmentAllowsAppend(
        previousRect: CustomRect,
        currentRect: CustomRect,
        prevEndX: number,
        currEndX: number,
        previousCharSize: number,
        currentCharSize: number,
    ): boolean {
        const leftDiff = Math.abs(previousRect.x - currentRect.x);
        const rightDiff = Math.abs(prevEndX - currEndX);
        const widthDiff = Math.abs(previousRect.width - currentRect.width);

        if (widthDiff < previousCharSize && widthDiff < currentCharSize) {
            return true;
        }
        if (
            Math.abs(rightDiff - leftDiff) < previousCharSize &&
            Math.abs(rightDiff - leftDiff) < currentCharSize
        ) {
            return false;
        }

        if (leftDiff < previousCharSize && leftDiff < currentCharSize) {
            if (prevEndX < currEndX) {
                const heightOverlayPercentage =
                    previousRect.height / (currentRect.height || 1);
                const widthOverlayPercentage =
                    previousRect.width / (currentRect.width || 1);
                if (
                    heightOverlayPercentage >= 0.95 &&
                    heightOverlayPercentage <= 1.05 &&
                    widthOverlayPercentage >= 0.7 &&
                    widthOverlayPercentage <= 1.3
                ) {
                    return true;
                }
                return false;
            }
            return true;
        }

        if (leftDiff > currentCharSize * 1.5) {
            if (previousRect.x < currentRect.x) {
                if (previousRect.width >= currentRect.width) {
                    return true;
                }
                return false;
            }
            const widthOverlayPercentage =
                previousRect.width > currentRect.width
                    ? currentRect.width / (previousRect.width || 1)
                    : previousRect.width / (currentRect.width || 1);
            if (widthOverlayPercentage >= 0.7) {
                return true;
            }
            if (widthOverlayPercentage < 0.7) {
                return false;
            }
            return true;
        }

        if (rightDiff < previousCharSize && rightDiff < currentCharSize) {
            return true;
        }

        // 无标点时原逻辑倾向继续
        return true;
    }

    private checkRequireWhiteSpace = (firstText?: string) => {
        if (!firstText) {
            return false;
        }
        const endOfFirstTextChar = firstText[firstText.length - 1];
        if (endOfFirstTextChar.match(this.latinCharaters)) {
            if (endOfFirstTextChar.match(this.englishPunctuations)) {
                return false;
            }
            return true;
        }
        return false;
    };

    /** Join text runs on the same visual line (insert space for Latin when needed). */
    private joinItemTexts = (texts: string[]) => {
        let out = "";
        for (const part of texts) {
            if (!part) {
                continue;
            }
            if (
                out &&
                this.checkRequireWhiteSpace(out) &&
                !/\s$/.test(out) &&
                !/^\s/.test(part)
            ) {
                out += " ";
            }
            out += part;
        }
        return out;
    };

    /**
     * Build visual line boxes for a selection (SVG text + pdf.js spans).
     * Geometry merge is shared with mark overlay via {@link mergeClientRectsToLines}.
     */
    getRects(range: Range): CustomRect[] {
        const elements = this.collectLiveTextElementsInRange(range);
        if (elements.length === 0) {
            return [];
        }

        const itemRects: Array<
            CustomRect & { endX: number; endY: number; text: string }
        > = [];
        for (const element of elements) {
            const item = this.createItemRect(range, element);
            if (item) {
                itemRects.push(item);
            }
        }
        if (itemRects.length === 0) {
            return [];
        }

        return mergeClientRectsToLines(itemRects, this.joinItemTexts).map((line) => ({
            x: line.x,
            y: line.y,
            width: line.width,
            height: line.height,
            endX: line.endX,
            endY: line.endY,
            text: line.text,
            isVertical: line.isVertical,
        }));
    }

    /** Plain geometry + selected text for one live text element. */
    private createItemRect(
        range: Range,
        element: Element,
    ): (CustomRect & { endX: number; endY: number; text: string }) | null {
        const selectedText = this.getTextIntersection(range, element);
        if (!selectedText) {
            return null;
        }
        const fullText = element.textContent ?? "";
        const isPartial = selectedText !== fullText;
        const bounds =
            (isPartial ? this.measureIntersectionBounds(range, element) : null) ??
            this.toBounds(element.getBoundingClientRect());
        if (bounds.width <= 0.5 || bounds.height <= 0.5) {
            return null;
        }
        return {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            endX: bounds.x + bounds.width,
            endY: bounds.y + bounds.height,
            text: selectedText,
            isPartial,
        };
    }

    private toBounds(rect: DOMRect): Bounds {
        return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
        };
    }

    /** Union of client rects for the selection ∩ element contents. */
    private measureIntersectionBounds(
        range: Range,
        element: Element,
    ): Bounds | null {
        try {
            const inter = this.createIntersectionRange(range, element);
            if (!inter) {
                return null;
            }
            const rects = Array.from(inter.getClientRects()).filter(
                (r) => r.width > 0.5 && r.height > 0.5,
            );
            if (rects.length === 0) {
                const box = inter.getBoundingClientRect();
                if (box.width <= 0.5 || box.height <= 0.5) {
                    return null;
                }
                return this.toBounds(box);
            }
            const x = Math.min(...rects.map((r) => r.x));
            const y = Math.min(...rects.map((r) => r.y));
            const endX = Math.max(...rects.map((r) => r.x + r.width));
            const endY = Math.max(...rects.map((r) => r.y + r.height));
            return { x, y, width: endX - x, height: endY - y };
        } catch {
            return null;
        }
    }

    private createIntersectionRange(
        range: Range,
        element: Element,
    ): Range | null {
        try {
            const elementRange = element.ownerDocument!.createRange();
            elementRange.selectNodeContents(element);
            const inter = range.cloneRange();
            if (inter.compareBoundaryPoints(Range.START_TO_START, elementRange) < 0) {
                inter.setStart(elementRange.startContainer, elementRange.startOffset);
            }
            if (inter.compareBoundaryPoints(Range.END_TO_END, elementRange) > 0) {
                inter.setEnd(elementRange.endContainer, elementRange.endOffset);
            }
            return inter;
        } catch {
            return null;
        }
    }

    private resolveTextLayerKind(range: Range): PdfTextLayerKind {
        const node = range.startContainer;
        const el =
            node.nodeType === Node.TEXT_NODE
                ? node.parentElement
                : (node as Element | null);
        if (!el) {
            return "unknown";
        }
        if (el.closest("svg.custom-text-layer")) {
            return "svg";
        }
        if (el.closest(".textLayer")) {
            return "span";
        }
        const page = el.closest(".page");
        if (page?.querySelector("svg.custom-text-layer text")) {
            return "svg";
        }
        if (page?.querySelector(".textLayer span")) {
            return "span";
        }
        return "unknown";
    }

    private collectPageTextCandidates(
        page: Element,
        kind: PdfTextLayerKind,
    ): Element[] {
        if (kind === "svg") {
            return Array.from(page.querySelectorAll("svg.custom-text-layer text"));
        }
        if (kind === "span") {
            return this.collectTextLayerSpans(page);
        }
        const svgTexts = Array.from(
            page.querySelectorAll("svg.custom-text-layer text"),
        );
        if (svgTexts.length > 0) {
            return svgTexts;
        }
        return this.collectTextLayerSpans(page);
    }

    private collectTextLayerSpans(page: Element): Element[] {
        return Array.from(page.querySelectorAll(".textLayer span")).filter(
            (span) =>
                !span.classList.contains("highlight") &&
                !span.classList.contains("appended") &&
                (span.textContent?.length ?? 0) > 0,
        );
    }

    /**
     * Collect live SVG `<text>` or `.textLayer span` elements intersected by the range.
     * Span mode has no element ids, so we must walk the live DOM instead of cloneContents + getElementById.
     */
    private collectLiveTextElementsInRange(range: Range): Element[] {
        const startEl =
            range.startContainer.nodeType === Node.TEXT_NODE
                ? range.startContainer.parentElement
                : (range.startContainer as Element | null);
        const page = startEl?.closest(".page");
        if (!page) {
            return [];
        }
        const kind = this.resolveTextLayerKind(range);
        const candidates = this.collectPageTextCandidates(page, kind);
        const result: Element[] = [];
        for (const el of candidates) {
            try {
                if (range.intersectsNode(el)) {
                    result.push(el);
                }
            } catch {
                // intersectsNode can throw on detached nodes
            }
        }
        return result;
    }

    /** Selected text within one live text element (partial for first/last). */
    private getTextIntersection(range: Range, element: Element): string {
        const inter = this.createIntersectionRange(range, element);
        if (!inter) {
            return element.textContent ?? "";
        }
        return inter.toString();
    }
}
