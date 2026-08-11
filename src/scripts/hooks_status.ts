#!/usr/bin/env node
/**
 * Print the runtime hook matrix per `docs/contracts/hook-architecture-v1.md`.
 *
 * Ported from the retired Python `src/scripts/hooks_status.py` (ADR-200 — Python→TS
 * migration, Phase 6 / hooks). Public API mirrors the Python module
 * exactly (snake_case kept deliberately — fidelity over TS idiom). Ported
 * here as a dependency of `hooks_doctor.ts`, which wraps `collect`,
 * `_render_table`, `_final_exit_code`, and reads `PLATFORM_BRIDGES`.
 *
 * For each platform in `scripts/hook_manifest.yaml`, prints whether the
 * project-scope bridge files exist on disk, which (event → concerns)
 * bindings the manifest declares, and a one-line install hint when the
 * bridge is missing. Copilot has no native hook surface — its row carries
 * the `degraded: rule-only fallback` marker per Phase 7.12 / Round 2.
 *
 * This is a **read-only** report. It never installs, modifies, or fires
 * anything; that is the contract callers depend on (`task hooks-status`,
 * post-install smoke, CI).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  type JsonObject,
  type JsonValue,
  _load_yaml,
} from "./hooks/dispatch_hook.js";
// The confirmation store lives in the work_engine tree because that is where
// its only (injected) producer lives; importing it across the package/template
// boundary follows the committed precedent in `lint_ui_stack_bundles.ts`.
import {
  listPending,
  type StagedAction,
} from "../agent-src/templates/scripts/work_engine/hooks/builtin/confirmation.js";

// src/scripts/hooks_status.ts → parents[1] is the repo root (.../parents[2]
// in the Python which lives one level deeper relative computation).
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
// `dispatch_hook.MANIFEST_PATH` is not exported from the TS twin; re-derive
// it the same way (REPO_ROOT/src/scripts/hook_manifest.yaml).
const MANIFEST_PATH = path.join(
  REPO_ROOT,
  "src",
  "scripts",
  "hook_manifest.yaml",
);

// (label, project-relative bridge path, install hint).
// Path may be a directory (cline) — existence => any file inside.
//
// Cowork has no project-scope bridge path: the Claude desktop app's
// local-agent-mode runtime is upstream-blocked from reading any of
// Claude Code's three settings sources (anthropics/claude-code#40495,
// #27398). We register cowork here so the manifest's `cowork:`
// bindings are surfaced in the status report, but the empty bridge
// path resolves to status="n/a" — strict mode does not fail on
// n/a (see _final_exit_code), matching Copilot's no-bridge posture.
// Once upstream lands the fix and a stable settings location is
// documented, swap the empty path here for that location.
export const PLATFORM_BRIDGES: Record<string, [string, string]> = {
  augment: [".augment/settings.json", "src/scripts/install.py"],
  claude: [".claude/settings.json", "src/scripts/install.py"],
  cowork: [
    "",
    "upstream-blocked: anthropics/claude-code#40495 + #27398 (settings.json ignored in Cowork sandbox)",
  ],
  cursor: [".cursor/hooks.json", "src/scripts/install.py"],
  cline: [".clinerules/hooks", "src/scripts/install.py"],
  windsurf: [".windsurf/hooks.json", "src/scripts/install.py"],
  gemini: [".gemini/settings.json", "src/scripts/install.py"],
  copilot: ["", "rule-only fallback (no hook surface)"],
};

export interface PlatformRow {
  platform: string;
  status: string;
  bridge_path: string | null;
  fallback_only: boolean;
  bindings: Record<string, string[]>;
  hint: string | null;
}

export interface StatusMatrix {
  schema_version: number;
  platforms: PlatformRow[];
}

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function _bridge_status(project_root: string, rel_path: string): string {
  if (!rel_path) {
    return "n/a";
  }
  const target = path.join(project_root, rel_path);
  let stat: fs.Stats | null = null;
  try {
    stat = fs.statSync(target);
  } catch {
    stat = null;
  }
  if (stat && stat.isDirectory()) {
    try {
      return fs.readdirSync(target).length > 0 ? "installed" : "empty";
    } catch {
      return "empty";
    }
  }
  return stat && stat.isFile() ? "installed" : "missing";
}

/** Build the runtime matrix as a plain object — JSON-serialisable. */
export function collect(project_root: string, manifest: JsonObject): StatusMatrix {
  const platformsRaw = manifest["platforms"];
  const platforms = _isObject(platformsRaw) ? platformsRaw : {};
  const rows: PlatformRow[] = [];
  for (const platform of Object.keys(PLATFORM_BRIDGES)) {
    const [rel, hint] = PLATFORM_BRIDGES[platform] as [string, string];
    const blockRaw = platforms[platform];
    const block = _isObject(blockRaw) ? blockRaw : {};
    const fallback_only = Boolean(block["fallback_only"]);
    const bindings: Record<string, string[]> = {};
    if (!fallback_only) {
      for (const [ev, c] of Object.entries(block)) {
        if (Array.isArray(c)) {
          bindings[ev] = c.map((x) => String(x));
        }
      }
    }
    const status = fallback_only
      ? "degraded"
      : _bridge_status(project_root, rel);
    rows.push({
      platform,
      status,
      bridge_path: rel || null,
      fallback_only,
      bindings,
      hint: ["missing", "empty", "degraded", "n/a"].includes(status)
        ? hint
        : null,
    });
  }
  return { schema_version: 1, platforms: rows };
}

