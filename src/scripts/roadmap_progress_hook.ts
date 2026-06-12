#!/usr/bin/env node
/**
 * Platform-agnostic PostToolUse hook for the `roadmap-progress-sync` rule.
 *
 * TypeScript twin of `src/scripts/roadmap_progress_hook.py` (ADR-089 —
 * Python→TS migration, Phase 6 / hooks). Public API mirrors the Python
 * module exactly (snake_case kept deliberately — fidelity over TS idiom).
 *
 * Reads a JSON event from stdin (Augment / Claude / Cursor / Cline /
 * Windsurf / Gemini PostToolUse-shaped envelopes), decides whether the
 * tool call wrote to a roadmap file under `agents/roadmaps/`, and — when
 * it did — re-runs `update_roadmap_progress.py` so the dashboard stays
 * in sync without depending on agent self-discipline.
 *
 * The regenerator the hook re-shells to is the GENERATED Python script
 * (`update_roadmap_progress.py`) shipped under `.augment/scripts/`,
 * `dist/agent-src/scripts/`, or `.agent-src.uncondensed/scripts/`. The
 * Python original runs it via `sys.executable`; the TS twin runs it via
 * `python3` (the only divergence — a `.py` regenerator cannot run under
 * node/tsx). Its golden-parity test therefore skips when no project-local
 * `.augment/` regenerator is present (and when python3 is absent).
 *
 * Exit code is **always 0**. Hooks must never block the agent loop; the
 * worst-case is a no-op when stdin is malformed or the regenerator is
 * missing.
 *
 * Output discipline:
 *   - stdout: nothing (Augment would surface stdout to the user)
 *   - stderr: one short line in --verbose mode, otherwise silent
 *
 * CLI:
 *   roadmap_progress_hook.ts [--platform NAME] [--project-dir DIR] [--verbose]
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { log_dispatch_issue } from "./hooks/dispatch_issues.js";

export const REPLAY_ENV_VAR = "AGENT_CONFIG_REPLAY";

// Tools whose successful execution can write to a roadmap file. We keep
// the list explicit so an unknown tool name (e.g. a new MCP tool that
// happens to mention a roadmap path in its input) does not trigger a
// spurious regeneration.
export const WRITE_TOOLS: ReadonlySet<string> = new Set([
  "str-replace-editor",
  "save-file",
  "remove-files",
  // Claude Code / Cursor naming variants — kept for cross-platform
  // parity if this hook is ever wired beyond Augment.
  "Edit",
  "Write",
  "MultiEdit",
]);

export const ROADMAP_PREFIX = "agents/roadmaps/";
// Paths under these subtrees are tracked but not part of the open list
// the dashboard summarises — regenerating on every archived edit would
// be wasteful. The check still fires on the parent dir itself.
export const ROADMAP_EXCLUDED_PARTS: ReadonlySet<string> = new Set(["archive", "skipped"]);
export const DASHBOARD_PATH = "agents/roadmaps-progress.md";

export const REGEN_NAME = "update_roadmap_progress.py";
// Distributed-content script subtrees that may ship the regenerator,
// in priority order. Project-scoped installs land it under .augment/ or
// dist/agent-src/; the package itself carries the same projection.
export const DIST_SCRIPT_SUBDIRS = [
  path.join(".augment", "scripts"),
  path.join("dist/agent-src", "scripts"),
  path.join(".agent-src.uncondensed", "scripts"),
];
// Set by the dispatcher (scripts/hooks/dispatch_hook) to its own resolved
// package root, so a globally-installed binary (ADR-020 global-only) can
// locate the shipped regenerator even when the consumer repo carries no
// project-local distributed content.
export const PACKAGE_ROOT_ENV_VAR = "AGENT_CONFIG_PACKAGE_ROOT";

const __filename = fileURLToPath(import.meta.url);

type JsonObject = Record<string, unknown>;

/** Pull every plausible file path out of a PostToolUse payload. */
export function _candidate_paths(payload: JsonObject): string[] {
  const out: string[] = [];
  const fc = payload["file_changes"];
  if (Array.isArray(fc)) {
    for (const entry of fc) {
      if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
        const p = (entry as JsonObject)["path"];
        if (typeof p === "string" && p) {
          out.push(p);
        }
      }
    }
  }
  const ti = payload["tool_input"];
  if (typeof ti === "object" && ti !== null && !Array.isArray(ti)) {
    for (const key of ["path", "file_path", "target_file"]) {
      const v = (ti as JsonObject)[key];
      if (typeof v === "string" && v) {
        out.push(v);
      }
    }
  }
  return out;
}

