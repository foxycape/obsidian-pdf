import { ILogger, ILogLevel } from "./ILogger";

export interface ILoggerFactory {
    getLogger(name: string,level?: ILogLevel): ILogger;
}