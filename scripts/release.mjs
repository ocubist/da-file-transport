#!/usr/bin/env node
/**
 * Release script for @ocubist/da-file-transport
 *
 * Usage:
 *   node scripts/release.mjs [segment] [flags]
 *
 * segment (default: patch):
 *   major | minor | patch
 *
 * flags:
 *   --skip-bump   Skip the version bump and commit on dev.
 *                 Use when you've already bumped the version manually.
 *   --push-dev    Also push dev to origin after pushing main.
 *
 * Examples:
 *   node scripts/release.mjs              # bump patch
 *   node scripts/release.mjs minor        # bump minor, reset patch to 0
 *   node scripts/release.mjs major        # bump major, reset minor + patch to 0
 *   node scripts/release.mjs --skip-bump  # skip bump, use current version
 *   node scripts/release.mjs --push-dev   # bump patch + push dev at the end
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─── Parse arguments ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const VALID_SEGMENTS = ["major", "minor", "patch"];
const segment = args.find((a) => VALID_SEGMENTS.includes(a)) ?? "patch";
const skipBump = args.includes("--skip-bump");
const pushDev = args.includes("--push-dev");

const unknownArgs = args.filter(
  (a) => !VALID_SEGMENTS.includes(a) && !["--skip-bump", "--push-dev"].includes(a)
);
if (unknownArgs.length > 0) {
  console.error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  console.error("Usage: node scripts/release.mjs [major|minor|patch] [--skip-bump] [--push-dev]");
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const run = (cmd) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: ROOT });
};

const readPkg = () =>
  JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));

const abort = (msg, cleanup) => {
  console.error(`\n✖  ${msg}`);
  if (cleanup) cleanup();
  process.exit(1);
};

// ─── Pre-flight checks ────────────────────────────────────────────────────────

const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT })
  .toString()
  .trim();

if (currentBranch !== "dev") {
  abort(`Release must be run from 'dev'. Currently on '${currentBranch}'.`);
}

const status = execSync("git status --porcelain", { cwd: ROOT }).toString().trim();
if (status !== "") {
  abort("Working tree is not clean. Commit or stash your changes before releasing.");
}

// ─── Step 1: Run tests ────────────────────────────────────────────────────────

console.log("\n── Step 1: Running tests ───────────────────────────────────────");
try {
  run("npm test");
} catch {
  abort("Tests failed. Nothing was changed.");
}

// ─── Step 2: Bump version on dev (unless --skip-bump) ────────────────────────

let version;

if (skipBump) {
  version = readPkg().version;
  console.log(`\n── Step 2: Skipping version bump (current: v${version}) ──────────`);
} else {
  console.log(`\n── Step 2: Bumping ${segment} version ──────────────────────────────`);

  const pkg = readPkg();
  const parts = pkg.version.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    abort(`Cannot parse version '${pkg.version}' — expected major.minor.patch`);
  }

  let [major, minor, patch] = parts;
  if (segment === "major") { major += 1; minor = 0; patch = 0; }
  else if (segment === "minor") { minor += 1; patch = 0; }
  else { patch += 1; }

  version = `${major}.${minor}.${patch}`;
  pkg.version = version;

  writeFileSync(
    resolve(ROOT, "package.json"),
    JSON.stringify(pkg, null, 2) + "\n"
  );

  console.log(`   ${parts.join(".")} → ${version}`);
  run("git add package.json");
  run(`git commit -m "chore: release v${version}"`);
}

// ─── Step 3: Merge dev into main ─────────────────────────────────────────────

console.log("\n── Step 3: Merging dev into main ───────────────────────────────");

try {
  run("git checkout main");
} catch {
  abort("Failed to switch to main.", () => {
    execSync("git checkout dev", { cwd: ROOT, stdio: "inherit" });
  });
}

try {
  run(`git merge dev --no-ff -m "Release v${version}"`);
} catch {
  abort("Merge failed.", () => {
    try { execSync("git merge --abort", { cwd: ROOT, stdio: "inherit" }); } catch {}
    execSync("git checkout dev", { cwd: ROOT, stdio: "inherit" });
  });
}

// ─── Step 4: Push main ───────────────────────────────────────────────────────

console.log("\n── Step 4: Pushing main ────────────────────────────────────────");
try {
  run("git push origin main");
} catch {
  abort("Failed to push main. The local merge succeeded — you may push manually.", () => {
    execSync("git checkout dev", { cwd: ROOT, stdio: "inherit" });
  });
}

// ─── Step 5: Switch back to dev ──────────────────────────────────────────────

console.log("\n── Step 5: Switching back to dev ───────────────────────────────");
run("git checkout dev");

// ─── Step 6: Optionally push dev ─────────────────────────────────────────────

if (pushDev) {
  console.log("\n── Step 6: Pushing dev ─────────────────────────────────────────");
  run("git push origin dev");
} else {
  console.log("\n── Step 6: Skipping dev push (use --push-dev to include it) ───");
}

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log(`\n✓  Released v${version} — main is pushed, CI will run tests and publish to npm.\n`);
