# Agent Notes — @ocubist/da-file-transport

## What this package is

A minimal Node.js-only file transport plugin for `@ocubist/diagnostics-alchemy`.
It exists as a separate package so that `sonic-boom` (a Node.js file stream library)
is never installed in browser-only projects that use the main logger.

## Package structure

```
src/
  index.ts          — single export: createFileTransport()
dist/               — built output (ESM, .d.ts, sourcemaps)
```

One source file. One export. Keep it that way.

## Key design decisions

**Why a separate package, not a built-in transport?**
`sonic-boom` depends on Node.js built-ins (`fs`, `Buffer`, `util`). Including it in the
main `@ocubist/diagnostics-alchemy` package causes browser bundlers (Vite, webpack) to
fail with `Buffer is not defined` even when file logging is never used. A separate package
means browser consumers never touch it.

**Why `callbackFunctions`, not a custom `Transport`?**
`callbackFunctions` is already the extensibility API on `useLogger`. The transport interface
is internal. Using callbacks keeps the plugin simple and decoupled — it receives `LogEntry`
objects and writes them; it doesn't need to know about log levels, stdout, or anything else.

**Why `process.once` instead of `process.on`?**
`process.on` accumulates listeners across multiple `createFileTransport` calls (e.g. in tests).
`process.once` fires at most once per signal per file transport instance.

**Why throw at call time, not log time?**
Failing at `createFileTransport({ path })` gives a clear stack trace pointing to the
misconfigured call site. Failing silently at log time (or throwing inside a callback) is
much harder to debug.

## Dependencies

- `sonic-boom` — runtime dependency, the only one. Do not add others.
- `@ocubist/diagnostics-alchemy` — peer + devDependency (for the `LogEntry` type).
  Marked as `external` in tsup so it is never bundled into the output.

## Building

```bash
npm run build      # tsup → dist/index.js + dist/index.d.ts
npm run typecheck  # tsc --noEmit
```

## Releasing

This package does not yet have its own release script. To publish manually:

```bash
npm run build
npm publish --access public
```

A release script matching the one in `diagnostics-alchemy` should be added before
the first automated release.

## What NOT to do

- Do not add browser-compatible fallbacks — this package is intentionally Node.js-only.
- Do not import anything from `diagnostics-alchemy` at runtime (only `import type`).
- Do not bundle `sonic-boom` (it is listed in `dependencies`, not inlined by tsup).
- Do not add a `logOutput`-style option — filtering is the logger's responsibility,
  not the transport's.
