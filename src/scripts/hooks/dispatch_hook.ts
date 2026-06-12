#!/usr/bin/env node
/**
 * Universal hook dispatcher — single entry point for every platform.
 *
 * TypeScript twin of `src/scripts/hooks/dispatch_hook.py` (ADR-089 —
 * Python→TS migration, Phase 6 / hooks core). Mirrors the Python CLI
 * contract exactly: same manifest default, event vocabulary, envelope
 * shape, concern invocation, exit-code reduction, feedback-dir writes,
 * stdout/stderr split, and exit codes. Helper names keep snake_case for
 * fidelity (concern authors rely on the documented surface).
 *
 * Per `docs/contracts/hook-architecture-v1.md`. Reads the manifest at
 * `scripts/hook_manifest.yaml`, resolves which concerns fire on the given
 * (platform, event) tuple, and runs each concern sequentially with the
 * stdin envelope contract. Reduces concern exit codes per the spec
 * (0=allow, 1=block, 2=warn, ≥3=error → fail-open unless concern is
 * fail_closed).
 *
 * Invocation:
 *
 *     node scripts/hooks/dispatch_hook.js \
 *         --platform <name> \
 *         --event <agent-config-event> \
 *         [--native-event <platform-event>] \
 *         < platform-payload.json
 *
 * Per-platform shell trampolines under `scripts/hooks/<platform>-dispatcher.sh`
 * extract the workspace root from the platform payload, cd there, then call
 * this script. Trampolines never read the manifest themselves.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

import {
  atomic_write_json,
  feedback_dir,
  is_replay_mode,
} from "./state_io.js";
import { log_dispatch_issue, fix_hint } from "./dispatch_issues.js";

// Free-form JSON values flow through every helper here; a documented
// alias keeps the surface honest without `any` (ADR-089 § strict TS).
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

// src/scripts/hooks/dispatch_hook.ts → parents[3] is the repo root.
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const MANIFEST_PATH = path.join(REPO_ROOT, "src", "scripts", "hook_manifest.yaml");

export const EXIT_ALLOW = 0;
export const EXIT_BLOCK = 1;
export const EXIT_WARN = 2;

// Per Council Round 2 (Q3): `agent_error` covers agent-level crashes
// that are not concern-triggered, so chat-history can checkpoint
// partial sessions on abnormal exit.
export const EVENT_VOCABULARY: ReadonlySet<string> = new Set([
  "session_start",
  "session_end",
  "user_prompt_submit",
  "pre_tool_use",
  "post_tool_use",
  "stop",
  "pre_compact",
  "agent_error",
]);

const _SEVERITY_BY_EXIT: Record<number, string> = {
  [EXIT_ALLOW]: "allow",
  [EXIT_BLOCK]: "block",
  [EXIT_WARN]: "warn",
};

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function _severity_for(rc: number): string {
  return _SEVERITY_BY_EXIT[rc] ?? "error";
}

function _now_iso(): string {
  // Python: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ").
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

interface Args {
  platform: string;
  event: string;
  native_event: string;
  manifest: string;
  dry_run: boolean;
  project_dir: string;
  min_version: number;
}

function _resolve_session_id(envelope: JsonObject): string {
  const sid = envelope["session_id"] || "";
  if (sid) {
    return String(sid);
  }
  // Fallback so the feedback dir always has a unique slot per
  // invocation. Format: dispatch-<unix_ts>-<pid>. Not stable
  // across invocations — that is the point.
  return `dispatch-${Math.floor(Date.now() / 1000)}-${process.pid}`;
}

export function _parse_concern_stdout(stdout_text: string): JsonObject {
  const text = (stdout_text ?? "").trim();
  if (!text) {
    return {};
  }
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(text) as JsonValue;
  } catch {
    return { _raw_stdout: text.slice(0, 500) };
  }
  return _isObject(parsed) ? parsed : { _raw: parsed };
}

/**
 * Minimal manifest loader — the Python original prefers PyYAML and falls
 * back to `_fallback_yaml` only when PyYAML is absent. The TS runtime
 * always ships the `yaml` package, so this mirrors the PyYAML-present
 * path (`yaml.safe_load(text) or {}`); version 1.1 matches PyYAML.safe_load.
 */
