import type { WritingMode } from "../../../../kernal";

export type IPdfSelection = {
    getText(range: Range): string;
    getRects(range: Range): CustomRect[];
};

export type CustomRect = {
    height: number;
    width: number;
    x: number;
    y: number;
    endX?: number;
    endY?: number;
    isVertical?: boolean;
    alignType?: AlignType;
    order?: number;
    text?: string;
    relatedRects?: CustomRect[];
    writingMode?: WritingMode;
    isPartial?: boolean;
};

export type AlignType = "vertical" | "horizontal" | "unknown";
