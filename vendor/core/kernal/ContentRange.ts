import type { SymbolType } from "./types";

/** Content range format kind */
export type ContentRangeKind = "reflowable" | "fixed" | "media";

/** Geometry shape: rect - rectangle, circ - circle, poly - polygon */
export type ContentShape = "rect" | "circ" | "poly";

/** Document-wide text offset range (reflowable text) */
export type TextOffsetRange = {
    /** Start text offset within the whole document */
    startTextOffset: number;
    /** End text offset within the whole document */
    endTextOffset: number;
    /** Symbol calculation mode */
    symbolType?: SymbolType;
};

/**
 * Fixed-layout visual geometry (one entry per page; multi-page marks use multiple entries).
 * `coords` are relative to the page's visual width/height at annotation time;
 * restore by scaling to the current display size (platform/zoom independent):
 * currentX = coords.x / width * currentPageDisplayWidth
 */
export type ContentGeometry = {
    /** Page number */
    pageNumber: number;
    /** Page visual width at annotation time (horizontal reference for coords) */
    width: number;
    /** Page visual height at annotation time (vertical reference for coords) */
    height: number;
    /** Shape */
    shape: ContentShape;
    /** Coordinate list: rect - x,y,w,h; circ - x,y,radius; poly - x,y,x1,y1,x2,y2,... */
    coords: number[];
};

/**
 * Reflowable anchor: locate by tag name + relative text offset
 */
export type ReflowableAnchor = {
    /** Tag name */
    tagName: string;
    /** Index among tags with the same name in the whole document */
    tagIndex: number;
    /** Text offset relative to the tag */
    textOffset: number;
};

/**
 * Media anchor: locate by time (seconds)
 */
export type MediaAnchor = {
    /** Time point in seconds */
    time: number;
    /** Track id (for multi-track media) */
    trackId?: string;
};

/** Reflowable content range */
export type ReflowableContentRange = {
    kind: "reflowable";
    start: ReflowableAnchor;
    end: ReflowableAnchor;
    /** Document-wide text offset range */
    textOffset?: TextOffsetRange;
};

/**
 * Fixed-layout content range.
 * Single page: geometries length is 1; multi-page: one ContentGeometry per page.
 * No start/end anchors; position is expressed entirely by visual geometry.
 */
export type FixedContentRange = {
    kind: "fixed";
    /** Single-page or multi-page geometry */
    geometries: ContentGeometry[];
};

/** Media content range */
export type MediaContentRange = {
    kind: "media";
    start: MediaAnchor;
    end: MediaAnchor;
};

/**
 * Content position range
 */
export type ContentRange =
    | ReflowableContentRange
    | FixedContentRange
    | MediaContentRange;

export const isFixedContentRange = (
    range: ContentRange,
): range is FixedContentRange => range.kind === "fixed";

export const isReflowableContentRange = (
    range: ContentRange,
): range is ReflowableContentRange => range.kind === "reflowable";

export const isMediaContentRange = (
    range: ContentRange,
): range is MediaContentRange => range.kind === "media";
