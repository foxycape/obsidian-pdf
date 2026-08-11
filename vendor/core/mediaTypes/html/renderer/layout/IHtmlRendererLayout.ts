import { FlipMode } from "../../../../kernal";
import { IHtmlDocument } from "../IHtmlDocument";

export interface IHtmlRendererLayout {
    /**Apply styles to the renderer and documents */
    applyStyles(): Promise<void>;
    /**Apply styles to a document */
    applyDocStyles(doc:IHtmlDocument): Promise<void>;
    /**Change the flip mode */
    changeFlipMode(flipMode: FlipMode): Promise<void>;
    /**Change the columns */
    changeColumns(columnOptions: ColumnOptions): Promise<void>;
}

export type ColumnOptions = {
    columns: number;
    autoColumns: boolean;
}