import type { ContentRange, FixedContentRange } from "../ContentRange";
import type { MarkStyleName, MarkType } from "./types";

/**
 * Persisted annotation mark.
 * Position is expressed by {@link contentRange} (reflowable / fixed / media).
 */
export type Mark = {
    markId: string;
    resourceId: string;
    type: MarkType;
    text: string;
    styleName: MarkStyleName;
    customColor?: string;
    /** Position source for restore / hit-test; format depends on media type */
    contentRange: ContentRange;
    /** Convenience page for fixed-layout marks; omit for reflowable / media */
    pageNumber?: number;
    createTime: string;
    updateTime: string;
};

export const createMark = (
    resourceId: string,
    type: MarkType,
    text: string,
    styleName: MarkStyleName,
    contentRange: ContentRange,
    markId: string,
    customColor?: string,
): Mark => {
    const now = new Date().toISOString();
    const pageNumber =
        contentRange.kind === "fixed"
            ? contentRange.geometries[0]?.pageNumber
            : undefined;
    return {
        markId,
        resourceId,
        type,
        text,
        styleName,
        customColor,
        contentRange,
        pageNumber,
        createTime: now,
        updateTime: now,
    };
};

export const getFixedContentRange = (mark: Mark): FixedContentRange | undefined =>
    mark.contentRange.kind === "fixed" ? mark.contentRange : undefined;
