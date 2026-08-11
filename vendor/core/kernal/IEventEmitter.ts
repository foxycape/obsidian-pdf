export type EventListener = (...args: any[]) => void;

export interface IEventEmitter {
    /**
     * Register event
     * @param eventName The event name
     * @param listener The event listener
     * @param isInternal Whether it is an internal event (default is internal event)
     * @returns The EventEmitter instance
     */
    on(eventName: string | symbol, listener: EventListener, isInternal?: boolean): this;

    once(eventName: string | symbol, listener: EventListener): this;

    off(eventName: string | symbol, listener: EventListener): this;

    removeAllListeners(eventName?: string | symbol): this;

    removeInternalListeners(): this;

    removeExternalListeners(): this;

    removeListener(eventName: string | symbol, listener: EventListener): this;

    emit(eventName: string | symbol, ...args: any[]): boolean;

    listenerCount(eventName: string | symbol): number;

    eventNames(): Array<string | symbol>;
}
