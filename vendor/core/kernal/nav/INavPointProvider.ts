import { IDisposable } from "../IDisposable";
import { SymbolType } from "../types";
import { NavPoint } from "./Nav";

export interface INavPointProvider extends IDisposable {
    /**
     * Get the flattened navigation point collection
     */
    getFlattingNavPoints(): Promise<NavPoint[]>;

    /**
     * Get the navigation point associated with the specified node
     * @param url url of the document
     * @param target Element or progress ratio in the current document
     * @param symbolType type of symbol to use for the navigation point
     */
    getNavPoint(url: string, target: Element | number, symbolType: SymbolType): Promise<NavPoint>

    /**
     * Get the current navigation point
     */
    getCurrentNavPoint(): Promise<NavPoint>
}
