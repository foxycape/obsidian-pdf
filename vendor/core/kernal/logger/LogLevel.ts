

export class LogLevel {
    static defineLogLevel = function (value, name) {
        return { value: value, name: name };
    };

    static TRACE = this.defineLogLevel(1, "TRACE");
    static DEBUG = this.defineLogLevel(2, "DEBUG");
    static INFO = this.defineLogLevel(3, "INFO");
    static TIME = this.defineLogLevel(4, "TIME");
    static WARN = this.defineLogLevel(5, "WARN");
    static ERROR = this.defineLogLevel(8, "ERROR");
    static OFF = this.defineLogLevel(99, "OFF");
}