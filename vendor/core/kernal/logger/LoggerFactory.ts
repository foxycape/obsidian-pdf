import { DefaultLogger } from "./DefaultLogger";
import { ILogger, ILogLevel } from "./ILogger";
import { ILoggerFactory } from "./ILoggerFactory";

export class LoggerFactory implements ILoggerFactory {
    constructor(private readonly logLevel?: ILogLevel) {
    }
    getLogger(name: string, level?: ILogLevel): ILogger {
        const logger = new DefaultLogger(name);
        if(this.logLevel){
            logger.setLevel(this.logLevel);
        }
        if (level) {
            logger.setLevel(level);
        }
        return logger;
    }
}