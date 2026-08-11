import { injectCssContent } from "../../../../kernal/html/injector";
import { IDocument, IDocumentsProvider, IStyleProvider } from "../../../../kernal";
import { IHtmlDocument } from "../IHtmlDocument";
import { ContentCssVariables } from "./ContentCssVariables";

export class HtmlStyleProvider implements IStyleProvider {
    readonly defaultVariables: Map<string, string> = new Map<string, string>();
    readonly currentVariables: Map<string, string> = new Map<string, string>();
    private readonly contentStyleId = "html-content-css-variables-style";

    constructor(private readonly documentsProvider: IDocumentsProvider<IHtmlDocument>) {
        this.defaultVariables.clear();
        for (const [key, value] of ContentCssVariables.getDefaultVariables()) {
            this.defaultVariables.set(key, value);
        }
    }

    initialize(currentVariables?: Map<string, string>): void {
        this.currentVariables.clear();
        if (currentVariables) {
            for (const [key, value] of currentVariables) {
                this.currentVariables.set(key, value);
            }
        }
    }

    private async getCss(): Promise<string> {
        const { default: contentCss } = await import("./html-content.css?raw");
        return contentCss.toString();
    }

    getDefaultVariables(): Map<string, string> {
        return this.defaultVariables;
    }

    getCurrentVariables(): Map<string, string> {
        return this.currentVariables;
    }

    getDefaultVariableValue(variableName: string): string {
        return this.defaultVariables.get(variableName) ?? "";
    }

    getVariableValue(variableName: string): string {
        return this.currentVariables.get(variableName) ?? this.defaultVariables.get(variableName) ?? "";
    }

    async injectStyles(doc: IDocument): Promise<void> {
        let contentContainer = doc.getContentContainer();
        if (!contentContainer) {
            contentContainer = await (doc as IHtmlDocument).getVirtualContentContainer();
        }
        if (!contentContainer?.ownerDocument) {
            return;
        }
        const ownerDocument = contentContainer.ownerDocument;
        const documentElement = ownerDocument.documentElement;
        for (const [key, value] of this.defaultVariables) {
            if (!this.currentVariables.has(key)) {
                documentElement.style.setProperty(key, value);
            }
        }
        for (const [key, value] of this.currentVariables) {
            documentElement.style.setProperty(key, value);
        }
        const css = await this.getCss();
        injectCssContent(ownerDocument, css, true, this.contentStyleId);
    }

    async changeStyles(variableNameValues: Map<string, string>): Promise<void> {
        for (const [key, value] of variableNameValues) {
            this.currentVariables.set(key, value);
        }
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const document of loadedDocuments) {
            const contentContainer = document.getContentContainer();
            const documentElement = contentContainer?.ownerDocument?.documentElement;
            if (!documentElement) {
                continue;
            }
            for (const [key, value] of variableNameValues) {
                documentElement.style.setProperty(key, value);
            }
        }
    }

    async changeStyle(variableName: string, variableValue: string): Promise<void> {
        this.currentVariables.set(variableName, variableValue);
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const document of loadedDocuments) {
            const contentContainer = document.getContentContainer();
            const documentElement = contentContainer?.ownerDocument?.documentElement;
            if (!documentElement) {
                continue;
            }
            documentElement.style.setProperty(variableName, variableValue);
        }
    }

    async resetStyles(): Promise<void> {
        this.currentVariables.clear();
        const loadedDocuments = this.documentsProvider.getLoadedDocuments();
        for (const document of loadedDocuments) {
            await this.injectStyles(document);
        }
    }

    async dispose(): Promise<void> {
        this.defaultVariables.clear();
        this.currentVariables.clear();
    }
}
