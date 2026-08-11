import { Context, ContextInit } from "../Context";
import { Metadata } from "../Metadata";
import { IEventEmitter } from "../IEventEmitter";
import { IFileParser } from "../IFileParser";
import type { LifecycleHooks } from "../LifecycleHooks";
import { MediaTypeRegistry } from "../MediaTypeRegistry";
import { OpenOptions } from "../OpenOptions";
import { Options } from "../Options";
import { FileLocation, Progress } from "../progress/Progress";
import { CoreServiceMap, ServiceCollection } from "../services/ServiceCollection";
import { InputFormatter } from "./InputFormatter";
import { formatMetadata } from "./metadata";

export type FileLoadPipelineDeps = {
    inputFormatter: InputFormatter;
    mediaTypeRegistry: MediaTypeRegistry;
    services: ServiceCollection<CoreServiceMap>;
    options: Options;
    events: IEventEmitter;
    lifecycle: LifecycleHooks;
};

export type FileLoadPrepareState = {
    url: any;
    openOptions: OpenOptions;
    extension: string;
    simpleId: string;
    resourceId: string;
    isExternalId: boolean;
};

export type FileLoadPipelineOptions = {
    /** Extra Context fields (e.g. DOM containers for Reader). */
    contextInit?: ContextInit;
    /** Build ContextInit after input is resolved (Reader uses this to create DOM first). */
    prepareContext?: (state: FileLoadPrepareState) => Promise<ContextInit | void> | ContextInit | void;
    /** Called right after Context is created so parsers can read openOptions (e.g. password) during load. */
    attachContext?: (context: Context) => void;
    /** Runs after parser.load, before metadata formatting. */
    afterParserReady?: (extension: string) => Promise<void> | void;
    isCancelled?: () => boolean;
    measureFilePercentage?: boolean;
};

export type FileLoadResult = {
    url: any;
    openOptions: OpenOptions;
    extension: string;
    simpleId: string;
    resourceId: string;
    isExternalId: boolean;
    fileParser: IFileParser;
    metadata: Metadata;
    context: Context;
    abortController?: AbortController;
    location?: FileLocation;
    percentage?: number;
};

/**
 * Shared file-load orchestration used by FileLoader (headless) and Reader (with DOM).
 */
export class FileLoadPipeline {
    constructor(private readonly deps: FileLoadPipelineDeps) {
    }

    async load(url: any, openOptions?: OpenOptions, pipelineOptions?: FileLoadPipelineOptions): Promise<FileLoadResult> {
        const {
            inputFormatter,
            mediaTypeRegistry,
            options,
            events,
            lifecycle,
        } = this.deps;

        inputFormatter.guardUrl(url);

        const formatted = await inputFormatter.formatInputParameters(url, openOptions);
        if (!formatted.extension) {
            throw new Error("file extension is required");
        }

        await lifecycle.onInitialize?.(formatted.extension);
        let { simpleId, resourceId, isExternalId } = await inputFormatter.getIds(formatted.url, formatted.openOptions);
        await lifecycle.onOptionsParse?.(options);

        const prepareState: FileLoadPrepareState = {
            url: formatted.url,
            openOptions: formatted.openOptions,
            extension: formatted.extension,
            simpleId,
            resourceId,
            isExternalId,
        };

        const preparedContextInit = await pipelineOptions?.prepareContext?.(prepareState);
        const context = new Context(events, {
            simpleId,
            id: resourceId,
            isExternalId,
            url: formatted.url,
            extension: formatted.extension,
            options,
            openOptions: formatted.openOptions,
            ...pipelineOptions?.contextInit,
            ...preparedContextInit,
        });
        pipelineOptions?.attachContext?.(context);

        const { url: parserUrl, abortController } = inputFormatter.formatParserUrl(
            formatted.url,
            formatted.extension,
            formatted.openOptions
        );

        const fileParser = await mediaTypeRegistry.createFileParser(
            parserUrl,
            formatted.extension,
        );
        await fileParser.load({ measureFilePercentage: pipelineOptions?.measureFilePercentage });

        if (pipelineOptions?.isCancelled?.()) {
            throw new Error("User cancelled task");
        }

        if (!resourceId) {
            resourceId = await fileParser.getFileHash();
            context.id = resourceId;
        }

        const formatLocationResult = inputFormatter.formatLocation(formatted.openOptions?.location, formatted.extension);
        let location = formatLocationResult.location;
        const percentage = formatLocationResult.percentage;
        const isValidLocation = location != undefined || (!isNaN(percentage) && percentage <= 1 && percentage >= 0);

        if (!isValidLocation) {
            if (options.enableProgressStore) {
                const progressStore = await this.deps.services.get("readingProgressStore");
                const progress = await progressStore?.get(simpleId);
                if (progress) {
                    location = progress.location
                }
            }
            if (!location) {
                location = new FileLocation("0", 1, "ratio");
            }
        }

        await pipelineOptions?.afterParserReady?.(formatted.extension);

        const metadata = formatMetadata(await fileParser.getMetadata(), formatted.url, formatted.extension);
        context.metadata = metadata;

        await lifecycle.onFileParsed?.(fileParser);

        return {
            url: formatted.url,
            openOptions: formatted.openOptions,
            extension: formatted.extension,
            simpleId,
            resourceId,
            isExternalId,
            fileParser,
            metadata,
            context,
            abortController,
            location,
            percentage,
        };
    }
}
