import type { FixedContentRange } from "@foxycape/core/kernal/ContentRange";
import type { IDisposable } from "@foxycape/core/kernal/IDisposable";
import type { Mark } from "./Mark";
import type {
    CreateMarkOptions,
    FindMarkTarget,
    MarkStyle,
    MarkType,
    QueryMarkOptions,
} from "./types";

export interface IMarker extends IDisposable {
    initialize(): Promise<void>;

    createMark(options: CreateMarkOptions): Promise<Mark | null>;

    restoreMarks(marks: Mark[]): Promise<void>;

    deleteMark(markId: string): Promise<void>;

    deleteMarks(marks: Mark[]): Promise<void>;

    updateMark(markId: string, mark: Mark): Promise<void>;

    getMark(markId: string): Promise<Mark | undefined>;

    getMarks(query?: QueryMarkOptions): Promise<Mark[]>;

    /** Remove overlay DOM only (keep storage) */
    remove(markIds: string[]): Promise<void>;

    removeAll(): Promise<void>;

    getMarkStyles(): Promise<MarkStyle[]>;

    goto(mark: Mark): Promise<void>;

    /** Geometry for a live selection, without creating a mark. */
    captureFixedRange(range: Range): FixedContentRange | undefined;

    /**
     * Jump to a stored selection and flash a temporary highlight.
     * Returns false when the geometry cannot be painted.
     */
    flashFixedRange(contentRange: FixedContentRange): Promise<boolean>;

    /** Fill missing chapter titles from the PDF outline and persist them. */
    ensureNavMeta(marks: Mark[]): Promise<Mark[]>;

    findMark(target: FindMarkTarget): Promise<{ id: string; type: MarkType } | undefined>;

    getDefaultColor(markType: MarkType, styleName?: string): string | undefined;

    /**
     * markId for this selection. Same range and text always return the same id,
     * whether the caller is highlighting, translating, explaining, or looking up.
     */
    resolveSelectionMarkId(range: Range | null, text: string): Promise<string | undefined>;
}
