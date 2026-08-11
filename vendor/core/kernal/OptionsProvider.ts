import { Options } from "./Options";
import { IEventEmitter } from "./IEventEmitter";
import { EventNames } from "./EventNames";

export class OptionsProvider {
    constructor(
        private readonly events: IEventEmitter,
        private readonly options: Options,
    ) {
    }

    getHeaderHeight() {
        const height = this.options.enableHeader && !this.options.zenMode
            ? (this.options.headerHeight ?? this.options.defaultHeaderHeight)
            : 0;
        if (isNaN(height) || height < 0 || (height == 0 && this.options.enableHeader && !this.options.zenMode)) {
            return this.options.defaultHeaderHeight;
        }
        return height;
    }

    getFooterHeight() {
        const height = this.options.enableFooter && !this.options.zenMode
            ? (this.options.footerHeight ?? this.options.defaultFooterHeight)
            : 0;
        if (isNaN(height) || height < 0 || (height == 0 && this.options.enableFooter && !this.options.zenMode)) {
            return this.options.defaultFooterHeight;
        }
        return height;
    }

    applyCssVariables(rootElement: HTMLElement) {
        rootElement.style.setProperty(Options.HeaderHeight, this.getHeaderHeight() + "px");
        rootElement.style.setProperty(Options.FooterHeight, this.getFooterHeight() + "px");
        rootElement.style.setProperty(Options.ScrollbarSize, this.options.scrollbarSize);
        rootElement.style.setProperty(Options.ScrollbarRadius, this.options.scrollbarRadius);
        rootElement.style.setProperty(Options.ScrollbarBorder, this.options.scrollbarBorder);
    }

    setOptionValue<K extends keyof Options>(key: K, value: Options[K]) {
        if (key in this.options) {
            Object.assign(this.options, { [key]: value });
            this.events.emit(EventNames.OptionsChange, key, value);
        }
    }
}
