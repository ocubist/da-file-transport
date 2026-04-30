import SonicBoom from "sonic-boom";
import type { LogEntry, LogLevel, Transport } from "@ocubist/diagnostics-alchemy";

/**
 * Options for `createFileTransport`.
 */
export interface FileTransportOptions {
  /** Absolute or relative path to the log file. Parent directories are created automatically. */
  path: string;

  /**
   * Write synchronously on every entry. Safer under sudden process termination,
   * but slower under high log volume. Default: `false`.
   */
  sync?: boolean;

  /**
   * Minimum log level this transport will write.
   * Entries below this level are skipped. Default: `"info"`.
   */
  minLevel?: LogLevel;
}

/**
 * Creates a file transport for use with `useLogger`'s `transports` option.
 *
 * Writes newline-delimited JSON (`LogEntry` objects) to the given file path
 * using SonicBoom — buffered async writes with a safe synchronous flush on exit.
 *
 * **Node.js only** — throws immediately if called in a browser environment.
 *
 * @example
 * import { useLogger } from "@ocubist/diagnostics-alchemy";
 * import { createFileTransport } from "@ocubist/da-file-transport";
 *
 * const log = useLogger({
 *   transports: [createFileTransport({ path: "logs/app.log" })],
 * });
 */
export const createFileTransport = (options: FileTransportOptions): Transport => {
  if ((globalThis as Record<string, unknown>)["window"] !== undefined) {
    throw new Error(
      "@ocubist/da-file-transport: createFileTransport() is Node.js-only. " +
      "File system access is not available in browser environments."
    );
  }

  const boom = new SonicBoom({
    dest: options.path,
    sync: options.sync ?? false,
    mkdir: true,
  });

  // Guard against double-flush: SIGINT calls flush() then process.exit(0),
  // which re-triggers the "exit" event — flushSync on an already-destroyed
  // SonicBoom throws. The closed flag makes flush() a safe no-op after first call.
  let closed = false;
  const flush = () => {
    if (closed) return;
    closed = true;
    try { boom.flushSync(); } catch { /* already destroyed */ }
    try { boom.destroy(); } catch { /* already destroyed */ }
  };
  process.once("exit",   flush);
  process.once("SIGINT",  () => { flush(); process.exit(0); });
  process.once("SIGTERM", () => { flush(); process.exit(0); });

  return {
    write: (entry: LogEntry): void => {
      boom.write(JSON.stringify(entry) + "\n");
    },
    minLevel: options.minLevel ?? "info",
  };
};
