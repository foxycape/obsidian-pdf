import { Theme } from "../../../../kernal";

export interface IPdfThemeApplier {
    applyTheme(theme: Theme): void;
}