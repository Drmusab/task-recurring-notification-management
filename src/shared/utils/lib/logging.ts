/**
 * Log levels for the logging system.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Options for configuring the logging system.
 */
export interface LoggingOptions {
    minLevels?: Record<string, LogLevel>;
}

/**
 * Logger interface for structured logging.
 */
export interface Logger {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}

/**
 * Simple console logger implementation.
 */
class ConsoleLogger implements Logger {
    constructor(private readonly name: string) {}

    debug(message: string, ...args: unknown[]): void {
        console.debug(`[${this.name}]`, message, ...args);
    }

    info(message: string, ...args: unknown[]): void {
        console.info(`[${this.name}]`, message, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        console.warn(`[${this.name}]`, message, ...args);
    }

    error(message: string, ...args: unknown[]): void {
        console.error(`[${this.name}]`, message, ...args);
    }
}

/**
 * No-op logger for when logging is disabled.
 */
class NoopLogger implements Logger {
    debug(): void {}
    info(): void {}
    warn(): void {}
    error(): void {}
}

let consoleLoggingEnabled = false;

/**
 * Main logging utility object.
 */
export const logging = {
    /**
     * Register console as a log output.
     */
    registerConsoleLogger(): void {
        consoleLoggingEnabled = true;
    },

    /**
     * Configure logging with the given options.
     * @param _options - Logging options (currently unused in minimal implementation)
     */
    configure(_options: LoggingOptions): void {
        // Minimal implementation - options can be extended later
    },

    /**
     * Get a logger instance for the given name.
     * @param name - Logger name/category
     * @returns Logger instance
     */
    getLogger(name: string): Logger {
        if (consoleLoggingEnabled) {
            return new ConsoleLogger(name);
        }
        return new NoopLogger();
    },
};

/**
 * Simple log function for quick logging.
 * @param level - Log level
 * @param message - Message to log
 * @param args - Additional arguments
 */
export function log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!consoleLoggingEnabled) {
        return;
    }

    const prefix = '[Tasks]';
    switch (level) {
        case 'debug':
            console.debug(prefix, message, ...args);
            break;
        case 'info':
            console.info(prefix, message, ...args);
            break;
        case 'warn':
            console.warn(prefix, message, ...args);
            break;
        case 'error':
            console.error(prefix, message, ...args);
            break;
    }
}
