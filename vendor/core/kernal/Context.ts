import { EventNames } from "./EventNames";
import { IEventEmitter } from "./IEventEmitter";
import { Metadata } from "./Metadata";
import { OpenOptions } from "./OpenOptions";
import { Options } from "./Options";
import { FileLocation, LocationFrom, Progress } from "./progress/Progress";

/** Fields that can be batch-assigned on Context. */
export type ContextInit = {
    simpleId?: string;
    id?: string;
    isExternalId?: boolean;
    metadata?: Metadata;
    progress?: Progress;
    currentLocation?: FileLocation;
    currentNavPointKey?: string;
    url?: any;
    extension?: string;
    openOptions?: OpenOptions;
    options?: Options;
    rootContainer?: HTMLElement;
    readerContainer?: HTMLElement;
    readerWrapper?: HTMLElement;
};

/**
 * Current reading session context (mutable session bag).
 */
export class Context {
    /** Simple id used for large-file identity */
    readonly simpleId: string;
    id: string;
    /** Whether id was provided externally */
    readonly isExternalId?: boolean;
    metadata: Metadata = new Metadata();
    progress: Progress = new Progress(1, 0);
    /** Current reading location */
    currentLocation?: FileLocation;
    /** Current nav point key */
    currentNavPointKey?: string;

    readonly url: any;
    readonly extension: string;
    readonly openOptions: OpenOptions;
    readonly options: Options;

    readonly rootContainer: HTMLElement;
    readonly readerContainer: HTMLElement;
    readonly readerWrapper: HTMLElement;

    private currentUserChangedProgress = true;
    private currentRedirectingDocUrl: string;

    constructor(
        private readonly events: IEventEmitter,
        init?: ContextInit
    ) {
        if (init) {
            Object.assign(this, init);
        }
        if (!this.openOptions) {
            this.openOptions = new OpenOptions();
        }
        if (!this.options) {
            this.options = new Options();
        }

        this.openOptions.resourceId = this.id;
        this.openOptions.simpleId = this.simpleId;
    }

    /** Whether the user changed reading progress */
    get userChangedProgress(): boolean {
        return this.currentUserChangedProgress;
    }

    setUserChangedProgress(value: boolean, from?: LocationFrom) {
        if (value) {
            this.events.emit(EventNames.UserChangedProgress, from);
            if (from != "toc") {
                this.currentNavPointKey = undefined;
            }
        }
        this.currentUserChangedProgress = value;
    }

    getTitle() {
        let resourceTitle = this.metadata?.title ?? "";
        if (!resourceTitle) {
            resourceTitle = this.metadata?.fileName ?? "";
        }
        return resourceTitle;
    }

    /**
     * Document url currently being navigated to.
     */
    get redirectingDocUrl(): string {
        return this.currentRedirectingDocUrl;
    }

    set redirectingDocUrl(url: string) {
        this.currentRedirectingDocUrl = url;
    }

    async dispose() {
        this.metadata = new Metadata();
        this.progress = new Progress(1, 0);
        this.currentLocation = undefined;
        this.currentNavPointKey = undefined;
        this.currentRedirectingDocUrl = undefined;
        this.currentUserChangedProgress = true;
    }
}
