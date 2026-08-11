import { LogLevel } from "./LogLevel";
import { ILogLevel, ILogger } from "./ILogger";

export class DefaultLogger implements ILogger {

    private name: string;
    constructor(name: string) {
        this.name = "[" + name + "]";
    }
    TRACE = LogLevel.TRACE;
    DEBUG = LogLevel.DEBUG;
    INFO = LogLevel.INFO;
    TIME = LogLevel.TIME;
    WARN = LogLevel.WARN;
    ERROR = LogLevel.ERROR;
    OFF = LogLevel.OFF;

    private level: ILogLevel = this.TRACE

    trace(...x: any[]): void {
        if (this.TRACE.value >= this.level.value && this.level != this.OFF) {
            const clean: any[] = this.sanitize(x);
            console.trace(...clean);
        }
    }
    debug(...x: any[]): void {
        if (this.DEBUG.value >= this.level.value && this.level != this.OFF) {
            const clean: any[] = this.sanitize(x);
            console.debug(...clean);
        }
    }
    info(...x: any[]): void {
        if (this.INFO.value >= this.level.value && this.level != this.OFF) {
            const clean: any[] = this.sanitize(x);
            console.info(...clean);
        }
    }
    log(...x: any[]): void {
        if (this.level != this.OFF) {
            const clean: any[] = this.sanitize(x);
            console.log(...clean);
        }
    }
    warn(...x: any[]): void {
        if (this.WARN.value >= this.level.value && this.level != this.OFF) {
            const clean: any[] = this.sanitize(x);
            console.warn(...clean);
        }
    }
    error(...x: any[]): void {
        if (this.ERROR.value >= this.level.value && this.level != this.OFF) {
            const clean: any[] = this.sanitize(x);
            console.error(...clean);
        }
    }
    time(label: string): void {
        const cleans: any[] = this.sanitize([label]);
        console.time(cleans[0])
    }
    timeEnd(label: string): void {
        const cleans: any[] = this.sanitize([label]);
        console.timeEnd(cleans[0])
    }
    setLevel(level: ILogLevel): void {
        this.level = level;
    }
    getLevel(): ILogLevel {
        return this.level;
    }

    enabledFor(level: ILogLevel): boolean {
        return this.level == level;
    }
    private sanitize(x: any[]) {
        const clean: any[] = []
        x.forEach(v => {
            if (v && typeof v === "string") {
                clean.push(v);
            }
            else {
                clean.push(v);
            }
        })
        clean.unshift(this.name);
        return clean;
    }
}