import { IDisposable, SymbolType } from ".";
import { ElementPositionResult } from "./html/position";

export interface ISymbolCalclator extends IDisposable {

    /**
     * get total symbol count of the document
     * @param symbolType 
     */
    getTotalSymbolCount(symbolType: SymbolType): Promise<number>

    /**
     * get progress ratio of the element
     * @param element 
     * @param symbolType 
     * @param internalSymbolOffset 
     */
    getProgressByElement(element: { tagName: string, tagIndex: number } | Element, symbolType: SymbolType,internalSymbolOffset?: number): Promise<number>

    /**
     * get element by progress ratio
     * @param progress The progress ratio (0~1).
     * @param symbolType 
     */
    getElementByProgress(progress: number, symbolType: SymbolType): Promise<ElementPositionResult>

    /**
     * get position of the element symbol count
     * @param element 
     * @param symbolType 
     */
    getPositionByElement(element: { tagName: string, tagIndex: number } | Element, symbolType: SymbolType, internalSymbolOffset?: number): Promise<number>

    /**
     * get element by symbol position
     * @param symbolPosition The symbol position.
     * @param symbolType the symbol type.custom or char
     * @param preferEnd if the position is just at the end of an element, it will also be the start of the next element, true means to prioritize the end element 
     */
    getElementByPosition(symbolPosition: number, symbolType: SymbolType,preferEnd?:boolean): Promise<ElementPositionResult> 
}