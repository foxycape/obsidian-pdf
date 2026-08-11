/**
 * Element range: all - every tag, similar - tags of the same kind
 */
export type ElementRangeType = "all" | "similar";

export class SymbolOffset {
    constructor(public readonly element: Element, public readonly offset: number) {

    }
}

