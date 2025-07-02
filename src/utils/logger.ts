export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
}

export class Logger {
    private level: LogLevel;
    private name: string;

    constructor(name: string, level: LogLevel = LogLevel.INFO) {
        this.name = name;
        this.level = level;
    }

    private log(level: LogLevel, message: string, ...args: any[]): void {
        if (level > this.level) return;

        const timestamp = new Date().toISOString();
        const levelName = LogLevel[level];
        const prefix = `[${timestamp}] [${levelName}] [${this.name}]`;

        // For MCP servers, all logs should go to stderr to avoid
        // interfering with the JSON-RPC communication on stdout
        console.error(prefix, message, ...args);

        // Force flush in non-TTY environments (like CI)
        if (!process.stderr.isTTY && process.stderr.write) {
            process.stderr.write('');
        }
    }

    error(message: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    setLevel(level: LogLevel): void {
        this.level = level;
    }
}

// Global logger instance
export const logger = new Logger('MCP');

// Set log level from environment
const envLevel = process.env.LOG_LEVEL?.toUpperCase();
if (envLevel && envLevel in LogLevel) {
    logger.setLevel(
        LogLevel[envLevel as keyof typeof LogLevel] as unknown as LogLevel
    );
}
