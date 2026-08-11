import { IDisposable } from "../IDisposable";
import { Reader } from "../Reader";

export abstract class PluginCore implements IDisposable {
    constructor(public readonly reader: Reader,options?: any) { }
    abstract get name(): string;
    abstract get title(): string;
    abstract get description(): string;
    abstract get version(): string;
    abstract get supportedVersion(): string;
    abstract get supportedExtensions(): string[];
    abstract get supportedLanguages(): string[];
    abstract get isUIPlugin(): boolean;
    abstract getContainer(): HTMLElement|undefined;
    abstract load(): Promise<void>;
    abstract dispose(): Promise<void>;
}
