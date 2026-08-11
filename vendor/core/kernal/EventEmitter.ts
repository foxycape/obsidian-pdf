import { EventEmitter as EE } from 'events'
import { IEventEmitter } from './IEventEmitter';

EE.defaultMaxListeners = 0;
export class EventEmitter implements IEventEmitter {
    private readonly externalEvents: Map<string | symbol, ((...args: any[]) => void)[]> = new Map<string | symbol, ((...args: any[]) => void)[]>();
    private readonly internallEvents: Map<string | symbol, ((...args: any[]) => void)[]> = new Map<string | symbol, ((...args: any[]) => void)[]>();
    private readonly events: EE;
    constructor() {
        this.events = new EE();
    }

    /**
     * Register event
     * @param eventName The event name
     * @param listener The event listener
     * @param isInternal Whether it is an internal event (default is internal event)
     * @returns The EventEmitter instance
     */
    on(eventName: string | symbol, listener: (...args: any[]) => void, isInternal = true): this {
        if (!eventName) {
            console.warn("eventName is null");
            return this;
        }
        if (!listener) {
            console.warn("listener is null");
            return this;
        }
        eventName = this.formatEventName(eventName);
        if (isInternal) {
            if (this.internallEvents.has(eventName)) {
                const values = this.internallEvents.get(eventName);
                values.push(listener);
            } else {
                this.internallEvents.set(eventName, [listener]);
            }
        }
        else {
            if (this.externalEvents.has(eventName)) {
                const values = this.externalEvents.get(eventName);
                values.push(listener);
            } else {
                this.externalEvents.set(eventName, [listener]);
            }
        }
        this.events.on(eventName, listener);
        return this;
    }

    once(eventName: string | symbol, listener: (...args: any[]) => void): this {
        if (!eventName) {
            console.warn("eventName is null");
            return this;
        }
        if (!listener) {
            console.warn("listener is null");
            return this;
        }

        eventName = this.formatEventName(eventName);
        this.events.once(eventName, listener);
        return this;
    }

    off(eventName: string | symbol, listener: (...args: any[]) => void): this {
        if (!eventName) {
            console.warn("eventName is null");
            return this;
        }
        if (!listener) {
            console.warn("listener is null");
            return this;
        }
        eventName = this.formatEventName(eventName);
        //Note, here the method of this class is called
        this.removeListener(eventName, listener);
        return this;
    }

    removeAllListeners(eventName?: string | symbol): this {
        if (eventName) {
            eventName = this.formatEventName(eventName);
            this.events.removeAllListeners(eventName);

            if (this.internallEvents.has(eventName)) {
                this.internallEvents.delete(eventName);
            }

            if (this.externalEvents.has(eventName)) {
                this.externalEvents.delete(eventName);
            }
        }
        else {
            this.events.removeAllListeners();
            this.internallEvents.clear();
            this.externalEvents.clear();
        }

        return this;
    }

    removeInternalListeners(): this {
        this.internallEvents.forEach((_value, key) => {
            const eventName = this.formatEventName(key);
            this.removeAllListeners(eventName);
        })
        this.internallEvents.clear();
        return this;
    }

    removeExternalListeners(): this {
        this.externalEvents.forEach((_value, key) => {
            const eventName = this.formatEventName(key);
            this.removeAllListeners(eventName);
        })
        this.externalEvents.clear();
        return this;
    }

    removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
        if (!eventName) {
            console.warn("eventName is null");
            return this;
        }
        if (!listener) {
            console.warn("listener is null");
            return this;
        }
        eventName = this.formatEventName(eventName);
        this.events.removeListener(eventName, listener);

        if (this.internallEvents.has(eventName)) {
            const values = this.internallEvents.get(eventName);
            const index = values.indexOf(listener);
            if (index >= 0) {
                values.splice(index, 1);
            }
            if (values.length == 0)
                this.internallEvents.delete(eventName);
        }

        if (this.externalEvents.has(eventName)) {
            const values = this.externalEvents.get(eventName);
            const index = values.indexOf(listener);
            if (index >= 0) {
                values.splice(index, 1);
            }
            if (values.length == 0)
                this.externalEvents.delete(eventName);
        }
        return this;
    }

    emit(eventName: string | symbol, ...args: any[]): boolean {
        if (!eventName) {
            console.warn("eventName is null");
            return false;
        }
        eventName = this.formatEventName(eventName);
        return this.events.emit(eventName, ...args);
    }

    listenerCount(eventName: string | symbol): number {
        if (!eventName) {
            console.warn("eventName is null");
            return 0;
        }
        eventName = this.formatEventName(eventName);
        return this.events.listenerCount(eventName);
    }

    eventNames(): Array<string | symbol> {
        return this.events.eventNames();
    }

    private formatEventName(eventName: string | symbol): string | symbol {
        if (typeof eventName === "string") {
            eventName = eventName.toLowerCase();
        }
        return eventName;
    }
}