const _STATUS_MARKER: Record<string, string> = {
  installed: "✅ ",
  missing: "❌ ",
  empty: "⚠️  ",
  degraded: "⚠️  ",
  "n/a": "·  ",
};

export function _render_table(matrix: StatusMatrix): string {
  const lines: string[] = [];
  lines.push("agent-config hook matrix");
  lines.push("=".repeat(60));
  for (const row of matrix.platforms) {
    const marker = _STATUS_MARKER[row.status] ?? "?  ";
    let head = `${marker}${row.platform.padEnd(9)} ${row.status}`;
    if (row.bridge_path) {
      head += `  (${row.bridge_path})`;
    }
    lines.push(head);
    if (row.fallback_only) {
      lines.push(
        "    degraded: rule-only fallback " +
          "— hooks are not auto-firing on this platform.",
      );
      continue;
    }
    if (Object.keys(row.bindings).length === 0) {
      lines.push("    (no bindings declared in manifest)");
      continue;
    }
    for (const event of Object.keys(row.bindings).sort()) {
      const concerns = row.bindings[event]?.join(", ") || "—";
      lines.push(`    ${event.padEnd(22)} → ${concerns}`);
    }
    if (row.hint) {
      lines.push(`    hint: run ${row.hint}`);
    }
  }
  lines.push("");
  lines.push("Source of truth: scripts/hook_manifest.yaml");
  lines.push("Contract: docs/contracts/hook-architecture-v1.md");
  return lines.join("\n");
}

export function _final_exit_code(matrix: StatusMatrix, strict: boolean): number {
  if (!strict) {
    return 0;
  }
  // Strict mode: any platform with declared bindings whose bridge is
  // missing is a CI failure. `degraded`/`n/a` never fail (Copilot is
  // an explicit no-hook platform; n/a means no bridge expected).
  for (const row of matrix.platforms) {
    if (row.status === "missing" && Object.keys(row.bindings).length > 0) {
      return 1;
    }
  }
  return 0;
}

interface ParsedArgs {
  format: "table" | "json";
  project_root: string;
  manifest: string;
  strict: boolean;
  pending: boolean;
}

function parse_args(argv: string[]): ParsedArgs {
  let format: "table" | "json" = "table";
  let project_root = ".";
  let manifest = MANIFEST_PATH;
  let strict = false;
  let pending = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--pending") {
      pending = true;
    } else if (arg === "--format") {
      const v = argv[i + 1];
      if (v === "json" || v === "table") format = v;
      i += 1;
    } else if (arg === "--project-root") {
      project_root = argv[i + 1] ?? ".";
      i += 1;
    } else if (arg === "--manifest") {
      manifest = argv[i + 1] ?? MANIFEST_PATH;
      i += 1;
    } else if (arg === "--strict") {
      strict = true;
    }
  }
  return { format, project_root, manifest, strict, pending };
}

