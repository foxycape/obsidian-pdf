import { TextFormatOptions, SpineFile } from "../../../kernal";
import { computeUniqueId } from "../../../kernal/common/uuid";
import { ITextDocument } from "../../../kernal/ITextDocument";
import { getPageText } from "../shared/text/pageText";
import { IPdfFileParser } from "./IPdfFileParser";

export class PdfTextDocument implements ITextDocument {

    private readonly fileParser: IPdfFileParser;
    private readonly spineFile: SpineFile;
    constructor(fileParser: IPdfFileParser, spineFile: SpineFile) {
        this.fileParser = fileParser;
        this.spineFile = spineFile;
    }

    get url(): string {
        return this.spineFile.url;
    }
    private texts = new Map<string, string>();
    async getPlaintext(options?: TextFormatOptions): Promise<string> {
        const key = computeUniqueId(JSON.stringify(options ?? {}));
        if (this.texts.has(key)) {
            return this.texts.get(key);
        }
        const doc = await this.fileParser.getPdfDocument(this.spineFile)
        if (this.fileParser.isMultiFiles) {
            //Only support the case where the PDF is split into one file per page
            const page = await doc.getPage(1);
            const text = await getPageText(page, options);
            this.texts.set(key, text);
            return text;
        }
        else {
            const pageNumber = parseInt(this.spineFile.url)
            const page = await doc.getPage(pageNumber);
            const text = await getPageText(page, options);
            this.texts.set(key, text);
            return text;
        }
    }

    async dispose(): Promise<void> {
        if (this.texts) {
            this.texts.clear();
        }
    }
}