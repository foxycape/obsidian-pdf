import { IDisposable } from "../../IDisposable";

export interface INotifier extends IDisposable {
    /**
     * Initialize
     * @param rootElement The document where the reader is located
     */
    initialize(rootElement: Document | HTMLElement): Promise<void>

    /**
     * Normal notification
     * @param message The message content
     */
    info(message: string,options?:any): void;

    /**
     * Success notification
     * @param message The message content
     */
    success(message: string,options?:any): void;

    /**
     * Error notification
     * @param message The message content
     */
    error(message: string,options?:any): void;

    /**
     * Close all notifications
     */
    closeAll(): void;
}