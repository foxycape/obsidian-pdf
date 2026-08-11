import { FileLocation, SymbolType } from "../../../../kernal";

export interface IHtmlLocationCalculator {
    getLocation(totalPercentage: number, symbolType: SymbolType): Promise<FileLocation>;
}