export function _load_yaml(p: string): JsonObject {
  const text = fs.readFileSync(p, "utf-8");
  const data = parseYaml(text, { version: "1.1" }) as JsonValue;
  return _isObject(data) ? data : {};
}

/**
 * Indent-aware mini-parser for the manifest's flat shape only.
 * Handles: scalars, `key: null`, `key: true/false`, `key: [a, b]`.
 * Drops comments + blank lines. Two-space indent assumed.
 *
 * Ported verbatim from the Python `_fallback_yaml` so the parser unit
 * tests have an exact twin; runtime prefers `_load_yaml` above.
 */
export function _fallback_yaml(text: string): JsonObject {
  const root: JsonObject = {};
  const stack: Array<[number, JsonObject]> = [[-1, root]];
  for (const raw of text.split("\n")) {
    const line = raw.split("#", 1)[0]!.replace(/\s+$/, "");
    if (!line.trim()) {
      continue;
    }
    const indent = line.length - line.replace(/^ +/, "").length;
    while (stack.length > 0 && stack[stack.length - 1]![0] >= indent) {
      stack.pop();
    }
    const parent = stack.length > 0 ? stack[stack.length - 1]![1] : root;
    const body = line.trim();
    if (!body.includes(":")) {
      continue;
    }
    const idx = body.indexOf(":");
    const key = body.slice(0, idx).trim();
    const val = body.slice(idx + 1).trim();
    if (!val) {
      const newObj: JsonObject = {};
      parent[key] = newObj;
      stack.push([indent, newObj]);
    } else {
      const lower = val.toLowerCase();
      if (lower === "null" || lower === "~" || lower === "") {
        parent[key] = null;
      } else if (lower === "true") {
        parent[key] = true;
      } else if (lower === "false") {
        parent[key] = false;
      } else if (val.startsWith("[") && val.endsWith("]")) {
        const inner = val.slice(1, -1).trim();
        parent[key] = inner
          ? inner
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s)
          : [];
      } else if (/^-?\d+$/.test(val)) {
        parent[key] = parseInt(val, 10);
      } else {
        parent[key] = val.replace(/^['"]+|['"]+$/g, "");
      }
    }
  }
  return root;
}

interface ConcernDef extends JsonObject {
  name: string;
}

/**
 * Return the ordered concern definitions for (platform, event).
 */
export function _resolve_concerns(
  manifest: JsonObject,
  platform: string,
  event: string,
): ConcernDef[] {
  const platformsRaw = manifest["platforms"];
  const platforms = _isObject(platformsRaw) ? platformsRaw : {};
  const block = platforms[platform];
  if (!block) {
    return [];
  }
  if (_isObject(block) && block["fallback_only"]) {
    return [];
  }
  const names = _isObject(block) ? block[event] : null;
  if (!Array.isArray(names)) {
    return [];
  }
  const concernsRaw = manifest["concerns"];
  const concerns_def = _isObject(concernsRaw) ? concernsRaw : {};
  const out: ConcernDef[] = [];
  for (const name of names) {
    const spec = typeof name === "string" ? concerns_def[name] : undefined;
    if (!spec || !_isObject(spec)) {
      process.stderr.write(
        `dispatch_hook: unknown concern '${String(name)}' in manifest\n`,
      );
      continue;
    }
    out.push({ name: String(name), ...spec });
  }
  return out;
}

// Python json.dumps(record, indent=2) byte-for-byte (ensure_ascii=True).
function _py_json_dumps(value: unknown, indent: number): string {
  const pad = " ".repeat(indent);
  const escapeString = (s: string): string => {
    let out = '"';
    for (const ch of s) {
      const code = ch.codePointAt(0) as number;
      switch (ch) {
        case '"':
          out += '\\"';
          break;
        case "\\":
          out += "\\\\";
          break;
        case "\n":
          out += "\\n";
          break;
        case "\r":
          out += "\\r";
          break;
        case "\t":
          out += "\\t";
          break;
        case "\b":
          out += "\\b";
          break;
        case "\f":
          out += "\\f";
          break;
        default:
          if (code < 0x20 || code > 0x7e) {
            if (code > 0xffff) {
              const c = code - 0x10000;
              const hi = 0xd800 + (c >> 10);
              const lo = 0xdc00 + (c & 0x3ff);
              out +=
                "\\u" +
                hi.toString(16).padStart(4, "0") +
                "\\u" +
                lo.toString(16).padStart(4, "0");
            } else {
              out += "\\u" + code.toString(16).padStart(4, "0");
            }
          } else {
            out += ch;
          }
      }
    }
    return out + '"';
  };
  const render = (v: unknown, depth: number): string => {
    if (v === null || v === undefined) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") {
      if (!Number.isFinite(v)) {
        if (Number.isNaN(v)) return "NaN";
        return v > 0 ? "Infinity" : "-Infinity";
      }
      return String(v);
    }
    if (typeof v === "string") return escapeString(v);
    const curPad = pad.repeat(depth + 1);
    const closePad = pad.repeat(depth);
    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      return (
        "[\n" +
        v.map((item) => curPad + render(item, depth + 1)).join(",\n") +
        "\n" +
        closePad +
        "]"
      );
    }
    if (typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) return "{}";
      return (
        "{\n" +
        keys
          .map((k) => curPad + escapeString(k) + ": " + render(obj[k], depth + 1))
          .join(",\n") +
        "\n" +
        closePad +
        "}"
      );
    }
    throw new TypeError(`Object of type ${typeof v} is not JSON serializable`);
  };
  return render(value, 0);
}