/**
 * Render the staged-but-unconfirmed actions, or the honest empty state.
 *
 * The empty line says WHY it is empty, because "0 pending" and "nothing can
 * ever stage" are different facts and only one of them is a reason to keep
 * looking. Until dispatch-safety step 2.4 decides where the primitive binds,
 * the only producer is an explicitly injected stager, so an empty list is the
 * expected reading rather than a sign that nothing was held.
 */
export function _render_pending(rows: StagedAction[]): string {
  if (rows.length === 0) {
    return (
      "pending confirmations: none\n" +
      "  no surface stages a requires_confirmation action yet — the primitive\n" +
      "  ships unbound (dispatch-safety step 2.4 decides whether it binds and\n" +
      "  what a host without a pre_tool_use slot gets)."
    );
  }
  const lines = [`pending confirmations: ${rows.length}`];
  for (const r of rows) {
    lines.push(`  ${r.token}  ${r.action} → ${r.object}`);
    lines.push(`    gate=${r.gate_id} phase=${r.phase || "-"} staged=${r.staged_at}`);
  }
  return lines.join("\n");
}

// Python json.dumps(payload, indent=2, sort_keys=True) byte-for-byte.
function _py_json_dumps_sorted(value: JsonValue, indent = 2): string {
  const pad = " ".repeat(indent);
  const esc = (s: string): string => JSON.stringify(s);
  const render = (v: JsonValue, depth: number): string => {
    if (v === null) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return esc(v);
    const curPad = pad.repeat(depth + 1);
    const closePad = pad.repeat(depth);
    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      const items = v.map((it) => curPad + render(it, depth + 1));
      return "[\n" + items.join(",\n") + "\n" + closePad + "]";
    }
    const obj = v as JsonObject;
    const keys = Object.keys(obj).sort();
    if (keys.length === 0) return "{}";
    const items = keys.map(
      (k) => curPad + esc(k) + ": " + render(obj[k] as JsonValue, depth + 1),
    );
    return "{\n" + items.join(",\n") + "\n" + closePad + "}";
  };
  return render(value, 0);
}

export function main(argv?: string[]): number {
  const args = parse_args(argv ?? process.argv.slice(2));

  // `--pending` enumerates staged confirmations and returns before the manifest
  // is touched: the two reports answer different questions, and folding the
  // confirmations into the default output would change a surface other callers
  // (task hooks-status, post-install smoke, CI) pin byte-for-byte.
  if (args.pending) {
    // `--strict` is the matrix report's CI gate and this branch never builds a
    // matrix, so honouring it is impossible and ignoring it is worse: the
    // combination would exit 0 through a strict CI invocation and report green
    // for hook bridges nobody checked. Reject it rather than silently drop it.
    if (args.strict) {
      process.stderr.write(
        "hooks_status: --pending and --strict are incompatible — --pending " +
          "enumerates staged confirmations and builds no hook matrix for " +
          "--strict to gate. Run them as two invocations.\n",
      );
      return 2;
    }
    const rows = listPending(path.resolve(args.project_root));
    if (args.format === "json") {
      process.stdout.write(
        _py_json_dumps_sorted(rows as unknown as JsonValue) + "\n",
      );
    } else {
      process.stdout.write(_render_pending(rows) + "\n");
    }
    return 0;
  }

  const manifest_path = args.manifest;
  if (!fs.existsSync(manifest_path)) {
    process.stderr.write(`hooks_status: manifest missing at ${manifest_path}\n`);
    return 2;
  }
  const manifest = _load_yaml(manifest_path);
  const project_root = path.resolve(args.project_root);
  const matrix = collect(project_root, manifest);

  if (args.format === "json") {
    process.stdout.write(
      _py_json_dumps_sorted(matrix as unknown as JsonValue) + "\n",
    );
  } else {
    process.stdout.write(_render_table(matrix) + "\n");
  }
  return _final_exit_code(matrix, args.strict);
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const isCliEntry =
  _isCliEntry();
if (isCliEntry) {
  process.exit(main(process.argv.slice(2)));
}
