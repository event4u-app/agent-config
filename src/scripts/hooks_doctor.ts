#!/usr/bin/env node
/**
 * Hook doctor — read-only diagnostic over the hook runtime.
 *
 * TypeScript twin of `src/scripts/hooks_doctor.py` (ADR-094 — Python→TS
 * migration, Phase 6 / hooks). Public API mirrors the Python module
 * exactly (snake_case kept deliberately — fidelity over TS idiom).
 *
 * Wraps `scripts/hooks_status.py` (bridge presence + manifest bindings)
 * and adds three diagnostics the bare status table does not surface:
 *
 *   * **Concerns** — every concern declared in the manifest, its
 *     `fail_closed` posture, the on-disk script path, and a one-line
 *     file-exists check.
 *   * **Trampolines** — per-platform shell trampoline expected under
 *     `scripts/hooks/<platform>-dispatcher.sh`; flags any platform that
 *     has manifest bindings but no trampoline on disk.
 *   * **Last feedback** — for each concern, the most-recent dispatcher
 *     feedback file under `agents/runtime/state/.dispatcher/<session>/<concern>.json`,
 *     plus the per-rule state file under `agents/runtime/state/<concern>.json`
 *     when one exists.
 *
 * This is a **read-only** report. It never installs, modifies, or runs
 * anything — same contract as `hooks_status.py`. CI uses `--strict` to
 * turn missing bindings / trampolines into a non-zero exit.
 *
 * Schema: docs/contracts/hook-architecture-v1.md.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { read_dispatch_issues } from "./hooks/dispatch_issues.js";
import { type JsonObject, type JsonValue, _load_yaml } from "./hooks/dispatch_hook.js";
import * as hooks_status from "./hooks_status.js";

// src/scripts/hooks_doctor.ts → parents[2] (../../..) is the repo root,
// mirroring the Python `Path(__file__).resolve().parents[2]`.
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

// Mutable so tests can point the trampoline lookup at an empty dir
// (mirrors the Python monkeypatch of `hooks_doctor.TRAMPOLINE_DIR`).
export let TRAMPOLINE_DIR = path.join(REPO_ROOT, "src", "scripts", "hooks");

/** Test-only override (the Python test uses monkeypatch.setattr). */
export function _set_trampoline_dir(dir: string): void {
  TRAMPOLINE_DIR = dir;
}

const STATE_DIR_DEFAULT = "agents/runtime/state";

// Platforms whose bridge file (settings.json) invokes the universal
// dispatcher directly — no shell trampoline required. Excluded from the
// "missing trampoline" check.
const NATIVE_DISPATCH_PLATFORMS: ReadonlySet<string> = new Set(["claude"]);

export { hooks_status };

function _isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function _isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function _trampoline_for(platform: string): string {
  return path.join(TRAMPOLINE_DIR, `${platform}-dispatcher.sh`);
}

function _concern_state_file(state_dir: string, concern: string): string | null {
  const target = path.join(state_dir, `${concern}.json`);
  return _isFile(target) ? target : null;
}

/**
 * Return the most-recent dispatcher feedback file for the concern,
 * walking `agents/runtime/state/.dispatcher/<session>/<concern>.json`.
 */
