import { describe, it, expect, afterEach } from "vitest";
import { createFileTransport } from "../src/index";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LogEntry } from "@ocubist/diagnostics-alchemy";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const tmpFile = (name: string) => join(tmpdir(), `da-file-transport-test-${name}.log`);

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  level: "info",
  time: 1_000_000,
  message: "test message",
  ...overrides,
});

const readLines = (path: string): LogEntry[] =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LogEntry);

// ─── Cleanup ──────────────────────────────────────────────────────────────────

const created: string[] = [];
afterEach(() => {
  for (const f of created) {
    if (existsSync(f)) rmSync(f);
  }
  created.length = 0;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createFileTransport — basic", () => {
  it("returns a function", () => {
    const path = tmpFile("returns-fn");
    created.push(path);
    const cb = createFileTransport({ path, sync: true });
    expect(typeof cb).toBe("function");
  });

  it("creates the log file on initialisation", () => {
    const path = tmpFile("creates-file");
    created.push(path);
    createFileTransport({ path, sync: true });
    // SonicBoom opens the fd immediately — file exists after createFileTransport returns
    expect(existsSync(path)).toBe(true);
  });

  it("writes a valid JSON line per entry", () => {
    const path = tmpFile("valid-json");
    created.push(path);
    const cb = createFileTransport({ path, sync: true });
    cb(makeEntry({ message: "hello" }));
    const [line] = readLines(path);
    expect(line).toBeDefined();
    expect(line!.message).toBe("hello");
    expect(line!.level).toBe("info");
    expect(line!.time).toBe(1_000_000);
  });

  it("writes multiple entries as separate lines", () => {
    const path = tmpFile("multi-entries");
    created.push(path);
    const cb = createFileTransport({ path, sync: true });
    cb(makeEntry({ message: "first" }));
    cb(makeEntry({ message: "second" }));
    cb(makeEntry({ message: "third" }));
    const lines = readLines(path);
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.message)).toEqual(["first", "second", "third"]);
  });

  it("preserves all LogEntry fields", () => {
    const path = tmpFile("all-fields");
    created.push(path);
    const cb = createFileTransport({ path, sync: true });
    cb(makeEntry({
      level: "warn",
      where: "app.auth",
      why: "session",
      payload: { userId: "u1", code: 42 },
    }));
    const [line] = readLines(path);
    expect(line!.level).toBe("warn");
    expect(line!.where).toBe("app.auth");
    expect(line!.why).toBe("session");
    expect(line!.payload).toEqual({ userId: "u1", code: 42 });
  });

  it("all five log levels are written correctly", () => {
    const path = tmpFile("all-levels");
    created.push(path);
    const cb = createFileTransport({ path, sync: true });
    for (const level of ["debug", "info", "warn", "error", "fatal"] as const) {
      cb(makeEntry({ level }));
    }
    const lines = readLines(path);
    expect(lines.map((l) => l.level)).toEqual(["debug", "info", "warn", "error", "fatal"]);
  });

  it("creates parent directories automatically", () => {
    const path = tmpFile("nested/deep/app.log");
    created.push(path);
    // mkdir: true in SonicBoom should handle this
    const cb = createFileTransport({ path, sync: true });
    cb(makeEntry());
    expect(existsSync(path)).toBe(true);
  });
});

describe("createFileTransport — browser guard", () => {
  it("throws immediately when window is defined", () => {
    const g = globalThis as Record<string, unknown>;
    g["window"] = {};
    try {
      expect(() => createFileTransport({ path: "/irrelevant" })).toThrow(
        "createFileTransport() is Node.js-only"
      );
    } finally {
      delete g["window"];
    }
  });

  it("does not throw when window is undefined (normal Node env)", () => {
    expect(() => createFileTransport({ path: tmpFile("no-throw") })).not.toThrow();
    created.push(tmpFile("no-throw"));
  });
});