/**
 * Make an absolute path project-relative so the `agents/roadmaps/` prefix
 * check fires.
 *
 * Claude Code passes an absolute `tool_input.file_path`
 * (`/Users/.../<repo>/agents/roadmaps/x.md`); Augment passes a repo-relative
 * one. Without this, an absolute path never matches the relative prefix and
 * the hook silently no-ops. Already-relative paths and out-of-tree paths are
 * returned unchanged — an out-of-tree roadmap correctly fails the prefix
 * check downstream.
 */
export function _relativize(p: string, root: string): string {
  if (!path.isAbsolute(p)) {
    return p;
  }
  try {
    const resolvedRoot = fs.realpathSync(root);
    const resolvedP = fs.realpathSync(p);
    const rel = path.relative(resolvedRoot, resolvedP);
    // Python relative_to() raises ValueError when p is not under root;
    // path.relative emits a `..`-prefixed (or absolute) result instead.
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
      return p;
    }
    return rel;
  } catch {
    // realpath can fail on a not-yet-existing path. Fall back to a
    // lexical resolve so the in-tree prefix check still fires (Python's
    // Path.resolve() is non-strict and never raises here).
    try {
      const resolvedRoot = path.resolve(root);
      const resolvedP = path.resolve(p);
      const rel = path.relative(resolvedRoot, resolvedP);
      if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
        return p;
      }
      return rel;
    } catch {
      return p;
    }
  }
}

/** Return True if `path` is a roadmap file we should react to. */
export function _is_roadmap_touch(p: string): boolean {
  // Python str.lstrip("./") strips any leading run of chars in {'.', '/'}.
  const norm = p.replace(/^[./]+/, "").replace(/\\/g, "/");
  if (!norm.startsWith(ROADMAP_PREFIX)) {
    return false;
  }
  if (norm === DASHBOARD_PATH) {
    // Defensive — the dashboard sits at agents/roadmaps-progress.md,
    // NOT inside agents/roadmaps/. The prefix check above already
    // excludes it, but keep this explicit so a future relocation
    // cannot turn the hook into an infinite loop.
    return false;
  }
  const rest = norm.slice(ROADMAP_PREFIX.length);
  const parts = rest.split("/");
  if (parts.length >= 2 && parts[0] !== undefined && ROADMAP_EXCLUDED_PARTS.has(parts[0])) {
    return false;
  }
  if (!norm.endsWith(".md")) {
    return false;
  }
  return true;
}

/**
 * Package roots to search for the shipped regenerator, in priority order,
 * when the consumer carries no project-local copy.
 *
 * 1. ``AGENT_CONFIG_PACKAGE_ROOT`` — the dispatcher passes its own
 *    resolved package root.
 * 2. This hook's own location (``<pkg>/src/scripts/roadmap_progress_hook.ts``
 *    → ``<pkg>/src``) — last-resort fallback for standalone invocation.
 *    Mirrors the Python `Path(__file__).resolve().parent.parent` walk.
 */
export function _package_roots(): string[] {
  const roots: string[] = [];
  const env_root = (process.env[PACKAGE_ROOT_ENV_VAR] ?? "").trim();
  if (env_root) {
    roots.push(_expanduser(env_root));
  }
  roots.push(path.dirname(path.dirname(path.resolve(__filename))));
  return roots;
}

function _expanduser(p: string): string {
  if (p === "~" || p.startsWith("~/")) {
    const home = process.env["HOME"] ?? process.env["USERPROFILE"] ?? "";
    return home ? path.join(home, p.slice(1)) : p;
  }
  return p;
}

/**
 * Find the regenerator script. Project-local copy first, then the package
 * the hook itself ships in. Returns ``null`` only when no copy exists.
 *
 * Indirection via a module-level binding so tests can override
 * `_package_roots` (matches the Python monkeypatch on `rph._package_roots`).
 */
