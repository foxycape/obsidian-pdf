import { FileLocation, IDocumentsProvider, SpineFile, SymbolType } from "../../../../kernal";
import { HtmlOptions } from "../../HtmlOptions";
import { IHtmlLocationCalculator } from "./IHtmlLocationCalculator";

export class HtmlLocationCalculator implements IHtmlLocationCalculator {
    constructor(public readonly documentsProvider: IDocumentsProvider, private readonly options: HtmlOptions) {
    }

    async getLocation(totalPercentage: number, symbolType: SymbolType): Promise<FileLocation> {
        const { url, current } = await this.recoverCurrentPercentage(totalPercentage, symbolType);
        const location = new FileLocation(url, 1, 'ratio');
        location.current = current;
        return location;
    }

    protected async recoverCurrentPercentage(totalPercentage: number, symbolType: SymbolType): Promise<{ url: string, current: number }> {
        const spineFiles = await this.documentsProvider.fileParser.getSpineFiles();
        if (totalPercentage == 1) {
            return { url: spineFiles[spineFiles.length - 1].url, current: 1 };
        }
        if (totalPercentage == 0) {
            return { url: spineFiles[0].url, current: 0 };
        }

        const useCustom = (spineFile: SpineFile) => symbolType == 'custom' || spineFile.charRatio == 0;
        const spineFile = spineFiles.find(f => (useCustom(f) ? f.endProgress : f.charEndProgress) >= totalPercentage)
            ?? spineFiles[spineFiles.length - 1];

        const startProgress = useCustom(spineFile) ? spineFile.startProgress : spineFile.charStartProgress;
        const ratio = useCustom(spineFile) ? spineFile.ratio : spineFile.charRatio;
        const leftProgress = totalPercentage - startProgress;
        let documentTotalCurrent = 0;
        if (ratio > 0) {
            documentTotalCurrent = leftProgress / ratio;
        }

        return { url: spineFile?.url ?? "", current: documentTotalCurrent };
    }
}