import { FileLocation, GotoPercentegeOptions, ICoreNavigator, IDocumentsProvider, ILogger, SpineFile, SymbolType } from "../../../../kernal";
import { HtmlOptions } from "../../HtmlOptions";

export class HtmlCoreNavigator implements ICoreNavigator {
    protected logger: ILogger;
    constructor(public readonly documentsProvider: IDocumentsProvider,private readonly options: HtmlOptions) {
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
        const documentWithPercentage = await this.recoverCurrentPercentage(percentage, options?.percentageSymbolType ?? 'custom');
        const location = new FileLocation(documentWithPercentage.url, 1, 'ratio');
        location.current = documentWithPercentage.current;
        if (options?.percentageSymbolType) {
            location.symbolType = options.percentageSymbolType;
        }
        if (location.current != undefined && location.current == 0 && this.options.flipMode == "page") {
            const doc = this.documentsProvider.getDocument(location.url);
            const documents = this.documentsProvider.getDocuments();
            const index = documents.indexOf(doc);
            if (index == 0) {
                location.current = 1;
            }
        }
        location.storeCurrent = true;
        location.from = 'drag'
        await this.goto(location);
    }

    protected async recoverCurrentPercentage(totalCurrent: number, symbolType: SymbolType): Promise<{ url: string, current: number }> {
        const spineFiles = await this.documentsProvider.fileParser.getSpineFiles();
        if (totalCurrent == 1) {
            return { url: spineFiles[spineFiles.length - 1].url, current: 1 };
        }
        if (totalCurrent == 0) {
            return { url: spineFiles[0].url, current: 0 };
        }

        const useCustom = (spineFile: SpineFile) => symbolType == 'custom' || spineFile.charRatio == 0;
        const spineFile = spineFiles.find(f => (useCustom(f) ? f.endProgress : f.charEndProgress) >= totalCurrent)
            ?? spineFiles[spineFiles.length - 1];

        const startProgress = useCustom(spineFile) ? spineFile.startProgress : spineFile.charStartProgress;
        const ratio = useCustom(spineFile) ? spineFile.ratio : spineFile.charRatio;
        const leftProgress = totalCurrent - startProgress;
        let documentTotalCurrent = 0;
        if (ratio > 0) {
            documentTotalCurrent = leftProgress / ratio;
        }

        return { url: spineFile?.url ?? "", current: documentTotalCurrent };
    }
}