export function _resolve_regenerator(consumer_root: string): string | null {
  for (const subdir of DIST_SCRIPT_SUBDIRS) {
    const candidate = path.join(consumer_root, subdir, REGEN_NAME);
    if (_isFile(candidate)) {
      return candidate;
    }
  }
  for (const root of _module._package_roots()) {
    for (const subdir of DIST_SCRIPT_SUBDIRS) {
      const candidate = path.join(root, subdir, REGEN_NAME);
      if (_isFile(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

// Mutable binding object so the parity/unit tests can swap `_package_roots`
// (parallels Python's `monkeypatch.setattr(rph, "_package_roots", ...)`).
export const _module = { _package_roots };

function _isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function run(
  stdin_text: string,
  options: { consumer_root: string; verbose?: boolean },
): number {
  const { consumer_root } = options;
  const verbose = options.verbose ?? false;

  let payload: JsonObject = {};
  if (stdin_text.trim()) {
    try {
      const decoded = JSON.parse(stdin_text) as unknown;
      if (typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)) {
        payload = decoded as JsonObject;
      }
    } catch {
      return 0; // malformed stdin → silent no-op, never block
    }
  }

  // Unwrap dispatcher envelope (Phase 7.3, hook-architecture-v1.md).
  if (["schema_version", "platform", "event", "payload"].every((k) => k in payload)) {
    const inner = payload["payload"];
    payload =
      typeof inner === "object" && inner !== null && !Array.isArray(inner)
        ? (inner as JsonObject)
        : {};
  }

  const tool = payload["tool_name"] || payload["toolName"] || payload["tool"];
  if (!(typeof tool === "string" && WRITE_TOOLS.has(tool))) {
    return 0;
  }

  const paths = _candidate_paths(payload).map((p) => _relativize(p, consumer_root));
  if (!paths.some((p) => _is_roadmap_touch(p))) {
    return 0;
  }

  const script = _resolve_regenerator(consumer_root);
  if (script === null) {
    // Phase 1 of road-to-hooks-actually-fire-in-consumers: log dispatch
    // issue directly (this hook runs as a subprocess from the universal
    // dispatcher; routing through the dispatcher would add latency for
    // no benefit).
    try {
      log_dispatch_issue(
        consumer_root,
        "roadmap-progress",
        "prerequisite_missing",
        "update_roadmap_progress.py not found at any of: " +
          ".augment/scripts/, dist/agent-src/scripts/, " +
          "src/agent-src/scripts/",
        "./agent-config hooks:install --regen " + "(or ./agent-config init)",
      );
    } catch {
      // observability never breaks the hook
    }
    if (verbose) {
      process.stderr.write("roadmap-progress-hook: regenerator not found, skipping\n");
    }
    return 0;
  }

  // Replay mode (`AGENT_CONFIG_REPLAY=1`) skips the regenerator subprocess
  // so fixture dispatches never rewrite agents/roadmaps-progress.md.
  if ((process.env[REPLAY_ENV_VAR] ?? "").trim() === "1") {
    if (verbose) {
      process.stderr.write("roadmap-progress-hook: replay mode, skipping regenerator\n");
    }
    return 0;
  }

  try {
    // The regenerator is a Python script; run it via python3 (the Python
    // original uses sys.executable — the documented TS divergence).
    spawnSync("python3", [script], {
      cwd: consumer_root,
      stdio: ["ignore", "ignore", "ignore"],
      timeout: 30000,
    });
  } catch {
    // never propagate regenerator failures into the agent loop
  }

  if (verbose) {
    process.stderr.write(`roadmap-progress-hook: regenerated for tool=${tool}\n`);
  }
  return 0;
}

interface ParsedArgs {
  platform: string;
  project_dir: string;
  verbose: boolean;
}

function parse_args(argv: string[]): ParsedArgs {
  let platform = "generic";
  let project_dir = "";
  let verbose = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--platform") {
      platform = argv[i + 1] ?? "generic";
      i += 1;
    } else if (arg !== undefined && arg.startsWith("--platform=")) {
      platform = arg.slice("--platform=".length);
    } else if (arg === "--project-dir") {
      project_dir = argv[i + 1] ?? "";
      i += 1;
    } else if (arg !== undefined && arg.startsWith("--project-dir=")) {
      project_dir = arg.slice("--project-dir=".length);
    } else if (arg === "--verbose") {
      verbose = true;
    }
  }
  return { platform, project_dir, verbose };
}

function _readStdin(): string {
  try {
    return fs.readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

export function main(argv?: string[]): number {
  const args = parse_args(argv ?? process.argv.slice(2));
  const root = args.project_dir ? _expanduser(args.project_dir) : process.cwd();
  return run(_readStdin(), { consumer_root: root, verbose: args.verbose });
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main(process.argv.slice(2)));
}
