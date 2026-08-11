import type { IDisposable } from "../IDisposable";
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

    findMark(target: FindMarkTarget): Promise<{ id: string; type: MarkType } | undefined>;

    getDefaultColor(markType: MarkType, styleName?: string): string | undefined;
}
