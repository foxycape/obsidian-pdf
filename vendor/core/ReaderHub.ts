import { EventNames } from "./kernal/EventNames";
import { CoreServices } from "./kernal/FileLoader";
import { Options } from "./kernal/Options";
import { Reader } from "./kernal/Reader";

export class ReaderHub {

    private static allReaders: Reader[] = [];
    static get readers() {
        return this.allReaders;
    }

    /** current active reader id */
    private static currentReaderId: string;
    /** current active reader id */
    static get readerId() {
        return this.currentReaderId;
    }

    /** current focused reader id */
    private static currentFocusReaderId: string;
    /** current focused reader id */
    static get focusReaderId() {
        return this.currentFocusReaderId;
    }

    static createReader(options: Options, services?: CoreServices) {
        const reader = new Reader(options, services);
        this.bindEvents(reader);
        this.addReader(reader);
        return reader;
    }

    private static bindEvents(reader: Reader) {
        reader.events.on(EventNames.ReaderClick, (reader) => {
            this.currentReaderId = reader.id;
            this.currentFocusReaderId = reader.id;
        });
        reader.events.on(EventNames.ReaderMouseEnter, (reader) => {
            this.currentFocusReaderId = reader.id;
        });
    }

    private static unbindEvents(reader: Reader) {
        reader.events.off(EventNames.ReaderClick, (reader) => {
            this.currentReaderId = reader.id;
            this.currentFocusReaderId = reader.id;
        });
        reader.events.off(EventNames.ReaderMouseEnter, (reader) => {
            this.currentFocusReaderId = reader.id;
        });
    }
    static getActiveReader() {
        const readerId = this.readerId;
        if (readerId) {
            return this.readers.find(x => x.id == readerId);
        }
        return null;
    }

    static getFocusReader() {
        const readerId = this.focusReaderId;
        if (readerId) {
            return this.readers.find(x => x.id == readerId);
        }
        return null;
    }

    static addReader(reader: Reader) {
        if (!this.allReaders.includes(reader)) {
            this.allReaders.push(reader)
        }
        if (!this.currentReaderId) {
            this.currentReaderId = reader.id;
        }
    }

    static removeReader(reader: Reader, unbindEvents: boolean = true) {
        const readerIndex = this.allReaders.indexOf(reader);
        if (readerIndex >= 0) {
            this.allReaders.splice(readerIndex, 1);
        }
        if (this.allReaders.length > 0) {
            this.currentReaderId = this.allReaders[0].id;
        }
        else {
            this.currentReaderId = ""
        }
        if (unbindEvents) {
            this.unbindEvents(reader);
        }
    }

    /**
     * get reader
     * @param id 
     * @returns 
     */
    static getReader(id: string) {
        return this.allReaders.find(x => x.id == id);
    }
}