function _latest_feedback(state_dir: string, concern: string): string | null {
  const dispatcher_dir = path.join(state_dir, ".dispatcher");
  if (!_isDir(dispatcher_dir)) {
    return null;
  }
  const candidates: Array<{ p: string; mtime: number }> = [];
  let sessions: string[];
  try {
    sessions = fs.readdirSync(dispatcher_dir);
  } catch {
    return null;
  }
  for (const sess of sessions) {
    const candidate = path.join(dispatcher_dir, sess, `${concern}.json`);
    try {
      const st = fs.statSync(candidate);
      if (st.isFile()) {
        candidates.push({ p: candidate, mtime: st.mtimeMs });
      }
    } catch {
      /* not a file */
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]!.p;
}

function _rel(p: string | null, root: string): string | null {
  if (p === null) {
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const resolvedP = path.resolve(p);
  const rel = path.relative(resolvedRoot, resolvedP);
  // Python: relative_to raises ValueError when p is not under root →
  // falls back to str(path). Mimic: outside-root paths keep absolute form.
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return p;
  }
  return rel;
}

export interface ConcernRow {
  concern: string;
  fail_closed: boolean;
  script: string | null;
  script_present: boolean;
  state_file: string | null;
  last_feedback: string | null;
}

export interface TrampolineRow {
  platform: string;
  expected: string | null;
  present: boolean;
  required: boolean;
  missing: boolean;
}

export interface DoctorPayload {
  schema_version: number;
  platforms: hooks_status.PlatformRow[];
  concerns: ConcernRow[];
  trampolines: TrampolineRow[];
  dispatch_issues: JsonObject[];
}

/** Build the doctor payload — JSON-serialisable. */
export function collect(
  project_root: string,
  manifest: JsonObject,
  state_dir_rel: string = STATE_DIR_DEFAULT,
): DoctorPayload {
  const matrix = hooks_status.collect(project_root, manifest);
  const state_dir = path.join(project_root, state_dir_rel);

  const concerns_def = _isObject(manifest["concerns"])
    ? (manifest["concerns"] as JsonObject)
    : {};
  const concerns: ConcernRow[] = [];
  for (const name of Object.keys(concerns_def).sort()) {
    const specRaw = concerns_def[name];
    const spec = _isObject(specRaw) ? specRaw : {};
    const script_rel = typeof spec["script"] === "string" ? spec["script"] : "";
    const script_path = script_rel ? path.join(REPO_ROOT, script_rel) : null;
    const state_file = _concern_state_file(state_dir, name);
    const last_feedback = _latest_feedback(state_dir, name);
    concerns.push({
      concern: name,
      fail_closed: Boolean(spec["fail_closed"] ?? false),
      script: script_rel || null,
      script_present: Boolean(script_path && _isFile(script_path)),
      state_file: _rel(state_file, project_root),
      last_feedback: _rel(last_feedback, project_root),
    });
  }

  const trampolines: TrampolineRow[] = [];
  for (const row of matrix.platforms) {
    const platform = row.platform;
    const needs_trampoline =
      Object.keys(row.bindings).length > 0 &&
      !NATIVE_DISPATCH_PLATFORMS.has(platform);
    const tpath = _trampoline_for(platform);
    const present = _isFile(tpath);
    trampolines.push({
      platform,
      expected: _rel(tpath, REPO_ROOT),
      present,
      required: needs_trampoline,
      missing: needs_trampoline && !present,
    });
  }

  // Phase 1 of road-to-hooks-actually-fire-in-consumers: surface
  // the dispatch-issues log so users see hooks that tried and failed.
  let issues: JsonObject[] = [];
  try {
    issues = read_dispatch_issues(REPO_ROOT).slice(-20) as unknown as JsonObject[];
  } catch {
    issues = [];
  }

  return {
    schema_version: 1,
    platforms: matrix.platforms,
    concerns,
    trampolines,
    dispatch_issues: issues,
  };
}

function _strVal(v: JsonValue | undefined): string {
  return v === undefined || v === null ? "undefined" : String(v);
}

export function _render_table(payload: DoctorPayload): string {
  const lines: string[] = [];
  // Phase 1 CTA — surfaces at the TOP when issues exist, so a user
  // reading the report can't miss it.
  if (payload.dispatch_issues.length > 0) {
    const n = payload.dispatch_issues.length;
    lines.push(
      `⚠️  Hooks tried to fire but couldn't (${n} entr` +
        `${n !== 1 ? "ies" : "y"} in dispatch-issues.jsonl) — ` +
        "run `./agent-config hooks:install --claude --regen` " +
        "(or follow the per-concern hints below)",
    );
    lines.push("");
  }
  lines.push(hooks_status._render_table({
    schema_version: payload.schema_version,
    platforms: payload.platforms,
  }));
  lines.push("");
  lines.push("Concerns");
  lines.push("-".repeat(60));
  for (const c of payload.concerns) {
    const posture = c.fail_closed ? "fail-closed" : "fail-open";
    const script_mark = c.script_present ? "✅ " : "❌ ";
    lines.push(
      `${script_mark}${c.concern.padEnd(22)} ${posture.padEnd(11)} ${
        c.script || "(no script)"
      }`,
    );
    if (c.state_file) {
      lines.push(`    state:    ${c.state_file}`);
    }
    if (c.last_feedback) {
      lines.push(`    feedback: ${c.last_feedback}`);
    }
  }
  lines.push("");
  lines.push("Trampolines");
  lines.push("-".repeat(60));
  for (const t of payload.trampolines) {
    const marker = t.missing ? "❌ " : !t.required ? "·  " : "✅ ";
    const suffix = t.required ? "" : "  (not required)";
    lines.push(`${marker}${t.platform.padEnd(9)} ${t.expected}${suffix}`);
  }
  // Dispatch-issues detail — last 20 grouped by concern.
  if (payload.dispatch_issues.length > 0) {
    lines.push("");
    lines.push("Dispatch issues (last 20)");
    lines.push("-".repeat(60));
    const grouped: Record<string, JsonObject[]> = {};
    for (const entry of payload.dispatch_issues) {
      const hook = _strVal(entry["hook"] ?? "?");
      (grouped[hook] ??= []).push(entry);
    }
    for (const hook of Object.keys(grouped).sort()) {
      const entries = grouped[hook]!;
      lines.push(`⚠️  ${hook}: ${entries.length} issue(s)`);
      // Show the most recent reason + resolution per concern.
      const latest = entries[entries.length - 1]!;
      lines.push(
        `    ${_strVal(latest["issue"])}: ${_strVal(latest["detail"])}`,
      );
      lines.push(`    fix → ${_strVal(latest["resolution"])}`);
    }
  }
  return lines.join("\n");
}

export function _final_exit_code(payload: DoctorPayload, strict: boolean): number {
  if (!strict) {
    return 0;
  }
  const rc = hooks_status._final_exit_code(
    { schema_version: payload.schema_version, platforms: payload.platforms },
    strict,
  );
  if (rc) {
    return rc;
  }
  if (payload.trampolines.some((t) => t.missing)) {
    return 1;
  }
  if (payload.concerns.some((c) => !c.script_present)) {
    return 1;
  }
  return 0;
}

interface ParsedArgs {
  format: "table" | "json";
  project_root: string;
  manifest: string;
  strict: boolean;
}

function parse_args(argv: string[]): ParsedArgs {
  let format: "table" | "json" = "table";
  let project_root = ".";
  let manifest = MANIFEST_PATH;
  let strict = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--format") {
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
  return { format, project_root, manifest, strict };
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

  const manifest_path = args.manifest;
  if (!fs.existsSync(manifest_path)) {
    process.stderr.write(`hooks_doctor: manifest missing at ${manifest_path}\n`);
    return 2;
  }
  const manifest = _load_yaml(manifest_path);
  const project_root = path.resolve(args.project_root);
  const payload = collect(project_root, manifest);

  if (args.format === "json") {
    process.stdout.write(
      _py_json_dumps_sorted(payload as unknown as JsonValue) + "\n",
    );
  } else {
    process.stdout.write(_render_table(payload) + "\n");
  }
  return _final_exit_code(payload, args.strict);
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main(process.argv.slice(2)));
}
