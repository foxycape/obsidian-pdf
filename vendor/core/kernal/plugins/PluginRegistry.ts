import { injectExternalJS } from "../html/injector";
import { PluginCore } from "./PluginCore";
import type { Reader } from "../Reader";

/**
 * Plugin class constructor.
 */
export type PluginConstructor = new (reader: Reader, options?: any) => PluginCore;

export type SharedPluginEntry = {
    pluginClass?: PluginConstructor;
    scriptUrl?: string;
    options?: any;
};

/**
 * Global plugin catalog: shared class/script registration across all readers on the page.
 * Per-reader enable/disable is handled by {@link PluginManager}.
 */
export class PluginRegistry {
    /**
     * Shared plugin registrations keyed by plugin name.
     */
    private static readonly sharedPlugins = new Map<string, SharedPluginEntry>();

    /**
     * Shared script load promises keyed by absolute script url.
     * Ensures the same script is loaded only once across multiple readers.
     */
    private static readonly scriptLoads = new Map<string, Promise<void>>();

    /**
     * Registers a plugin class by name (shared across all readers).
     * Dynamically loaded scripts can also call this after they are evaluated.
     * @param pluginName Plugin name
     * @param pluginClass Plugin class constructor
     * @param options Default plugin options
     */
    static register(pluginName: string, pluginClass: PluginConstructor, options?: any): void {
        if (!pluginName || !pluginClass) {
            return;
        }
        const existing = PluginRegistry.sharedPlugins.get(pluginName);
        PluginRegistry.sharedPlugins.set(pluginName, {
            pluginClass,
            scriptUrl: existing?.scriptUrl,
            options: options ?? existing?.options,
        });
    }

    /**
     * Registers a plugin script by name for dynamic loading (shared across all readers).
     * The script should call PluginRegistry.register(name, PluginClass) when loaded.
     * @param pluginName Plugin name
     * @param scriptUrl Plugin script url
     * @param options Default plugin options
     */
    static registerScript(pluginName: string, scriptUrl: string, options?: any): void {
        if (!pluginName || !scriptUrl) {
            return;
        }
        const existing = PluginRegistry.sharedPlugins.get(pluginName);
        PluginRegistry.sharedPlugins.set(pluginName, {
            pluginClass: existing?.pluginClass,
            scriptUrl,
            options: options ?? existing?.options,
        });
    }

    /**
     * Whether a plugin is registered for the name.
     * @param pluginName Plugin name
     */
    static has(pluginName: string): boolean {
        return PluginRegistry.sharedPlugins.has(pluginName);
    }

    /**
     * Gets a shared plugin registration entry.
     * @param pluginName Plugin name
     */
    static get(pluginName: string): SharedPluginEntry | undefined {
        return PluginRegistry.sharedPlugins.get(pluginName);
    }

    /**
     * Iterates all shared plugin registrations.
     */
    static entries(): IterableIterator<[string, SharedPluginEntry]> {
        return PluginRegistry.sharedPlugins.entries();
    }

    /**
     * Ensures the plugin class is available, loading the script when needed.
     * @param pluginName Plugin name
     * @param resolveUrl Optional url resolver (e.g. internalUrlBuilder)
     */
    static async ensurePluginClass(
        pluginName: string,
        resolveUrl?: (src: string) => Promise<string>
    ): Promise<PluginConstructor | undefined> {
        const entry = PluginRegistry.sharedPlugins.get(pluginName);
        if (!entry) {
            return undefined;
        }

        if (entry.pluginClass) {
            return entry.pluginClass;
        }

        if (entry.scriptUrl) {
            await PluginRegistry.loadScript(entry.scriptUrl, resolveUrl);
            const loadedClass = PluginRegistry.sharedPlugins.get(pluginName)?.pluginClass;
            if (loadedClass) {
                return loadedClass;
            }
        }

        return undefined;
    }

    /**
     * Loads a plugin script once per absolute url across all readers.
     * @param scriptUrl Plugin script url
     * @param resolveUrl Optional url resolver (e.g. internalUrlBuilder)
     */
    static async loadScript(
        scriptUrl: string,
        resolveUrl?: (src: string) => Promise<string>
    ): Promise<void> {
        const url = resolveUrl ? await resolveUrl(scriptUrl) : scriptUrl;

        let loading = PluginRegistry.scriptLoads.get(url);
        if (!loading) {
            loading = injectExternalJS(document, url, false).catch((error) => {
                PluginRegistry.scriptLoads.delete(url);
                throw error;
            });
            PluginRegistry.scriptLoads.set(url, loading);
        }
        await loading;
    }
}
