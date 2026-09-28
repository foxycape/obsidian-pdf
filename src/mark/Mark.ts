import { getRandomId } from "@foxycape/core/kernal/common/uuid";
import type {
    ContentRange,
    FixedContentRange,
    ReflowableContentRange,
} from "@foxycape/core/kernal/ContentRange";
import type { MarkStyleName, MarkType } from "./types";

/** User-authored note attached to a mark. */
export type Note = {
    id: string;
    content: string;
    createdAt: number;
    updatedAt: number;
};

export type UpsertNoteInput = {
    id?: string;
    content: string;
};

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
    /**
     * Source-text range when {@link contentRange} is on a translation `<mt>`.
     * Used to restore / goto after full-text translation is turned off.
     */
    fallbackContentRange?: ContentRange;
    /** Convenience page for fixed-layout marks; omit for reflowable / media */
    pageNumber?: number;
    /** Convenience spine/document URL for reflowable marks; omit for fixed / media */
    url?: string;
    /** The image url in chapter document(e.g. SVG image url or HTML image url) or full image url(eg. data:image/jpeg;base64,... or https://...) */
    imageUrl?: string;
    /** 150x150 JPEG data URL for list / personal-center preview */
    thumbnail?: string;
    /** OPFS path of the persisted full-size collected image */
    filePath?: string;
    /** Document-wide progress (0~1) computed from the mark's content range */
    progress?: number;
    /** Chapter / TOC entry URL */
    navUrl?: string;
    /** Chapter / TOC entry title */
    navTitle?: string;
    /** PDF in-document destination, typically `[{"num":3,"gen":0},{"name":"XYZ"},68,440,0]` */
    pdfDest?: string;
    /** User-authored notes attached to this mark */
    notes?: Note[];
    createdAt: number;
    updatedAt: number;
};

export const getNotes = (mark: Pick<Mark, "notes">): Note[] => mark.notes ?? [];

export const getLatestNote = (mark: Pick<Mark, "notes">): Note | undefined => {
    const notes = getNotes(mark);
    if (notes.length === 0) {
        return undefined;
    }
    return notes.reduce((latest, note) =>
        note.updatedAt > latest.updatedAt ? note : latest,
    );
};

export const upsertNote = (mark: Mark, input: UpsertNoteInput): Note => {
    const now = Date.now();
    if (input.id) {
        const existing = mark.notes?.find((note) => note.id === input.id);
        if (existing) {
            existing.content = input.content;
            existing.updatedAt = now;
            return existing;
        }
    }
    const note: Note = {
        id: input.id || getRandomId(),
        content: input.content,
        createdAt: now,
        updatedAt: now,
    };
    if (!mark.notes) {
        mark.notes = [];
    }
    mark.notes.push(note);
    return note;
};

export const removeNote = (mark: Mark, noteId: string): void => {
    if (!mark.notes) {
        return;
    }
    mark.notes = mark.notes.filter((note) => note.id !== noteId);
    if (mark.notes.length === 0) {
        delete mark.notes;
    }
};

export const markMatchesKeyword = (
    mark: Pick<Mark, "text" | "notes">,
    keyword: string,
): boolean => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) {
        return true;
    }
    if ((mark.text ?? "").toLowerCase().includes(needle)) {
        return true;
    }
    return getNotes(mark).some((note) => note.content.toLowerCase().includes(needle));
};

export const buildMark = (
    resourceId: string,
    type: MarkType,
    text: string,
    styleName: MarkStyleName,
    contentRange: ContentRange,
    markId: string,
    customColor?: string,
    url?: string,
): Mark => {
    const now = Date.now();
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
        url,
        createdAt: now,
        updatedAt: now,
    };
};

export const getFixedContentRange = (mark: Mark): FixedContentRange | undefined => {
    const range = mark.contentRange as ContentRange | undefined;
    if (!range) {
        return undefined;
    }
    if (range.kind === "fixed") {
        return range;
    }
    const geometries = (range as { geometries?: FixedContentRange["geometries"] }).geometries;
    if (Array.isArray(geometries) && geometries.length > 0) {
        return { kind: "fixed", geometries };
    }
    return undefined;
};

/**
 * Resolve a mark-query url to a page number.
 * Pure digits ("3") and PDF spine urls ("3.pdf") map to pageNumber for old Dexie rows.
 */
export const parseMarkQueryPageNumber = (url: string): number | undefined => {
    const trimmed = url.trim();
    if (/^\d+$/.test(trimmed)) {
        return Number.parseInt(trimmed, 10);
    }
    const spine = /^(\d+)\.pdf$/i.exec(trimmed);
    if (spine) {
        return Number.parseInt(spine[1], 10);
    }
    return undefined;
};

export const markMatchesPageNumber = (mark: Mark, pageNumber: number): boolean =>
    mark.pageNumber === pageNumber ||
    (getFixedContentRange(mark)?.geometries.some((g) => g.pageNumber === pageNumber) ?? false);

export const getReflowableContentRange = (
    mark: Pick<Mark, "contentRange">,
): ReflowableContentRange | undefined =>
    mark.contentRange.kind === "reflowable" ? mark.contentRange : undefined;

export const getReflowableFallbackContentRange = (
    mark: Pick<Mark, "fallbackContentRange">,
): ReflowableContentRange | undefined =>
    mark.fallbackContentRange?.kind === "reflowable" ? mark.fallbackContentRange : undefined;
