import { getExtension, getFileName } from "../../../kernal/common/path";
import { isNullOrWhiteSpace } from "../../../kernal/common/text";
import { IDocument, IFileParser, LoadStatus, Reader, SpineFile, TextFormatOptions } from "../../../kernal";

export abstract class BaseDocument implements IDocument {
    private currentUrl: string;
    private currentFileName: string;
    private currentExtension: string;
    private root: string = "";
    protected loadStatus: LoadStatus = "unstart";
    protected wrapperContainer: HTMLElement;
    readonly fileParser: IFileParser;

    /**
     * Constructor
     * @param owner Reader
     * @param fileParser File parser
     * @param wrapperContainer Document container
     * @param file File
     */
    constructor(public readonly owner: Reader, fileParser: IFileParser, wrapperContainer: HTMLElement, file: SpineFile) {
        this.fileParser = fileParser;
        this.wrapperContainer = wrapperContainer;
        this.currentUrl = file.url ?? "";
        this.currentFileName = getFileName(this.currentUrl)
        if (isNullOrWhiteSpace(this.currentUrl))
            this.currentUrl = "";

        const lastSlashPosition = this.currentUrl.lastIndexOf('/');
        if (lastSlashPosition > 0) {
            this.root = this.currentUrl.substring(0, lastSlashPosition + 1);
        }
        this.currentExtension = file.extension;
        if (isNullOrWhiteSpace(this.currentExtension)) {
            this.currentExtension = getExtension(this.currentUrl)
        }
        if (isNullOrWhiteSpace(this.currentExtension)) {
            throw new Error("missing extension")
        }
    }


    get inIframe(): boolean {
        return false;
    }
    get url(): string {
        return this.currentUrl
    }

    get fileName(): string {
        return this.currentFileName
    }
    get extension(): string {
        return this.currentExtension;
    }

    getRoot(): string {
        return this.root;
    }

    protected setLoadStatus(status: LoadStatus): void {
        this.loadStatus = status;
    }

    getLoadStatus(): LoadStatus {
        return this.loadStatus;
    }

    abstract load(): Promise<void>
    abstract getText(options?: TextFormatOptions): Promise<string>

    getWrapperContainer(): HTMLElement {
        return this.wrapperContainer;
    }

    getContentContainer(): HTMLElement {
        return this.wrapperContainer;
    }

    async dispose(): Promise<void> {
        this.setLoadStatus("unstart");
    }
}