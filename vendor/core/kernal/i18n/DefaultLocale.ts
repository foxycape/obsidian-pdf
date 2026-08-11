import { ILocale, Language, LocaleChangeListener } from "./ILocale";

export class DefaultLocale implements ILocale {
    resource: any = {};
    private readonly listeners = new Set<LocaleChangeListener>();
    constructor() {

    }
    async initialize(): Promise<void> {
        //do nothing
    }

    onLanguageChange(listener: LocaleChangeListener): () => void {
        this.listeners.add(listener);
        // The off returned remembers the listener registered this time
        return () => {
            this.listeners.delete(listener);
        };
    }

    getText(key: string, defaultText: string, named?: Object) {
        if (!key) {
            return defaultText;
        }
        let text = this.resource[key];
        if (!text) {
            return defaultText;
        }
        if (named) {
            const keys = Object.keys(named);
            for (const key of keys) {
                text = text.replaceAll("{" + key + "}", named[key])
            }
        }
        return text;
    }

    private currentLanguage: string;
    async changeLanguage(language: string) {
        this.currentLanguage = language;
        this.listeners.forEach(listener => listener(language));
    }


    getCurrentLanguage(excludeRegion?: boolean) {
        const defaultLanguage: string = "en-us";
        let language = this.currentLanguage;
        if (!language) {
            language = defaultLanguage;
        }
        if (language) {
            language = language.replace("_", "-").toLowerCase();
        }
        if (excludeRegion) {
            language = language.split('-')[0];
        }
        return language;
    }

    private supportedLanguages: Language[];
    getSupportedLanguages(): Language[] {
        if (!this.supportedLanguages) {
            this.supportedLanguages = [];
        }
        return this.supportedLanguages;
    }

    async dispose(): Promise<void> {
        this.resource = {};
    }
}