import { IEnvironment } from './IEnvironment';

export class WebEnvironment implements IEnvironment {
  
    getLanguage(defaultLanguage?: string, excludeRegion?: boolean, supportedLanguages?: string[]): string {
        let language = navigator.language || (navigator as any).browserLanguage;
        if (!language && defaultLanguage) {
            language = defaultLanguage;
        }
        if (language) {
            language = language.replace("_", "-").toLowerCase();
            if (supportedLanguages && !supportedLanguages.find(x => x == language)) {
                const shortLanguage = language.split('-')[0];
                const similarLanguage = supportedLanguages.find(x => x.startsWith(shortLanguage));
                if (similarLanguage) {
                    language = similarLanguage;
                }
                else if (defaultLanguage) {
                    language = defaultLanguage;
                }
            }
            if (excludeRegion) {
                language = language.split('-')[0];
            }
        }
        return language;
    }

    isChinese(language: string): boolean {
        const shortLanguage = language.split('-')[0];
        return shortLanguage == 'zh' || language == 'zh-cn' || language == 'zh-tw' || language == 'zh-hk';
    }

    getOSThemeName(): 'dark' | 'light' {
        if (globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches) {
            return "dark";
        }
        return "light";
    }
}
