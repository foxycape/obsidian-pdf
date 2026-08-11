import { PageDirection, SymbolType } from "../types";

export class Progress {
    static readonly Min = 0.0000000001;
    static readonly Max = 0.9999999999;
    /**
     * Constructor
     * @param total Total progress value (page count for fixed-layout files, 1 for reflowable files)
     * @param current Current overall progress (page number for fixed-layout files, 0~1 for reflowable files)
     */
    constructor(public total: number, public current: number) {
        var now = new Date();
        this.createTime = now
        this.updateTime = now;
    }
    /** Creation time */
    createTime: Date;
    /** Modification time, used for data synchronization */
    updateTime: Date;

    /** Current URL */
    location: FileLocation = new FileLocation(undefined, 1, 'ratio');
}
export type ProgressUnit = 'ratio' | 'page' | 'second' | 'symbol'
export class ReadingLocation {
    /**
     * Constructor
     * @param url Current URL or file index
     * @param total Total for the current file (page count for fixed-layout files, 1 for reflowable files)
     * @param unit Progress unit
     */
    constructor(public url: string, public total?: number,public unit?: ProgressUnit) {
        this.total = total || 1;
        this.unit = unit || 'ratio';
    }

    /** Current progress value; unit is determined by `unit` */
    current?: number;

    /** Symbol type used for progress calculation: custom - custom, char - calculated by character */
    symbolType?: SymbolType;

    /** Tag name to jump to in the current file, e.g. p */
    tagName?: string;
    /** Tag index to jump to in the current file */
    tagIndex?: number;
}

export class FileLocation extends ReadingLocation {
    /**
     * Constructor
     * @param url Current URL or file index
     * @param total Total for the current file (page count for fixed-layout files, 1 for reflowable files)
     * @param unit Progress unit
     */
    constructor(public url: string, public total?: number,public unit?: ProgressUnit) {
        super(url, total, unit);
    }

    /** Page-turning direction */
    direction?: PageDirection

    /** Text offset within the jump target tag */
    textOffset?: number;

    /** Whether this is a precise location */
    precise?: boolean;

    /** Whether to store the current progress */
    storeCurrent?: boolean

    /** Partial text at the current position when precisely locating */
    text?: string

    /** Whether scrolling into the viewport is needed */
    scrollIntoViewIfNeeded?: boolean;
    /** Scroll behavior */
    scrollBehavior?: ScrollBehavior

    /** Extra top offset after jumping (negative moves up; relative to the target element's visible position) */
    offsetTop?: number;

    /** PDF in-document jump params; typical destination format (string): [{"num":3,"gen":0},{"name":"XYZ"},68,440,0] */
    pdfDest?: string;

    /** Visually displayed page number (for PDF) */
    visualPage?: number

    /** Whether to ignore the header overlay height (if ignored, header height will not be added automatically) */
    ignoreOverlayHeader?: boolean;

    /** Whether to use an absolute scroll offset */
    useAbsoluteScrollTop?: boolean;

    /** Jump source */
    from?: LocationFrom;

    /** For testing only */
    tagText?: string;

}

export type LocationFrom = 'toc' | 'mark' | 'internal-link' | 'search' | 'drag' | 'wheel' | 'keyboard'|'mouse'|'touch' | (string & {})
