import SonicBoom from "sonic-boom";
import type { LogEntry } from "@ocubist/diagnostics-alchemy";

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
}

/**
 * Creates a file-transport callback for use with `useLogger`'s `callbackFunctions`.
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
 *   callbackFunctions: [createFileTransport({ path: "logs/app.log" })],
 * });
 */
export const createFileTransport = (
  options: FileTransportOptions
): ((entry: LogEntry) => void) => {
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

  const flush = () => { boom.flushSync(); boom.destroy(); };
  process.once("exit",   flush);
  process.once("SIGINT",  () => { flush(); process.exit(0); });
  process.once("SIGTERM", () => { flush(); process.exit(0); });

  return (entry: LogEntry): void => {
    boom.write(JSON.stringify(entry) + "\n");
  };
};
