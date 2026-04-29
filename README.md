# @ocubist/da-file-transport

File transport plugin for [`@ocubist/diagnostics-alchemy`](https://www.npmjs.com/package/@ocubist/diagnostics-alchemy).

Writes newline-delimited JSON log entries to disk via [SonicBoom](https://github.com/mcollina/sonic-boom) — buffered async writes with a safe synchronous flush on process exit.

**Node.js only.** Throws immediately if called in a browser environment.

```
npm install @ocubist/da-file-transport
```

---

## Usage

Pass the result of `createFileTransport` as a transport to `useLogger`:

```typescript
import { useLogger } from "@ocubist/diagnostics-alchemy";
import { createFileTransport } from "@ocubist/da-file-transport";

const log = useLogger({
  transports: [
    createFileTransport({ path: "logs/app.log" }),
  ],
});

log.info("Server started", { payload: { port: 3000 } });
// → logs/app.log receives: {"level":"info","time":1234567890,"message":"Server started","payload":{"port":3000}}
```

### Combine with stdout

The console transport is included by default. The file transport runs alongside it — both fire on every log entry:

```typescript
const log = useLogger({
  where: "api",
  transports: [
    createFileTransport({ path: "logs/api.log" }),
  ],
});
```

### File only (no console output)

```typescript
const log = useLogger({
  console: false,
  transports: [
    createFileTransport({ path: "logs/app.log" }),
  ],
});
```

### Multiple files

```typescript
const log = useLogger({
  transports: [
    createFileTransport({ path: "logs/app.log" }),
    createFileTransport({ path: "logs/errors.log" }), // receives all levels
  ],
});
```

---

## Options

```typescript
createFileTransport(options: FileTransportOptions): (entry: LogEntry) => void
```

| Option | Type | Default | Description |
|---|---|---|---|
| `path` | `string` | — | File path to write to. Parent directories are created automatically. |
| `sync` | `boolean` | `false` | Write synchronously on every entry. Safer under sudden process termination, slower under high log volume. |

---

## How it works

- Uses **SonicBoom** internally — a high-performance async write stream designed for logging.
- Each `LogEntry` is serialized as a single JSON line (`\n`-delimited).
- Registers `process.once("exit" | "SIGINT" | "SIGTERM")` handlers to flush and close the stream before the process exits, preventing log loss.
- Throws at **call time** (not log time) if a `window` global is detected — fail fast, not silently.

---

## Requirements

- Node.js ≥ 20
- `@ocubist/diagnostics-alchemy` ≥ 0.2.0 (peer dependency)
