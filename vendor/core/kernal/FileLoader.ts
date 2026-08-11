import Logger from "js-logger";
import { getUuid } from "./common/uuid";
import { Context } from "./Context";
import { EventEmitter } from "./EventEmitter";
import { IEventEmitter } from "./IEventEmitter";
import { IFileParser } from "./IFileParser";
import { ILocale } from "./i18n/ILocale";
import { DefaultLocale } from "./i18n/DefaultLocale";
import type { LifecycleHooks } from "./LifecycleHooks";
import { ILogger } from "./logger/ILogger";
import type { ILoggerFactory } from "./logger/ILoggerFactory";
import { LoggerFactory } from "./logger/LoggerFactory";
import { MediaTypeRegistry } from "./MediaTypeRegistry";
import { OpenOptions } from "./OpenOptions";
import { Options } from "./Options";
import { FileLoadPipeline, type FileLoadPipelineOptions, type FileLoadResult } from "./pipelines/FileLoadPipeline";
import { IDevice } from "./device/IDevice";

export type { FileLoadPipelineOptions, FileLoadResult } from "./pipelines/FileLoadPipeline";
import { InputFormatter } from "./pipelines/InputFormatter";
import { ReaderInfo } from "./ReaderInfo";
import { CoreServiceMap, ServiceCollection } from "./services/ServiceCollection";
import { WebBrowser } from "./device/WebBrowser";
import { IPlatform } from "./device/IPlatform";
import { IEnvironment } from "./device/IEnvironment";
import { WebEnvironment } from "./device/WebEnvironment";
import { WebPlatform } from "./device/WebPlatform";
import { IStorage } from "./storage/IStorage";

export type CoreServices = {
    platform?: IPlatform;
    environment?: IEnvironment;
    device?: IDevice;
    locale?: ILocale;
    storage?: IStorage;
    loggerFactory?: ILoggerFactory;
};

/**
 * Headless file loader: parse a resource without DOM / renderer / interactive.
 */
export class FileLoader {
    readonly version: string;
    readonly options: Options;
    /** Core (headless) services only — UI services are registered by Reader. */
    readonly services: ServiceCollection<CoreServiceMap>;
    readonly loggerFactory: ILoggerFactory;
    readonly events: IEventEmitter;
    readonly readerInfo: ReaderInfo;
    readonly lifecycle: LifecycleHooks;
    readonly mediaTypeRegistry: MediaTypeRegistry;
    readonly locale: ILocale;
    readonly device: IDevice;
    readonly platform: IPlatform;
    readonly environment: IEnvironment;
    private readonly logger: ILogger;
    readonly inputFormatter: InputFormatter;
    private readonly pipeline: FileLoadPipeline;

    private currentUrl?: any;
    private currentOpenOptions?: OpenOptions;
    private currentExtension: string = "";
    private currentContext?: Context;
    private fileParser?: IFileParser;
    private abortController?: AbortController;
    private currentIsLoaded = false;
    private currentIsDisposed = false;
    private currentIsCancelled = false;
    private instanceId?: string;

    constructor(options: Options, services?: CoreServices, lifecycle?: LifecycleHooks) {
        this.options = Object.assign(new Options(), options);
        this.version = options.version || "1.0.0";
        this.readerInfo = new ReaderInfo(this.version, options.baseUrl, options.preventCacheHash, options.debug);
        this.events = new EventEmitter();
        this.locale = services?.locale ?? new DefaultLocale();
        this.platform = services?.platform ?? new WebPlatform();
        this.environment = services?.environment ?? new WebEnvironment();
        this.device = services?.device ?? new WebBrowser(this.platform, this.environment);
        this.loggerFactory = services?.loggerFactory ?? new LoggerFactory(options.debug ? Logger.DEBUG : Logger.INFO);
        this.logger = this.loggerFactory.getLogger(this.constructor.name);

        this.mediaTypeRegistry = new MediaTypeRegistry();
        this.services = new ServiceCollection<CoreServiceMap>(this.locale, this.events, this.readerInfo);
        if (services?.storage) {
            const storage = services.storage;
            this.services.add("storage", () => storage);
        }

        this.services.registerCoreServices();

        this.inputFormatter = new InputFormatter(this.services, this.options);
        this.lifecycle = lifecycle ?? {};
        this.pipeline = new FileLoadPipeline({
            inputFormatter: this.inputFormatter,
            mediaTypeRegistry: this.mediaTypeRegistry,
            services: this.services,
            options: this.options,
            events: this.events,
            lifecycle: this.lifecycle,
        });
    }

    get id(): string {
        if (this.instanceId) {
            return this.instanceId;
        }
        this.instanceId = getUuid();
        return this.instanceId;
    }

    get loaded() {
        return this.currentIsLoaded;
    }

    get disposed() {
        return this.currentIsDisposed;
    }

    get cancelled() {
        return this.currentIsCancelled;
    }

    get context() {
        return this.currentContext;
    }

    get url() {
        return this.currentUrl;
    }

    get openOptions() {
        return this.currentOpenOptions;
    }

    get extension(): string {
        return this.currentExtension;
    }

    getFileParser(): IFileParser {
        return this.fileParser;
    }

    /**
     * Load and parse a file without creating any DOM.
     */
    async load(url: any, openOptions?: OpenOptions, pipelineOptions?: FileLoadPipelineOptions): Promise<FileLoadResult> {
        if (this.currentIsDisposed) {
            throw new Error("file loader is disposed.");
        }
        if (this.currentIsLoaded) {
            await this.clear();
        }

        this.currentIsDisposed = false;
        this.currentIsCancelled = false;

        try {
            await this.fileParser?.dispose();
            this.fileParser = undefined;

            const result = await this.pipeline.load(url, openOptions, {
                ...pipelineOptions,
                attachContext: (context) => {
                    this.currentContext = context;
                    this.currentOpenOptions = context.openOptions;
                    pipelineOptions?.attachContext?.(context);
                },
                isCancelled: () => this.currentIsCancelled || !!pipelineOptions?.isCancelled?.(),
            });

            this.applyResult(result);
            return result;
        } finally {
            this.currentIsLoaded = true;
        }
    }

    /** @internal */
    applyResult(result: FileLoadResult): void {
        this.currentUrl = result.url;
        this.currentOpenOptions = result.openOptions;
        this.currentExtension = result.extension;
        this.currentContext = result.context;
        this.fileParser = result.fileParser;
        this.abortController = result.abortController;
    }

    /** Mark disposed without re-running lifecycle (Reader owns shared lifecycle). */
    markDisposed(): void {
        this.currentIsDisposed = true;
    }

    async dispose(): Promise<void> {
        await this.lifecycle.onDisposing?.();
        await this.clear();
        this.currentIsDisposed = true;
        await this.lifecycle.onDisposed?.();
    }

    async clear(): Promise<void> {
        try {
            if (this.abortController) {
                this.abortController.abort("Cancelled");
                this.abortController = undefined;
                this.logger.info("User cancelled task,url", this.url);
                this.currentIsCancelled = true;
            }
        } catch {
            //
        }

        if (this.fileParser) {
            await this.fileParser.dispose();
            this.fileParser = undefined;
        }

        this.currentUrl = undefined;
        this.currentOpenOptions = undefined;
        this.currentExtension = "";
        this.currentContext = undefined;
        this.currentIsLoaded = false;
    }
}
