export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export function consoleLogger(prefix = "[actionlens]"): Logger {
  return {
    debug: (m, ...a) => console.debug(prefix, m, ...a),
    info: (m, ...a) => console.info(prefix, m, ...a),
    warn: (m, ...a) => console.warn(prefix, m, ...a),
    error: (m, ...a) => console.error(prefix, m, ...a),
  };
}
