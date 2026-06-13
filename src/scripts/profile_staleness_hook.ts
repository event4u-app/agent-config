#!/usr/bin/env node
/**
 * Session-profile staleness notice — `session_start` hook.
 *
 * TypeScript twin of `src/scripts/profile_staleness_hook.py` (ADR-092 —
 * Python→TS migration, Phase 6 / hooks). Public API mirrors the Python
 * module exactly (snake_case kept deliberately — fidelity over TS idiom).
 *
 * Phase 1 companion to the locked Phase-0.1 decision (option a, explicit
 * `/profile deactivate`). The `runtime.active_packs` overlay survives an IDE
 * restart, so this hook does **not** reset it — it only surfaces a one-line
 * **staleness notice** when a new session starts with an overlay carried over
 * from a previous session. Silently resetting on `session_start` is the
 * registry-refresh Catch-22 the council ruled out (see
 * `agents/settings/contexts/session-host-capability-audit.md`).
 *
 * Contract: never blocks. Reads the JSON envelope on stdin (ignored — the
 * notice is derived from the overlay file), emits at most one stderr line,
 * returns 0 on every path.
 *
 * NOTE (ADR-092): the Python original imports `scripts.config.session_profiles`,
 * which is UNPORTED. The only entry point this hook touches is
 * `session_profiles.stale_notice(root)`, a fail-open read of the overlay file
 * (`agents/settings/.agent-settings.local.yml` → `runtime.active_packs`) plus a
 * format string. That narrow slice is inlined here as `_stale_notice` so the
 * hook stays dependency-free and crash-safe rather than re-shelling to python3
 * inside a never-block session_start concern.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

import {
  LOCAL_PROJECT_FILE,
  LOCAL_PROJECT_SUBDIR,
} from "./_lib/agent_settings.js";

// --- inlined session_profiles.stale_notice slice (unported dep) ----------

const OVERLAY_SECTION = "runtime";
const OVERLAY_KEY = "active_packs";

function _isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Fail-open YAML read — any problem returns null (mirrors `_read_yaml`). */
function _read_yaml(p: string): unknown {
  try {
    if (!fs.existsSync(p)) {
      return null;
    }
    return parseYaml(fs.readFileSync(p, "utf-8"), { version: "1.1" });
  } catch {
    return null;
  }
}

function _overlay_path(repo_root: string): string {
  return path.join(repo_root, ...LOCAL_PROJECT_SUBDIR, LOCAL_PROJECT_FILE);
}

/**
 * Return the active pack list. **Fail-open**: any problem → `[]`.
 *
 * Schema: `runtime.active_packs` must be a list of strings. Anything else
 * (missing, wrong type, unparseable file) yields an empty list so a corrupt
 * overlay never hides the full surface.
 */
function _read_overlay(repo_root: string): string[] {
  const data = _read_yaml(_overlay_path(repo_root));
  if (!_isObject(data)) {
    return [];
  }
  const runtime = data[OVERLAY_SECTION];
  if (!_isObject(runtime)) {
    return [];
  }
  const packs = runtime[OVERLAY_KEY];
  if (!Array.isArray(packs)) {
    return [];
  }
  // Python keeps str/int members and stringifies them.
  return packs
    .filter((p) => typeof p === "string" || typeof p === "number")
    .map((p) => String(p));
}

/**
 * Return the `session_start` staleness notice, or `null` if no overlay.
 *
 * Implements option (a)'s companion: the overlay survives a restart, so on
 * a new session we *remind* (never silently reset).
 */
function _stale_notice(repo_root: string): string | null {
  const active = _read_overlay(repo_root);
  if (active.length === 0) {
    return null;
  }
  return (
    `profile still active from a previous session: ${active.join(", ")} ` +
    "— `/profile deactivate` to clear, `/profile show` for details."
  );
}

// --- hook body -----------------------------------------------------------

function _project_root(): string {
  const env =
    process.env["CLAUDE_PROJECT_DIR"] ||
    process.env["AGENT_CONFIG_PROJECT_DIR"];
  if (env) {
    return env;
  }
  return process.cwd();
}

function _readStdinIfNotTty(): void {
  try {
    if (!process.stdin.isTTY) {
      fs.readFileSync(0, "utf-8");
    }
  } catch {
    /* ignore */
  }
}

function _parseRoot(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      return argv[i + 1] ?? null;
    }
    if (arg !== undefined && arg.startsWith("--root=")) {
      return arg.slice("--root=".length);
    }
  }
  return null;
}

export function main(argv?: string[]): number {
  const args = argv ?? process.argv.slice(2);
  const rootArg = _parseRoot(args);

  // Drain stdin (the dispatcher passes a JSON envelope); we do not need it.
  _readStdinIfNotTty();

  const root = rootArg !== null ? rootArg : _project_root();
  let notice: string | null;
  try {
    notice = _stale_notice(root);
  } catch {
    return 0; // fail-open — never block the session
  }

  if (notice) {
    process.stderr.write(`[profile] ${notice}\n`);
  }
  return 0;
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main(process.argv.slice(2)));
}
