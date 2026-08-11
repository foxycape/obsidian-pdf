import { Context, EventNames, IEventEmitter, ILocale, IStorage } from "../../../kernal";
import * as pdfjsLib from '../../../pdfjs/legacy/build/pdf.mjs';
import { PdfPasswordPromptCallback } from "./IPdfFileParser";

export class PdfPasswordProvider {
    private static readonly PASSWORD_TABLE = 'pdf-passwords';

    private pdfjsPasswordCallback?: (password: string | Error) => void;
    private sessionPassword?: string;

    constructor(
        public readonly events: IEventEmitter,
        public readonly locale: ILocale,
        public readonly context: Context,
        public readonly storage: IStorage | null,
    ) {
    }

    getPassword = async (): Promise<string | undefined> => {
        const fromOpenOptions = this.context.openOptions.password;
        if (fromOpenOptions) {
            return fromOpenOptions;
        }
        if (this.sessionPassword) {
            return this.sessionPassword;
        }
        return await this.getStoredPassword();
    };

    onPasswordPrompt = (callback: (password: string) => void, reason: number) => {
        const locale = this.locale;
        switch (reason) {
            case pdfjsLib.PasswordResponses.NEED_PASSWORD: {
                this.pdfjsPasswordCallback = callback;
                this.events.emit(
                    EventNames.RequirePdfPassword,
                    this.onPdfPasswordCallback,
                    this.locale?.getText('share_require_pdf_password', 'Enter password to open PDF')
                    ?? 'Enter password to open PDF',
                    1,
                );
                break;
            }
            case pdfjsLib.PasswordResponses.INCORRECT_PASSWORD: {
                this.pdfjsPasswordCallback = callback;
                this.events.emit(
                    EventNames.RequirePdfPassword,
                    this.onPdfPasswordCallback,
                    locale?.getText('share_invalid_pdf_password_try_again', 'Incorrect password, please try again')
                    ?? 'Incorrect password, please try again',
                    2,
                );
                break;
            }
            default:
                break;
        }
    };

    private onPdfPasswordCallback: PdfPasswordPromptCallback = async (password) => {
        if (typeof password === 'string') {
            await this.setPassword(password);
        } else {
            await this.clearPassword();
        }
        this.pdfjsPasswordCallback?.(password);
    };

    private getSimpleId(): string | undefined {
        const simpleId = this.context.simpleId;
        return simpleId || undefined;
    }

    private async getStoredPassword(): Promise<string | undefined> {
        const simpleId = this.getSimpleId();
        if (!simpleId || !this.storage) {
            return undefined;
        }
        const password = await this.storage.getString(PdfPasswordProvider.PASSWORD_TABLE, simpleId);
        if (password) {
            this.sessionPassword = password;
        }
        return password || undefined;
    }

    private async setPassword(password: string) {
        this.sessionPassword = password;
        const openOptions = this.context.openOptions;
        if (openOptions) {
            openOptions.password = password;
        }
        const simpleId = this.getSimpleId();
        if (simpleId && this.storage) {
            await this.storage.set(PdfPasswordProvider.PASSWORD_TABLE, simpleId, password);
        }
    }

    private async clearPassword() {
        this.sessionPassword = undefined;
        const openOptions = this.context.openOptions;
        if (openOptions) {
            openOptions.password = '';
        }
        const simpleId = this.getSimpleId();
        if (simpleId && this.storage) {
            await this.storage.delete(PdfPasswordProvider.PASSWORD_TABLE, simpleId);
        }
    }
}
