import type { Metadata } from "./Metadata";
import type { Nav } from "./nav/Nav";
import type { FileLocation } from "./progress/Progress";
import type { WritingMode } from "./types";

export class OpenOptions {
    /** resource source (local, googledrive, onedrive, etc.) */
    from?: string;
    /** parent id */
    parentId?: string;

    /** specify resource simple id */
    simpleId?: string;
    /** specify resource id */
    resourceId?: string;
    /** third-party file id (for cloud storage) */
    customFileId?: string;
    /** specify the suffix name of the opened file */
    extension?: string;
    /** specify metadata */
    metadata?: Metadata;
    /** specify navigation information (directory) */
    nav?: Nav;
    /** file password */
    password?: string;
    /**
     * specify the opened position, format:
     *
     * FileLocation object
     *
     * total progress value (e.g.: 0.35, means total progress 35%)
     *
     * JSON string of FileLocation
     *
     * url-file progress (e.g.: chapter1.html-0.35)
     *
     * url index-file progress (e.g.: 0-0.35, means the first file, progress is 35%)
     *
     * url-progress calculation symbol&#64;progress (e.g.: chapter1.html-char&#64;0.35 or chapter1.html-custom&#64;0.35)
     *
     * url index value-progress calculation symbol&#64;progress
     */
    location?: FileLocation | number | string;

    /** presentation mode: auto-based on document definition, horizontal-tb horizontal, from top to bottom, vertical-rl vertical from right to left, vertical-lr vertical from left to right */
    writingMode?: WritingMode;

    /** specify the language of the opened resource */
    language?: string;

    /** whether to disable using theme when loading */
    disableLoadingTheme?: boolean;
    /** file name */
    fileName?: string;
    /** file size */
    fileSize?: number;
    /** header authentication parameter name */
    authorizationKey?: string;
    /** header authentication parameter value */
    authorizationValue?: string;
    /** require cross-domain request proxy */
    requireCORSProxy?: boolean;

    /**
     * whether to require signed file paths in the package
     */
    requireSignUrl?: boolean;

    /** AbortController */
    abortController?: AbortController;
    /** whether to require download */
    requireDownload?: boolean;
}
