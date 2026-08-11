import { FileLocation, GotoPercentegeOptions, ICoreNavigator, ILogger, IDocumentsProvider } from "../../../kernal";
import { IPdfDocument } from "./IPdfDocument";
import { IPdfFileParser } from "../fileParser/IPdfFileParser";

export class PdfCoreNavigator implements ICoreNavigator {
    constructor(public readonly documentsProvider: IDocumentsProvider<IPdfDocument, IPdfFileParser>) {
        
    }

    async goto(location: FileLocation): Promise<void> {
        await this.documentsProvider.load(location);
    }
    async gotoUrl(url: string): Promise<void> {
        const location = new FileLocation(url, 1, 'ratio');
        location.storeCurrent = true;
        await this.goto(location);
    }

    async gotoPercentage(percentage: number, options?: GotoPercentegeOptions): Promise<void> {
        const location = new FileLocation(undefined, 1, 'ratio');
        location.current = percentage;
        location.storeCurrent = true
        location.symbolType = options?.percentageSymbolType ?? 'custom';
        location.from = 'drag'
        await this.goto(location);
    }
}
