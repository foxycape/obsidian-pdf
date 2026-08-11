/** Mark category */
export type MarkType = "drawline" | "note" | "bookmark" | (string & {});

/** Drawline visual style */
export type MarkStyleName =
    | "mark_pen"
    | "wavy_line"
    | "underline_straight"
    | (string & {});

/** Query options for listing marks */
export type QueryMarkOptions = {
    pageNumber?: number;
    types?: MarkType[];
    keyword?: string;
};

/** Style metadata for toolbar / UI */
export type MarkStyle = {
    markType: MarkType;
    styleName: MarkStyleName;
    /** CSS text injected for this style */
    classValue: string;
    /** Color shown on toolbar buttons */
    displayColor: string;
    /** Default draw color */
    defaultColor: string;
    displayTextKey: string;
    defaultDisplayText: string;
    order: number;
};

export type CreateMarkOptions = {
    type: MarkType;
    text: string;
    /** Selection range (text-based marks) */
    target: Range;
    styleName: MarkStyleName;
    customColor?: string;
};

export type FindMarkTarget = {
    element?: Element;
    offsetX?: number;
    offsetY?: number;
    pageNumber?: number;
};
