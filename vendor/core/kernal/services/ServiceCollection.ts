import { ReaderInfo } from "../ReaderInfo";
import { ILocale } from "../i18n/ILocale";
import { IEventEmitter } from "../IEventEmitter";

/** Services available to headless FileLoader / parse pipelines. */
export type CoreServiceMap = {
    httpClient: import("../network/IHttpClient").IHttpClient;
    internalUrlBuilder: import("./internalUrlBuilder/IInternalUrlBuilder").IInternalUrlBuilder;
    fileUrlParser: import("./fileUrlParser/IFileUrlParser").IFileUrlParser;
    crypto: import("../crypto/ICrypto").ICrypto;
    fileUrlProvider: import("./file/IFileUrlProvider").IFileUrlProvider;
    fileDecrypter: import("./file/IFileDecrypter").IFileDecrypter;
    fileProvider: import("./file/IFileProvider").IFileProvider;
    storage: import("../storage/IStorage").IStorage;
    readingProgressStore: import("../progress/IReadingProgressStore").IReadingProgressStore;
};

/** DOM / reader UI services (only registered for Reader). */
export type UiServiceMap = {
    notifier: import("./notifier/INotifier").INotifier;
    loading: import("./loading/ILoading").ILoading;
    themeProvider: import("../IThemeProvider").IThemeProvider;
    wallpaperProvider: import("../IWallpaperProvider").IWallpaperProvider;
    loadLayer: import("./docLoadLayer/IHtmlLoadLayer").IHtmlLoadLayer;
    symbolCalclator: import("../ISymbolCalclator").ISymbolCalclator;
};

/** Full service map for the reader host. */
export type ServiceMap = CoreServiceMap & UiServiceMap;

/**
 * Typed service locator.
 * - FileLoader uses {@link ServiceCollection}<{@link CoreServiceMap}>
 * - Reader uses {@link ServiceCollection}<{@link ServiceMap}>
 */
export class ServiceCollection<TMap extends CoreServiceMap = ServiceMap> {
    private readonly services = new Map<PropertyKey, () => any>();

    constructor(
        private readonly locale: ILocale,
        private readonly events: IEventEmitter,
        private readonly readerInfo: ReaderInfo
    ) {
    }

    add<K extends keyof TMap>(
        key: K,
        create: () => TMap[K] | Promise<TMap[K]>
    ): void {
        this.services.set(key as PropertyKey, create);
    }

    async get<K extends keyof TMap>(key: K, throwErrorIfNotFound?: boolean): Promise<TMap[K] | undefined> {
        const create = this.services.get(key as PropertyKey) as (() => TMap[K] | Promise<TMap[K]>) | undefined;

        if (create === undefined) {
            if (throwErrorIfNotFound) {
                throw new Error(`Service "${String(key)}" is not registered.`);
            }
            return undefined;
        }

        return await create();
    }

    has(key: keyof TMap): boolean {
        return this.services.has(key as PropertyKey);
    }

    remove(key: keyof TMap): void {
        this.services.delete(key as PropertyKey);
    }

    clear(): void {
        this.services.clear();
    }

    /**
     * Widen to the full reader service map (same instance).
     * Call {@link registerUiServices} after this when hosting a Reader.
     */
    asReaderServices(): ServiceCollection<ServiceMap> {
        return this as unknown as ServiceCollection<ServiceMap>;
    }

    /** Headless / parse-time defaults. */
    registerCoreServices(): void {
        if (!this.has("httpClient")) {
            this.add("httpClient", async () => {
                const { HttpClient } = await import("../network/HttpClient");
                return new HttpClient();
            });
        }
        if (!this.has("crypto")) {
            this.add("crypto", async () => {
                const { WebCrypto } = await import("../crypto/WebCrypto");
                return new WebCrypto();
            });
        }
        if (!this.has("internalUrlBuilder")) {
            this.add("internalUrlBuilder", async () => {
                const { DefaultInternalUrlBuilder } = await import("./internalUrlBuilder/DefaultInternalUrlBuilder");
                return new DefaultInternalUrlBuilder(this.readerInfo.baseUrl, this.readerInfo.preventCacheHash);
            });
        }
        if (!this.has("fileUrlParser")) {
            this.add("fileUrlParser", async () => {
                const { DefaultFileUrlParser } = await import("./fileUrlParser/DefaultFileUrlParser");
                const httpClient = await this.get("httpClient", true);
                const internalUrlBuilder = await this.get("internalUrlBuilder", true);
                return new DefaultFileUrlParser(httpClient, internalUrlBuilder, this.locale);
            });
        }
        if (!this.has("storage")) {
            this.add("storage", async () => {
                const { WebStorage } = await import("../storage/WebStorage");
                return new WebStorage();
            });
        }
        if (!this.has("readingProgressStore")) {
            this.add("readingProgressStore", async () => {
                const { ReadingProgressStore } = await import("../progress/ReadingProgressStore");
                return new ReadingProgressStore(await this.get("storage", true));
            });
        }
    }

    /** DOM / reader UI defaults. Only valid on {@link ServiceCollection}<{@link ServiceMap}>. */
    registerUiServices(this: ServiceCollection<ServiceMap>): void {
        if (!this.has("notifier")) {
            this.add("notifier", async () => {
                const { DefaultNotifier } = await import("./notifier/DefaultNotifier");
                return new DefaultNotifier();
            });
        }
        if (!this.has("loading")) {
            this.add("loading", async () => {
                const { DefaultLoading } = await import("./loading/DefaultLoading");
                return new DefaultLoading(this.locale);
            });
        }
        if (!this.has("loadLayer")) {
            this.add("loadLayer", async () => {
                const { HtmlLoadLayer } = await import("./docLoadLayer/HtmlLoadLayer");
                return new HtmlLoadLayer(this.events);
            });
        }
    }
}
