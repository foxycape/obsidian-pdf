import type { ContentRange } from "@foxycape/core/kernal/ContentRange"
import type { IDisposable } from "@foxycape/core/kernal/IDisposable"
import type { Mark } from "./Mark"
import type { FindMarkTarget, MarkStyleName } from "./types"

/** Pixel box in overlay-layer coordinates. */
export type HighlightRect = {
    x: number
    y: number
    width: number
    height: number
}

/**
 * Paint request. Not a persisted {@link Mark}.
 * Search / TTS construct this directly; Marker maps from Mark.
 */
export type HighlightItem = {
    id: string
    type: string
    styleName?: MarkStyleName
    customColor?: string
    className?: string
    range?: Range
    ranges?: Range[]
    contentRange?: ContentRange
    fallbackContentRange?: ContentRange
    rects?: HighlightRect[]
    pageNumber?: number
    url?: string
    active?: boolean
}

export type HighlightRelayoutScope = {
    url?: string
    pageNumber?: number
}

export interface IHighlighter extends IDisposable {
    paint(items: HighlightItem[]): void
    remove(ids: string[]): void
    removeByType(types: string[]): void
    removeAll(): void
    getElements(id: string): Element[]
    findAt(target: FindMarkTarget): { id: string; type: string } | undefined
    relayout(scope?: HighlightRelayoutScope): void
}

export const markToHighlightItem = (mark: Mark): HighlightItem => ({
    id: mark.markId,
    type: mark.type,
    styleName: mark.styleName,
    customColor: mark.customColor,
    contentRange: mark.contentRange,
    fallbackContentRange: mark.fallbackContentRange,
    pageNumber: mark.pageNumber,
    url: mark.url,
})
