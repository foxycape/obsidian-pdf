import { ILogger } from "../logger/ILogger";
import type { ILoggerFactory } from "../logger/ILoggerFactory";
import { PluginCore } from "./PluginCore";
import { PluginRegistry } from "./PluginRegistry";
import type { Reader } from "../Reader";
import { ServiceCollection, ServiceMap } from "../services/ServiceCollection";

/**
 * Per-reader plugin host: enable/disable/dispose plugin instances for one Reader.
 * Global class/script registration lives on {@link PluginRegistry}.
 */
export class PluginManager {
    private readonly loadedPlugins: PluginCore[] = [];
    private readonly logger: ILogger;

    constructor(
        private readonly reader: Reader,
        private readonly loggerFactory: ILoggerFactory,
        private readonly services: ServiceCollection<ServiceMap>,
        private readonly version: string
    ) {
        this.logger = this.loggerFactory.getLogger(this.constructor.name);
    }

    /**
     * Gets currently loaded plugin instances for this reader.
     */
    getLoadedPlugins(): PluginCore[] {
        return this.loadedPlugins;
    }

    /**
     * Enables registered interactive plugins.
     * Filters by supported version, extension and language.
     * @param extension Current file extension
     */
    enablePlugins = async (extension: string): Promise<void> => {
        for (const [pluginName, entry] of PluginRegistry.entries()) {
            try {
                const pluginClass = await this.ensurePluginClass(pluginName);
                if (!pluginClass) {
                    this.logger.warn("plugin not found,pluginName:", pluginName);
                    continue;
                }

                const supportedVersion = pluginClass.prototype.supportedVersion.trim();
                let minVersion = supportedVersion;
                let maxVersion = supportedVersion;
                if (supportedVersion.startsWith(">=")) {
                    const versionPart = supportedVersion.split(">=")[1].trim();
                    minVersion = versionPart;
                    maxVersion = this.version;
                }

                const matchMinVersion = this.compareVersion(this.version, minVersion) >= 0;
                const matchMaxVersion = this.compareVersion(this.version, maxVersion) <= 0;
                if (!matchMinVersion) {
                    this.logger.warn(
                        "plugin's minVersion is not matched,pluginName:",
                        pluginName,
                        "current:",
                        this.version,
                        "minVersion:",
                        minVersion
                    );
                    continue;
                }
                if (!matchMaxVersion) {
                    this.logger.warn(
                        "plugin's maxVersion is not matched,pluginName:",
                        pluginName,
                        "current:",
                        this.version,
                        "maxVersion:",
                        maxVersion
                    );
                    continue;
                }
                const locale = this.reader.locale
                const language = locale?.getCurrentLanguage();
                const languageFirstPart = language?.split("-")?.[0];
                if ((pluginClass.prototype.supportedExtensions[0] == "*"
                    || pluginClass.prototype.supportedExtensions.indexOf(extension) >= 0)
                    && (pluginClass.prototype.supportedLanguages[0] == "*"
                        || pluginClass.prototype.supportedLanguages.indexOf(language) >= 0
                        || (languageFirstPart && pluginClass.prototype.supportedLanguages.indexOf(languageFirstPart) >= 0))) {
                    await this.enablePlugin(pluginName, entry.options);
                }
            }
            catch (e) {
                this.logger.error(
                    "load plugin failed,pluginName:",
                    pluginName,
                    "err:",
                    e.toString()
                );
            }
        }
    };

    /**
     * Enables a single plugin for this reader.
     * Resolves the plugin class first (loads script when needed).
     * Plugin instance load() is not awaited, to avoid blocking the main flow.
     * @param plugin Plugin instance or plugin name
     * @param pluginOptions Plugin options (falls back to options from register/registerScript)
     */
    async enablePlugin(plugin: PluginCore | string, pluginOptions?: any): Promise<void> {
        let realPlugin: PluginCore;
        if (typeof plugin === "string") {
            const pluginClass = await this.ensurePluginClass(plugin);
            if (!pluginClass) {
                this.logger.warn("no plugin name:" + plugin);
                return;
            }
            const options = pluginOptions ?? PluginRegistry.get(plugin)?.options;
            realPlugin = new pluginClass(this.reader, options);
        }
        else {
            realPlugin = plugin;
        }

        if (!realPlugin) {
            return;
        }

        realPlugin.load().then(() => {
            this.loadedPlugins.push(realPlugin);
        }, (e) => {
            this.logger.error("load plugin failed ...", e, plugin, pluginOptions);
        });
    }

    /**
     * Disables a plugin for this reader.
     * @param plugin Plugin instance or plugin name
     */
    async disablePlugin(plugin: PluginCore | string): Promise<void> {
        let realPlugin: PluginCore;
        if (typeof plugin === "string") {
            realPlugin = this.loadedPlugins.find(x => x.name == plugin);
        }
        else {
            realPlugin = plugin;
        }

        if (realPlugin) {
            await realPlugin.dispose();
            const index = this.loadedPlugins.indexOf(realPlugin);
            if (index >= 0) {
                this.loadedPlugins.splice(index, 1);
            }
        }
    }

    /**
     * Disposes all loaded plugins for this reader.
     */
    async dispose(): Promise<void> {
        if (this.loadedPlugins.length > 0) {
            for (let i = 0; i < this.loadedPlugins.length; i++) {
                await this.loadedPlugins[i].dispose();
            }
            this.loadedPlugins.length = 0;
        }
    }

    /**
     * Ensures the plugin class is available, loading the script when needed.
     */
    private async ensurePluginClass(pluginName: string) {
        const pluginClass = await PluginRegistry.ensurePluginClass(
            pluginName,
            this.resolveUrl
        );
        if (!pluginClass && PluginRegistry.get(pluginName)?.scriptUrl) {
            this.logger.warn(
                "plugin script loaded but PluginRegistry.register was not called,pluginName:",
                pluginName
            );
        }
        return pluginClass;
    }

    /**
     * Resolves a plugin script url via internalUrlBuilder when available.
     */
    private resolveUrl = async (scriptUrl: string): Promise<string> => {
        const internalUrlBuilder = await this.services.get('internalUrlBuilder');
        if (internalUrlBuilder) {
            return await internalUrlBuilder.getAbsoluteUrl(scriptUrl);
        }
        return scriptUrl;
    };

    /**
     * Compares two version strings.
     * @param version1 First version
     * @param version2 Second version
     * @returns 1 if version1 > version2, -1 if version1 < version2, otherwise 0
     */
    private compareVersion = (version1: string, version2: string): number => {
        const arr1 = version1.split(".").map(e => parseInt(e) * 1);
        const arr2 = version2.split(".").map(e => parseInt(e) * 1);
        const length = Math.max(arr1.length, arr2.length);
        for (let i = 0; i < length; i++) {
            if ((arr1[i] || 0) > (arr2[i] || 0)) {
                return 1;
            }
            if ((arr1[i] || 0) < (arr2[i] || 0)) {
                return -1;
            }
        }
        return 0;
    };
}
