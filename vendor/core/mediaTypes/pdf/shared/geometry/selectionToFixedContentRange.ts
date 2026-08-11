import type { ContentGeometry, FixedContentRange } from "../../../../kernal/ContentRange";
import { getPagedSelectionRects } from "./textRects";

export type PageLayoutRef = {
    /** Page content-box width (clientWidth; excludes border) */
    width: number;
    /** Page content-box height (clientHeight; excludes border) */
    height: number;
    /** Viewport X of content-box origin (border-box left + clientLeft) */
    contentLeft: number;
    /** Viewport Y of content-box origin (border-box top + clientTop) */
    contentTop: number;
};

export type PageLayoutResolver = (pageNumber: number) => PageLayoutRef | undefined;

/**
 * Build layout reference from a page element.
 *
 * Absolute overlays inside `.page` use the padding edge as origin (inside border).
 * Selection client rects are viewport-based, so convert with:
 *   x = rect.x - (pageRect.left + clientLeft)
 * which equals offset from that same padding-edge origin.
 */
export const getPageLayoutRef = (pageEl: HTMLElement): PageLayoutRef | undefined => {
    const pageRect = pageEl.getBoundingClientRect();
    const width = pageEl.clientWidth;
    const height = pageEl.clientHeight;
    if (width <= 0 || height <= 0) {
        return undefined;
    }
    return {
        width,
        height,
        contentLeft: pageRect.left + pageEl.clientLeft,
        contentTop: pageRect.top + pageEl.clientTop,
    };
};

/**
 * Convert a text selection Range into FixedContentRange geometries.
 * Supports multi-page selections; coords are relative to page content box at mark time.
 */
export const selectionToFixedContentRange = (
    range: Range,
    resolveLayout: PageLayoutResolver,
): FixedContentRange | null => {
    const pagedRects = getPagedSelectionRects(range);
    if (pagedRects.length === 0) {
        return null;
    }

    const geometries: ContentGeometry[] = [];
    for (const rect of pagedRects) {
        const layout = resolveLayout(rect.pageNumber);
        if (!layout) {
            continue;
        }
        const x = rect.x - layout.contentLeft;
        const y = rect.y - layout.contentTop;
        geometries.push({
            pageNumber: rect.pageNumber,
            width: layout.width,
            height: layout.height,
            shape: "rect",
            coords: [x, y, rect.width, rect.height],
        });
    }

    if (geometries.length === 0) {
        return null;
    }

    return {
        kind: "fixed",
        geometries,
    };
};

/**
 * Scale a stored geometry rect into current page content-box pixels.
 */
export const scaleGeometryCoords = (
    geometry: ContentGeometry,
    currentWidth: number,
    currentHeight: number,
): { x: number; y: number; width: number; height: number } => {
    const [x = 0, y = 0, w = 0, h = 0] = geometry.coords;
    const sx = geometry.width > 0 ? currentWidth / geometry.width : 1;
    const sy = geometry.height > 0 ? currentHeight / geometry.height : 1;
    return {
        x: x * sx,
        y: y * sy,
        width: w * sx,
        height: h * sy,
    };
};
