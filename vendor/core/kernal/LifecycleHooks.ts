import { IRenderer } from "./IRenderer";
import { Options } from "./Options";
import { IFileParser } from "./IFileParser";
import { IDocumentsProvider } from "./IDocumentsProvider";

/**
 * Reader / FileLoader lifecycle and extension hooks.
 */
export type LifecycleHooks = {
    onInitialize?: (extension: string) => Promise<void>;
    onDisposing?: () => Promise<void>;
    onDisposed?: () => Promise<void>;
    onOptionsParse?: (options: Options) => Promise<void>;
    onContainerCreated?: () => Promise<void>;
    onFileParsed?: (fileParser: IFileParser) => Promise<void>;
    onRenderer?: (renderer: IRenderer) => Promise<void>;
    onRenderered?: (renderer: IRenderer) => Promise<void>;
    /** inject/rewrite file content before rendering */
    onRenderingFileInject?: (extension: string, data: string, url?: string) => Promise<string>;
    /** progress change guard (return false to interrupt subsequent broadcast/storage) */
    onProgressChangeGuard?: (progress: number) => boolean;
    /** redirect before (can be used to save current progress) */
    onBeforeRedirect?: (documentsProvider: IDocumentsProvider) => Promise<void>;
};
