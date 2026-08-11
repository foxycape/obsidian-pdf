import { describe, expect, it } from "vitest";
import { mergeClientRects, type PdfClientRect } from "../mediaTypes/pdf/shared/geometry/textRects";
import {
    getPageLayoutRef,
    scaleGeometryCoords,
} from "../mediaTypes/pdf/shared/geometry/selectionToFixedContentRange";

const rect = (x: number, y: number, width: number, height: number): PdfClientRect => ({
    x,
    y,
    width,
    height,
    endX: x + width,
    endY: y + height,
});

describe("scaleGeometryCoords", () => {
    it("scales rect by current display size", () => {
        const scaled = scaleGeometryCoords(
            {
                pageNumber: 1,
                width: 100,
                height: 200,
                shape: "rect",
                coords: [10, 20, 30, 40],
            },
            200,
            400,
        );
        expect(scaled).toEqual({ x: 20, y: 40, width: 60, height: 80 });
    });
});

describe("getPageLayoutRef", () => {
    it("subtracts border via clientLeft/clientTop", () => {
        const pageEl = {
            clientWidth: 600,
            clientHeight: 800,
            clientLeft: 9,
            clientTop: 9,
            getBoundingClientRect: () => ({
                left: 100,
                top: 50,
                width: 618,
                height: 818,
                right: 718,
                bottom: 868,
                x: 100,
                y: 50,
                toJSON: () => ({}),
            }),
        } as unknown as HTMLElement;

        expect(getPageLayoutRef(pageEl)).toEqual({
            width: 600,
            height: 800,
            contentLeft: 109,
            contentTop: 59,
        });
    });
});

describe("mergeClientRects", () => {
    it("merges a horizontal line of glyphs into one box", () => {
        const merged = mergeClientRects([
            rect(10, 20, 12, 16),
            rect(22, 21, 11, 15),
            rect(34, 20, 13, 16),
        ]);
        expect(merged).toHaveLength(1);
        expect(merged[0].x).toBe(10);
        expect(merged[0].endX).toBe(47);
        expect(merged[0].height).toBeLessThanOrEqual(16);
    });

    it("keeps separate boxes for two horizontal lines", () => {
        const merged = mergeClientRects([
            rect(10, 20, 12, 16),
            rect(22, 20, 12, 16),
            rect(10, 50, 12, 16),
            rect(22, 50, 12, 16),
        ]);
        expect(merged).toHaveLength(2);
        expect(merged[0].y).toBeLessThan(merged[1].y);
    });

    it("merges near-square glyphs on one horizontal line", () => {
        const merged = mergeClientRects([
            rect(10, 20, 14, 14),
            rect(26, 20, 14, 14),
            rect(42, 21, 14, 13),
        ]);
        expect(merged).toHaveLength(1);
        expect(merged[0].width).toBeGreaterThan(40);
    });

    it("merges a vertical column in document order", () => {
        const merged = mergeClientRects([
            rect(100, 10, 14, 16),
            rect(101, 28, 13, 16),
            rect(100, 46, 14, 16),
        ]);
        expect(merged).toHaveLength(1);
        expect(merged[0].height).toBeGreaterThan(40);
        expect(merged[0].width).toBeLessThanOrEqual(14);
    });

    it("keeps two vertical columns when given column-major order", () => {
        // Document order: finish column A, then column B (not y-then-x interleaved).
        const merged = mergeClientRects([
            rect(10, 10, 14, 16),
            rect(10, 28, 14, 16),
            rect(10, 46, 14, 16),
            rect(40, 10, 14, 16),
            rect(40, 28, 14, 16),
            rect(40, 46, 14, 16),
        ]);
        expect(merged).toHaveLength(2);
        expect(merged[0].x).toBeLessThan(merged[1].x);
    });

    it("keeps three horizontal line boxes (real PDF selection sample)", () => {
        // Line1, near-duplicate Line2 pair, Line3 — must not collapse into one vertical bar.
        const merged = mergeClientRects([
            rect(333.7417297363281, 217.55340576171875, 225.15621948242188, 24),
            rect(362.06695556640625, 251.826416015625, 638.5595092773438, 22),
            rect(363.06695556640625, 251.826416015625, 636.734375, 22),
            rect(333.7417297363281, 276.33856201171875, 59.5625, 21),
        ]);
        expect(merged).toHaveLength(3);
        expect(merged[0].y).toBeCloseTo(217.55, 0);
        expect(merged[1].y).toBeCloseTo(251.83, 0);
        expect(merged[2].y).toBeCloseTo(276.34, 0);
        expect(merged[1].width).toBeGreaterThan(630);
    });

    it("merges multi-span lines when near-duplicate rects have 1px y drift", () => {
        // Real selection: 3 visual lines; line2 has paired spans (h=17/16) plus punctuation.
        // Near-duplicates must not lock alignType to vertical and shatter the line.
        const merged = mergeClientRects([
            rect(1013.77001953125, 545.296630859375, 13.484375, 24),
            rect(1034.9566650390625, 549.296630859375, 90, 17),
            rect(1034.9566650390625, 549.296630859375, 90, 17),
            rect(1118.8616943359375, 555.296630859375, 9.09375, 11),
            rect(1119.8616943359375, 555.296630859375, 8.09375, 11),
            rect(1136.84326171875, 549.296630859375, 144, 17),
            rect(1136.84326171875, 549.296630859375, 144, 17),
            rect(1274.9266357421875, 555.296630859375, 9.09375, 11),
            rect(1275.9266357421875, 555.296630859375, 8.09375, 11),
            rect(1293.070068359375, 549.296630859375, 108, 17),
            rect(1293.070068359375, 549.296630859375, 108, 17),
            rect(981.4249877929688, 574.5250244140625, 85.00006103515625, 17),
            rect(981.4249877929688, 575.5250244140625, 85.00006103515625, 16),
            rect(1064.5516357421875, 580.5250244140625, 8.09375, 11),
            rect(1064.5516357421875, 580.5250244140625, 8.09375, 11),
            rect(1081.04833984375, 574.5250244140625, 198, 17),
            rect(1081.04833984375, 575.5250244140625, 198, 16),
            rect(1264.28173828125, 580.5250244140625, 8.09375, 11),
            rect(1264.28173828125, 580.5250244140625, 8.09375, 11),
            rect(1280.7783203125, 574.5250244140625, 68, 17),
            rect(1280.7783203125, 575.5250244140625, 68, 16),
            rect(1347.4083251953125, 580.5250244140625, 8.09375, 11),
            rect(1347.4083251953125, 580.5250244140625, 8.09375, 11),
            rect(1364.228271484375, 574.5250244140625, 36, 17),
            rect(1364.228271484375, 575.5250244140625, 36, 16),
            rect(981.4249877929688, 600.7550048828125, 90.00006103515625, 16),
        ]);
        expect(merged).toHaveLength(3);
        expect(merged[0].width).toBeGreaterThan(380);
        expect(merged[1].width).toBeGreaterThan(400);
        expect(merged[1].y).toBeGreaterThan(merged[0].endY - 1);
        expect(merged[2].y).toBeGreaterThan(merged[1].endY - 1);
        expect(merged[2].width).toBeCloseTo(90, 0);
    });
});
