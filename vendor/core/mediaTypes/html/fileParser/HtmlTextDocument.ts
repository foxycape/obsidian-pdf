import { convertArrayBufferToString, convertUint8ArrayToString, removeBomHeader } from "../../../kernal/common/encoding";
import { formatText } from "../../../kernal/common/text";
import { getDocumentBody } from "../../../kernal/html/finder";
import { wrapFloatingTextNodes } from "../../../kernal/html/manipulator";
import { getFormatDocumentAsync } from "../../../kernal/html/parser";
import { TextFormatOptions, SpineFile, ElementInitialNumberName } from "../../../kernal";
import { IHtmlTextDocument } from "../renderer/IHtmlTextDocument";
import { getPureTextContent, removeWhiteSpaceBetweenTags } from "../../../kernal/html/text";
import { computeUniqueId } from "../../../kernal/common/uuid";
import { IHtmlFileParser } from "./IHtmlFileParser";

export class HtmlTextDocument implements IHtmlTextDocument {
    private readonly fileParser: IHtmlFileParser;
    private readonly spineFile: SpineFile;
    constructor(fileParser: IHtmlFileParser, spineFile: SpineFile) {
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
        const virtualDocument = await this.getFormattedDocument();
        let text = getPureTextContent(getDocumentBody(virtualDocument), undefined, undefined, options?.convertLFToWhitespace)
        if (options) {
            text = formatText(text, options);
        }
        this.texts.set(key, text);
        return text;
    }

    private docContent: string;
    async getContent(): Promise<string> {
        if (this.docContent) {
            return this.docContent;
        }
        let content = "";
        if (this.spineFile.data) {
            if (this.spineFile.data instanceof ArrayBuffer) {
                content = convertArrayBufferToString(this.spineFile.data);
            }
            else if (this.spineFile.data instanceof Blob) {
                const data = await this.spineFile.data.arrayBuffer()
                content = convertArrayBufferToString(data);
            }
        }
        else {
            const bytes = await this.fileParser.getFile(this.url);
            content = convertUint8ArrayToString(bytes);
        }

        if (this.fileParser.options.removeHtmlWhitespace && this.fileParser.options.whitespaceRegex) {
            // eslint-disable-next-line no-irregular-whitespace
            // 不能替换全角空格，因为存在某些资源是以全角空格来隔开文字的情况
            // content = content.replaceAll(String.fromCharCode(12288), '');
            //替换除空格外的所有不可见字符(不能替换空格，因为空格在行内标签与行内标签之间属于合法字符)
            content = content.replace(this.fileParser.options.whitespaceRegex, '');
            if (this.fileParser.options.forceRemoveHtmlChar32BetweenTags) {
                content = removeWhiteSpaceBetweenTags(content, this.fileParser.options.removeHtmlWhitespace)
            }
        }
        content = removeBomHeader(content ?? "");
        this.docContent = content;
        return content;
    }
    private formattedDocument: Document;
    async getFormattedDocument(): Promise<Document> {
        if (!this.formattedDocument) {
            const content = await this.getContent();
            const currentFormattedDocument = await getFormatDocumentAsync(content, true);
            wrapFloatingTextNodes(currentFormattedDocument, this.fileParser.options.wrapFullTextNode);
            const elements = currentFormattedDocument.getElementsByTagName("*");

            for (let i = elements.length - 1; i >= 0; i--) {
                const element = elements[i];
                element.setAttribute(ElementInitialNumberName, i.toString());
            }
            this.formattedDocument = currentFormattedDocument;
        }

        return this.formattedDocument.cloneNode(true) as Document;
    }

    async dispose(): Promise<void> {
        if (this.texts) {
            this.texts.clear();
        }
        this.docContent = null;
        this.formattedDocument = null;
    }
}