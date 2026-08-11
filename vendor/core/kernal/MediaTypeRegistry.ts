import { formatExtension } from "./common/path";
import { IFileParser } from "./IFileParser";
import { IRenderer } from "./IRenderer";

/**
 * Creates a file parser instance.
 * @param url File path or data
 * @param extension File extension
 */
export type FileParserFactory = (
    url: any,
    extension: string,
) => IFileParser | Promise<IFileParser>;

/**
 * Creates a renderer instance.
 * @param owner Reader core owner
 * @param fileParser File parser
 * @param readerContainer Reader container element
 */
export type RendererFactory = (
    owner: import("./Reader").Reader,
    fileParser: IFileParser,
    readerContainer: HTMLElement
) => IRenderer | Promise<IRenderer>;

/**
 * Media type registry that maps file extensions to file-parser and renderer factories.
 * Multiple extensions may share the same implementation.
 */
export class MediaTypeRegistry {
    private readonly fileParsers = new Map<string, FileParserFactory>();
    private readonly renderers = new Map<string, RendererFactory>();

    /**
     * Registers both a file parser and a renderer.
     * @param extensions Supported extensions, e.g. [".html", ".xhtml"]
     * @param fileParserFactory Callback that creates a file parser
     * @param rendererFactory Callback that creates a renderer
     */
    register(
        extensions: string[],
        fileParserFactory: FileParserFactory,
        rendererFactory: RendererFactory
    ): void {
        this.registerFileParser(extensions, fileParserFactory);
        this.registerRenderer(extensions, rendererFactory);
    }

    /**
     * Registers a file parser factory.
     * @param extensions Supported extensions, e.g. [".html", ".xhtml"]
     * @param factory Callback that creates an instance
     */
    registerFileParser(extensions: string[], factory: FileParserFactory): void {
        for (const extension of extensions) {
            const key = formatExtension(extension);
            if (key) {
                this.fileParsers.set(key, factory);
            }
        }
    }

    /**
     * Registers a renderer factory.
     * @param extensions Supported extensions
     * @param factory Callback that creates an instance
     */
    registerRenderer(extensions: string[], factory: RendererFactory): void {
        for (const extension of extensions) {
            const key = formatExtension(extension);
            if (key) {
                this.renderers.set(key, factory);
            }
        }
    }

    hasFileParser(extension: string): boolean {
        return this.fileParsers.has(formatExtension(extension));
    }

    hasRenderer(extension: string): boolean {
        return this.renderers.has(formatExtension(extension));
    }

    /**
     * Creates a file parser for the given extension.
     * Media-specific options are resolved inside each factory (e.g. from MediaOptionsRegistry).
     */
    async createFileParser(
        url: any,
        extension: string,
    ): Promise<IFileParser> {
        const key = formatExtension(extension);
        const factory = this.fileParsers.get(key);
        if (!factory) {
            throw new Error(`No file parser registered for extension: ${key}`);
        }
        return await factory(url, key);
    }

    /**
     * Creates a renderer for the given file parser's extension.
     */
    async createRenderer(
        owner: import("./Reader").Reader,
        fileParser: IFileParser,
        readerContainer: HTMLElement
    ): Promise<IRenderer> {
        const key = formatExtension(fileParser.extension);
        const factory = this.renderers.get(key);
        if (!factory) {
            throw new Error(`No renderer registered for extension: ${key}`);
        }
        return await factory(owner, fileParser, readerContainer);
    }
}