/**
 * Write the raw stdin payload to a capture directory when
 * `AGENT_HOOK_CAPTURE_DIR` is set. Fail-silent: any IO / JSON error must
 * not break dispatch.
 */
export function _maybe_capture_payload(args: Args, payload_text: string): void {
  const capture_dir = (process.env["AGENT_HOOK_CAPTURE_DIR"] ?? "").trim();
  if (!capture_dir) {
    return;
  }
  try {
    const target = _expanduser(capture_dir);
    fs.mkdirSync(target, { recursive: true });
    let payload: JsonValue;
    try {
      payload = payload_text.trim()
        ? (JSON.parse(payload_text) as JsonValue)
        : {};
    } catch {
      payload = { _raw_text: payload_text };
    }
    const record = {
      captured_at: _now_iso(),
      platform: args.platform,
      event: args.event,
      native_event: args.native_event || "",
      raw_payload: payload,
    };
    const ts = Date.now();
    const native = (args.native_event || args.event).replace(/\//g, "_");
    const fname = `${args.platform}__${native}__${ts}__${process.pid}.json`;
    fs.writeFileSync(
      path.join(target, fname),
      _py_json_dumps(record, 2) + "\n",
      { encoding: "utf-8" },
    );
  } catch {
    return;
  }
}

function _expanduser(p: string): string {
  if (p === "~" || p.startsWith("~/")) {
    const home = process.env["HOME"] || process.env["USERPROFILE"] || "";
    return path.join(home, p.slice(1));
  }
  return p;
}

export function _build_envelope(args: Args, payload_text: string): JsonObject {
  let payload: JsonValue;
  try {
    payload = payload_text.trim() ? (JSON.parse(payload_text) as JsonValue) : {};
    if (!_isObject(payload)) {
      payload = { _raw: payload };
    }
  } catch {
    payload = { _raw: payload_text };
  }
  const payloadObj = payload as JsonObject;
  const sidFromPayload = payloadObj["session_id"];
  return {
    schema_version: 1,
    platform: args.platform,
    event: args.event,
    native_event: args.native_event || "",
    session_id:
      (sidFromPayload as JsonValue) ||
      process.env["AGENT_SESSION_ID"] ||
      "",
    workspace_root: process.cwd(),
    payload: payloadObj,
    settings: {},
  };
}

interface RunResult {
  rc: number;
  stderr: string;
  stdout: string;
  duration_ms: number;
}

/**
 * Invoke one concern with the envelope on stdin.
 *
 * Concerns run with CWD = consumer workspace (envelope.workspace_root),
 * NOT the agent-config package root — concerns resolve `agents/runtime/state/`
 * and other consumer-local paths relative to CWD. The script *itself*
 * lives in the package (REPO_ROOT), so we resolve it absolutely.
 *
 * Concern scripts are Python (`.py`) — the dispatcher invokes them through
 * `python3`, mirroring the Python original's `sys.executable`.
 */
function _run_concern(concern: ConcernDef, envelope: JsonObject): RunResult {
  const script = path.join(REPO_ROOT, String(concern["script"]));
  const argsList = Array.isArray(concern["args"])
    ? concern["args"].map((a) => String(a))
    : [];
  const cmd = [script, ...argsList];
  cmd.push("--platform", String(envelope["platform"] || "generic"));
  const workspace = String(envelope["workspace_root"] || process.cwd());

  // Surface script-not-found via dispatch-issues.jsonl rather than silently
  // consuming the error.
  if (!_isFile(script)) {
    log_dispatch_issue(
      workspace,
      String(concern["name"] || concern["script"] || "unknown"),
      "script_not_found",
      `concern script missing on disk: ${script}`,
      fix_hint(),
    );
    return {
      rc: 3,
      stderr: `${String(concern["name"])}: script missing: ${script}`,
      stdout: "",
      duration_ms: 0,
    };
  }

  // Pass the package root so concerns can locate package-shipped
  // distributed content (ADR-020 global-only consumers carry no
  // project-local copy). REPO_ROOT is the dispatcher's own resolved root.
  const concern_env = { ...process.env, AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT };

  const started = performance.now();
  const proc = spawnSync("python3", cmd, {
    input: _compactJsonDumps(envelope),
    encoding: "utf-8",
    cwd: workspace,
    env: concern_env,
    timeout: 30000,
  });
  const elapsed = Math.floor(performance.now() - started);
  if (proc.error) {
    // OSError / timeout equivalent — log execution-failed so the
    // never-block contract keeps a trace.
    const err = proc.error as NodeJS.ErrnoException;
    const typeName =
      err.code === "ETIMEDOUT" ? "TimeoutExpired" : err.name || "OSError";
    log_dispatch_issue(
      workspace,
      String(concern["name"] || "unknown"),
      "execution_failed",
      `${typeName}: ${err.message}`,
      fix_hint(),
    );
    return {
      rc: 3,
      stderr: `${String(concern["name"])}: ${err.message}`,
      stdout: "",
      duration_ms: elapsed,
    };
  }
  return {
    rc: proc.status ?? 0,
    stderr: proc.stderr || "",
    stdout: proc.stdout || "",
    duration_ms: elapsed,
  };
}

function _isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

// Python json.dumps(envelope) — compact default separators (", ", ": "),
// ensure_ascii=True. Used only to feed the concern's stdin; the concern
// re-parses it, so only validity (not byte-exactness) matters here.
function _compactJsonDumps(value: unknown): string {
  // JSON.stringify suffices for the stdin handoff: the concern parses it
  // back to a dict; whitespace / escaping differences are irrelevant.
  return JSON.stringify(value);
}

export function _reduce(rcs: number[]): number {
  if (rcs.some((rc) => rc === EXIT_BLOCK)) {
    return EXIT_BLOCK;
  }
  if (rcs.some((rc) => rc === EXIT_WARN)) {
    return EXIT_WARN;
  }
  return EXIT_ALLOW;
}

interface FeedbackEntry extends JsonObject {
  concern: string;
}

/**
 * Write per-concern feedback files + summary rollup.
 *
 * Per Council Round 2 (Q1): exit-code reduction collapses the severity
 * ladder to a single platform-native code; this dir surfaces the
 * per-concern detail to humans / `task hooks-status`.
 *
 * Errors writing feedback are non-fatal — fail-open matches the
 * dispatcher's overall posture.
 */
function _write_feedback(
  envelope: JsonObject,
  session_id: string,
  entries: FeedbackEntry[],
  final_rc: number,
  started_at: string,
): void {
  // Replay mode skips feedback emission entirely so fixture replays
  // never create per-session dirs under agents/runtime/state/.dispatcher/.
  if (is_replay_mode()) {
    return;
  }
  const workspace = String(envelope["workspace_root"] || process.cwd());
  const state_root = path.join(workspace, "agents", "runtime", "state");
  const fb_dir = feedback_dir(state_root, session_id);
  try {
    fs.mkdirSync(fb_dir, { recursive: true });
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    process.stderr.write(`dispatch_hook: feedback dir unavailable: ${msg}\n`);
    return;
  }
  for (const entry of entries) {
    const target = path.join(fb_dir, `${entry["concern"]}.json`);
    try {
      atomic_write_json(target, entry);
    } catch (exc) {
      const msg = exc instanceof Error ? exc.message : String(exc);
      process.stderr.write(
        `dispatch_hook: feedback write failed for ${entry["concern"]}: ${msg}\n`,
      );
    }
  }
  const SUMMARY_KEYS = new Set([
    "concern",
    "exit_code",
    "severity",
    "decision",
    "reason",
    "duration_ms",
  ]);
  const summary: JsonObject = {
    schema_version: 1,
    session_id,
    platform: (envelope["platform"] ?? null) as JsonValue,
    event: (envelope["event"] ?? null) as JsonValue,
    native_event: (envelope["native_event"] || "") as JsonValue,
    started_at,
    completed_at: _now_iso(),
    final_exit_code: final_rc,
    final_severity: _severity_for(final_rc),
    concerns: entries.map((e) => {
      const filtered: JsonObject = {};
      for (const [k, v] of Object.entries(e)) {
        if (SUMMARY_KEYS.has(k)) {
          filtered[k] = v;
        }
      }
      return filtered;
    }),
  };
  try {
    atomic_write_json(path.join(fb_dir, "summary.json"), summary);
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    process.stderr.write(`dispatch_hook: summary write failed: ${msg}\n`);
  }
}

function _parse_args(argv: string[]): Args {
  const args: Args = {
    platform: "",
    event: "",
    native_event: "",
    manifest: MANIFEST_PATH,
    dry_run: false,
    project_dir: "",
    min_version: 0,
  };
  let sawPlatform = false;
  let sawEvent = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case "--platform":
        args.platform = argv[++i] ?? "";
        sawPlatform = true;
        break;
      case "--event":
        args.event = argv[++i] ?? "";
        sawEvent = true;
        break;
      case "--native-event":
        args.native_event = argv[++i] ?? "";
        break;
      case "--manifest":
        args.manifest = argv[++i] ?? args.manifest;
        break;
      case "--dry-run":
        args.dry_run = true;
        break;
      case "--project-dir":
        args.project_dir = argv[++i] ?? "";
        break;
      case "--min-version":
        args.min_version = parseInt(argv[++i] ?? "0", 10) || 0;
        break;
      default:
        // argparse would also accept --opt=value form; support it.
        if (a && a.startsWith("--") && a.includes("=")) {
          const [k, v] = [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)];
          switch (k) {
            case "--platform":
              args.platform = v;
              sawPlatform = true;
              break;
            case "--event":
              args.event = v;
              sawEvent = true;
              break;
            case "--native-event":
              args.native_event = v;
              break;
            case "--manifest":
              args.manifest = v;
              break;
            case "--project-dir":
              args.project_dir = v;
              break;
            case "--min-version":
              args.min_version = parseInt(v, 10) || 0;
              break;
          }
        }
    }
  }
  // argparse: --platform and --event are required.
  if (!sawPlatform || !sawEvent) {
    const missing: string[] = [];
    if (!sawPlatform) missing.push("--platform");
    if (!sawEvent) missing.push("--event");
    process.stderr.write(
      `dispatch_hook: the following arguments are required: ${missing.join(", ")}\n`,
    );
    process.exit(2);
  }
  return args;
}

export function main(argv?: string[]): number {
  const args = _parse_args(argv ?? process.argv.slice(2));

  // Honour --project-dir: chdir so workspace_root (envelope) and every
  // concern's cwd resolve consumer-local paths against the project the
  // event fired in. Fail loud (never block) when the path is bad.
  if (args.project_dir) {
    const project_dir = _expanduser(args.project_dir);
    if (_isDir(project_dir)) {
      process.chdir(project_dir);
    } else {
      process.stderr.write(
        `dispatch_hook: --project-dir is not a directory: ` +
          `${project_dir} — resolving against cwd ${process.cwd()}\n`,
      );
    }
  }

  if (!EVENT_VOCABULARY.has(args.event)) {
    process.stderr.write(
      `dispatch_hook: unknown event '${args.event}'; allowed: ` +
        `${_sortedRepr(EVENT_VOCABULARY)}\n`,
    );
    return EXIT_ALLOW; // fail-open per contract for unknown events
  }

  const manifest_path = args.manifest;
  if (!fs.existsSync(manifest_path)) {
    process.stderr.write(`dispatch_hook: manifest missing at ${manifest_path}\n`);
    return EXIT_ALLOW;
  }
  const manifest = _load_yaml(manifest_path);

  // Plugin↔binary drift guard (never blocks).
  if (args.min_version) {
    const local_spec = (manifest["schema_version"] as number) || 0;
    if (typeof local_spec === "number" && local_spec < args.min_version) {
      process.stderr.write(
        `dispatch_hook: plugin expects hook-spec >= ${args.min_version} ` +
          `but this agent-config provides ${local_spec}; ` +
          `run \`agent-config upgrade\`.\n`,
      );
    }
  }

  const payload_text = process.stdin.isTTY ? "" : _readStdin();
  _maybe_capture_payload(args, payload_text);
  const concerns = _resolve_concerns(manifest, args.platform, args.event);

  if (args.dry_run) {
    const plan = {
      platform: args.platform,
      event: args.event,
      concerns: concerns.map((c) => c["name"]),
    };
    process.stdout.write(_py_json_dumps(plan, 2) + "\n");
    return EXIT_ALLOW;
  }

  if (concerns.length === 0) {
    return EXIT_ALLOW; // platform unsupported / fallback-only / empty slot
  }

  const envelope = _build_envelope(args, payload_text);
  const session_id = _resolve_session_id(envelope);
  const started_at = _now_iso();
  const rcs: number[] = [];
  const feedback_entries: FeedbackEntry[] = [];
  for (const concern of concerns) {
    const concern_started = _now_iso();
    const { rc: rawRcResult, stderr: stderr_text, stdout: stdout_text, duration_ms } =
      _run_concern(concern, envelope);
    let rc = rawRcResult;
    const raw_rc = rc;
    if (rc >= 3) {
      if (!concern["fail_closed"]) {
        rc = EXIT_ALLOW; // fail-open
      } else {
        rc = EXIT_BLOCK;
      }
      if (stderr_text) {
        process.stderr.write(stderr_text);
      }
    }
    rcs.push(rc);
    const reply = _parse_concern_stdout(stdout_text);
    feedback_entries.push({
      concern: String(concern["name"]),
      exit_code: rc,
      raw_exit_code: raw_rc,
      severity: _severity_for(rc),
      decision: (reply["decision"] || _severity_for(rc)) as JsonValue,
      reason: (reply["reason"] ?? null) as JsonValue,
      duration_ms,
      started_at: concern_started,
      completed_at: _now_iso(),
      fail_closed: Boolean(concern["fail_closed"]),
    });
  }
  const final_rc = _reduce(rcs);
  _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at);
  return final_rc;
}

function _isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function _sortedRepr(s: ReadonlySet<string>): string {
  const items = [...s].sort();
  return `[${items.map((x) => `'${x}'`).join(", ")}]`;
}

function _readStdin(): string {
  try {
    return fs.readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main(process.argv.slice(2)));
}
