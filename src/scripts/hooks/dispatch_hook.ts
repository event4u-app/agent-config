#!/usr/bin/env node
/**
 * Universal hook dispatcher — single entry point for every platform.
 *
 * Ported from the retired Python `src/scripts/hooks/dispatch_hook.py` (ADR-200 —
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
import * as tty from "node:tty";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

import { hardenedSpawnEnv } from "../_lib/spawn_env.js";
import {
  atomic_write_json,
  feedback_dir,
  is_replay_mode,
  update_json_under_lock,
} from "./state_io.js";
import { log_dispatch_issue, fix_hint } from "./dispatch_issues.js";
import { shapeAndRecord, type ConcernMessage } from "./injection_budget.js";
import { CONCERN_REGISTRY, type ConcernMain } from "./concern_registry.js";
import {
  setHookStdinOverride,
  clearHookStdinOverride,
} from "./hook_stdin.js";
import { emitFor, type Severity } from "./host_semantics.js";
import { _concern_body_classes, planPayloadShapes } from "./payload_stub.js";
import { resolveSessionRole, type SessionRole } from "../_lib/session_role.js";
import { stdinReadFailure, denyOnStdinFailure } from './stdin_failure_policy.js';
export { stdinReadFailure, denyOnStdinFailure, _is_fail_closed_blocking } from './stdin_failure_policy.js';
import { _py_json_dumps } from './py_json_dumps.js';
import { _fallback_yaml } from './fallback_yaml.js';
import {
  isSelfObservation,
  recordCapture,
  recordOpportunity,
} from "../_lib/collector_denominator.js";
export { _fallback_yaml } from './fallback_yaml.js';

// Free-form JSON values flow through every helper here; a documented
// alias keeps the surface honest without `any` (ADR-200 § strict TS).
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

// src/scripts/hooks/dispatch_hook.ts → parents[3] is the repo root.
// Bundled (dist/hooks/dispatch.js) the module sits two levels below the repo
// root; under tsx (src/scripts/hooks/) it sits three. The `__AGENT_CONFIG_BUNDLE__`
// sentinel (esbuild --define) picks the right depth (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _IN_BUNDLE = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ...(_IN_BUNDLE ? ["..", ".."] : ["..", "..", ".."]),
);
const MANIFEST_PATH = path.join(REPO_ROOT, "src", "scripts", "hook_manifest.yaml");

export const EXIT_ALLOW = 0;
export const EXIT_BLOCK = 1;
export const EXIT_WARN = 2;

// Per Council Round 2 (Q3): `agent_error` covers agent-level crashes
// that are not concern-triggered, so chat-history can checkpoint
// partial sessions on abnormal exit.
//
// `subagent_start` / `subagent_stop` (road-to-subagent-lifecycle-integrity
// Phase 1 Step 1) are the dispatch-level twins of the session pair: they
// bracket ONE subagent run rather than one session. The host tokens they map
// to were re-extracted at 2.1.229 rather than carried over from the 2.1.220
// spike — see agents/evidence/investigations/subagent-lifecycle-phase0-host-pin.md.
// Only `claude` and `cowork` alias them today; every other platform simply
// never sends them, which the alias table already expresses by omission.
export const EVENT_VOCABULARY: ReadonlySet<string> = new Set([
  "session_start",
  "session_end",
  "user_prompt_submit",
  "pre_tool_use",
  "post_tool_use",
  "stop",
  "pre_compact",
  "agent_error",
  "subagent_start",
  "subagent_stop",
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

/**
 * P0.2 (road-to-rule-coherence) — is this concern declared advisory?
 *
 * An advisory concern MUST never produce a BLOCK verdict on any host. Four
 * PreToolUse concerns document themselves as advisory in prose
 * (`design_slop_hook`: "FLAGS, NEVER A BLOCK") while the transport happily
 * turned their WARN into a host-level deny. Prose is not enforcement: the
 * manifest now declares severity and the dispatcher enforces the ceiling.
 */
export function _is_advisory(concern: JsonObject): boolean {
  return String(concern["severity"] ?? "").trim().toLowerCase() === "advisory";
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
  /**
   * Measurement-only: read stdin, build the envelope, exit. See `--read-exit`.
   *
   * OPTIONAL, unlike `dry_run` beside it, and the asymmetry is deliberate: this
   * flag exists for one bench cell, so every caller that constructs an `Args`
   * by hand — eight test fixtures across three files — would otherwise have to
   * name a field it has no opinion about. `_parse_args` still sets it
   * explicitly, so the production path never reads an absent value.
   */
  read_exit?: boolean;
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
 * Minimal manifest loader — the retired Python implementation prefers PyYAML and falls
 * back to `_fallback_yaml` only when PyYAML is absent. The TS runtime
 * always ships the `yaml` package, so this mirrors the PyYAML-present
 * path (`yaml.safe_load(text) or {}`); version 1.1 matches PyYAML.safe_load.
 */
/**
 * Cheap content fingerprint of a manifest source — FNV-1a 32-bit plus the byte
 * length, hex.
 *
 * Deliberately NOT a crypto hash: `require('node:crypto')` costs 8 ms of
 * process start, which is most of what the precompiled manifest exists to
 * save. This runs in about 0.2 ms over 61 kB and only has to detect an edited
 * source, not resist an adversary — a wrong answer costs the slow path, never
 * correctness.
 */
export function _manifest_fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16)}:${String(text.length)}`;
}

export function _load_yaml(p: string): JsonObject {
  // Precompiled fast path. The manifest is ~61 kB of YAML and is parsed on
  // EVERY dispatch, which measured 12 ms of a ~103 ms dispatch (plus 8 ms to
  // load the `yaml` module itself). The sibling `.json` is the same data with
  // comments stripped — 14.7 kB — and JSON.parse of it is sub-millisecond.
  //
  // Freshness is decided by the SOURCE CONTENT, not by mtime. The first version
  // of this compared mtimes and that was a measured defect, not a theoretical
  // one: on a fresh `actions/checkout` both files get the checkout timestamp in
  // whatever order git wrote them, so whether the optimisation applied at all
  // was a coin flip. It won on the PR (p95 129 ms) and lost on the trunk
  // (p95 186 ms) for the same commit. A fingerprint is deterministic wherever
  // the tree came from.
  //
  // Reading the YAML unconditionally costs ~0 ms (it is the PARSE that is
  // expensive), so the fast path still skips ~20 ms.
  const text = fs.readFileSync(p, "utf-8");
  const compiled = p.replace(/\.ya?ml$/u, ".json");
  if (compiled !== p) {
    try {
      const raw = JSON.parse(fs.readFileSync(compiled, "utf-8")) as JsonValue;
      if (
        _isObject(raw) &&
        raw["fingerprint"] === _manifest_fingerprint(text) &&
        _isObject(raw["manifest"])
      ) {
        return raw["manifest"];
      }
    } catch {
      // Missing, unreadable or malformed → fall through to the YAML source.
      // Never fail the dispatch on the optimisation.
    }
  }
  const data = parseYaml(text, { version: "1.1" }) as JsonValue;
  return _isObject(data) ? data : {};
}


interface ConcernDef extends JsonObject {
  name: string;
}

/**
 * The tool name the host reported for this event, or `""`.
 *
 * Only tool events carry one. Read defensively: the payload is host-shaped and
 * a missing / non-string field must degrade to "unknown tool", never throw.
 */
export function _payload_tool_name(envelope: JsonObject): string {
  const payload = envelope["payload"];
  if (!_isObject(payload)) {
    return "";
  }
  const raw = payload["tool_name"];
  return typeof raw === "string" ? raw : "";
}

/**
 * Per-concern tool filter — the `tools:` key.
 *
 * 13 concerns fire on EVERY tool call (6 pre + 7 post), and three of them
 * already re-read `tool_name` and return early — after the dispatcher has
 * already spawned the work. A concern may now declare which tools it cares
 * about, and the dispatcher skips it in-process for everything else.
 *
 * ## Why the filter is here and not in the generated host config
 *
 * The obvious alternative is a host `matcher` per concern group. Rejected on
 * two measurements:
 *
 * - `build_claude_hook_matrix` collapses each event to ONE command string, and
 *   `claude_hook_matrix_parity.test.ts` asserts exactly one group per event with
 *   exactly one command. Per-concern matchers mean per-concern groups, which
 *   breaks that parity contract for a filter the dispatcher can apply itself.
 * - A host matcher would only help the two hosts that support one (Claude,
 *   Gemini). The in-process skip helps all eight platforms in the manifest.
 *
 * ## What this does NOT claim
 *
 * It does not claim a latency win. The measured hook cost that was fixed was
 * the *invocation path* (~370 of ~450–500 ms was eager CLI imports); nothing in
 * the tree measures how much of the current ~84 ms p95 the concern bodies
 * account for. `bench_hook_latency` reads the manifest, so the claim is
 * benchable — it is simply not yet benched, and is therefore not asserted.
 * What IS true without a benchmark: a concern that cannot fire on a tool no
 * longer runs at all, instead of running and returning early.
 *
 * Absent `tools:` → the concern runs on every event, unchanged. `"*"` is the
 * explicit form of the same thing. Matching is exact on the host's `tool_name`.
 * A non-tool event (session_start, stop, …) reports no tool name and is NEVER
 * filtered — a lifecycle concern must not be silently skipped by a key that
 * only describes tool events.
 */
export function _concern_matches_tool(concern: JsonObject, tool_name: string): boolean {
  const raw = concern["tools"];
  if (raw === undefined || raw === null) {
    return true;
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    // A malformed or empty filter must not silence a concern — fail toward
    // running it, the same direction `fail_closed` guards take.
    return true;
  }
  const names = raw.filter((t): t is string => typeof t === "string");
  if (names.length === 0 || names.includes("*")) {
    return true;
  }
  // No tool in the payload → not a tool event (or a host that omits it).
  // Either way this key cannot decide, so it does not.
  if (tool_name === "") {
    return true;
  }
  return names.includes(tool_name);
}

/**
 * Role axis (road-to-token-economy-dispatch Phase 2): the set of concern
 * names the given role drops. Empty for `orchestrator`, for a role without
 * a manifest entry (fail-open, 2.4), and ALWAYS for `pre_tool_use` — the
 * safety-guard slot is structurally undroppable (2.3); `lint_hook_manifest`
 * additionally rejects a drop entry bound to that slot at CI time.
 */
export function _role_drop_set(
  manifest: JsonObject,
  role: string,
  event: string,
): Set<string> {
  if (!role || role === "orchestrator" || event === "pre_tool_use") {
    return new Set();
  }
  const rolesRaw = manifest["roles"];
  const roleSpec = _isObject(rolesRaw) ? rolesRaw[role] : undefined;
  if (!_isObject(roleSpec)) {
    return new Set(); // unknown role → full chain (fail-open)
  }
  const drop = roleSpec["drop"];
  if (!Array.isArray(drop)) {
    return new Set();
  }
  return new Set(drop.filter((d): d is string => typeof d === "string"));
}

/**
 * True when this `stop` is the RETRY of a turn a stop-hook already refused.
 *
 * The host sets `stop_hook_active` on exactly that Stop; `turn_end_gate_hook`
 * reads the same field as its layer-1 re-entrancy guard, so this is the host's
 * own answer rather than an inference of ours. Anything unparseable is `false`,
 * which is the full chain — the safe direction, since the cost of running a
 * concern twice is duplicate work and the cost of skipping one wrongly is a lost
 * write.
 */
export function _is_refusal_retry(event: string, payload_text: string): boolean {
  if (event !== "stop") return false;
  try {
    const parsed: unknown = JSON.parse(payload_text);
    if (!_isObject(parsed)) return false;
    const payload = parsed["payload"];
    const source = _isObject(payload) ? payload : parsed;
    return source["stop_hook_active"] === true;
  } catch {
    return false;
  }
}

/**
 * Return the ordered concern definitions for (platform, event) under the
 * given session role (default `orchestrator` — byte-identical to the
 * pre-role-axis behaviour).
 *
 * `opts.refusal_retry` drops concerns that opted in with
 * `skip_on_refusal_retry: true` — `road-to-stop-gate-honesty` step 3.1. Stop is
 * the heaviest slot on claude and **every refused Stop runs the whole slot again
 * on the retry** (§ D-3), so the concerns whose second run provably produces the
 * identical artefact are pure duplicate cost.
 *
 * Opt-in per concern, default off, never a blanket skip: Risk 3 of that roadmap
 * is that a concern skipped on the retry might have been the one that needed the
 * second pass, and the loss would be silent. The manifest carries the per-concern
 * argument beside each flag.
 */
export function _resolve_concerns(
  manifest: JsonObject,
  platform: string,
  event: string,
  role: SessionRole = "orchestrator",
  opts: { refusal_retry?: boolean } = {},
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
  const dropped = _role_drop_set(manifest, role, event);
  const concernsRaw = manifest["concerns"];
  const concerns_def = _isObject(concernsRaw) ? concernsRaw : {};
  const out: ConcernDef[] = [];
  for (const name of names) {
    if (typeof name === "string" && dropped.has(name)) {
      continue; // role-dropped orchestrator-only concern
    }
    const spec = typeof name === "string" ? concerns_def[name] : undefined;
    if (!spec || !_isObject(spec)) {
      process.stderr.write(
        `dispatch_hook: unknown concern '${String(name)}' in manifest\n`,
      );
      continue;
    }
    if (opts.refusal_retry && spec["skip_on_refusal_retry"] === true) {
      continue;
    }
    out.push({ name: String(name), ...spec });
  }
  return out;
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
 * Resolve how to run a `.ts` concern: prefer the `tsx` binary from a
 * `node_modules/.bin` directory found by walking up from the script's
 * directory, then from THIS module's own package tree (the package ships
 * tsx as a runtime dependency); only then fall back to `npx tsx`. Mirrors
 * `run.ts::resolveTsxInvocation` so concern scripts run as TypeScript with
 * no python3 dependency. `npx tsx` is last-resort only: it runs against the
 * consumer's npm config and fails hard on e.g. devEngines pins (the 8.1.0
 * EBADDEVENGINES regression).
 */
function _resolve_tsx_invocation(
  scriptPath: string,
  scriptArgs: string[],
): { command: string; args: string[] } {
  const binName = process.platform === "win32" ? "tsx.cmd" : "tsx";
  const walkUp = (start: string): string | null => {
    let dir = start;
    for (;;) {
      const candidate = path.join(dir, "node_modules", ".bin", binName);
      if (_isFile(candidate)) {
        return candidate;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        return null;
      }
      dir = parent;
    }
  };
  const tsx =
    walkUp(path.dirname(scriptPath)) ??
    walkUp(path.dirname(fileURLToPath(import.meta.url)));
  if (tsx !== null) {
    return { command: tsx, args: [scriptPath, ...scriptArgs] };
  }
  return { command: "npx", args: ["tsx", scriptPath, ...scriptArgs] };
}

/**
 * Invoke one concern with the envelope on stdin.
 *
 * Concerns run with CWD = consumer workspace (envelope.workspace_root),
 * NOT the agent-config package root — concerns resolve `agents/runtime/state/`
 * and other consumer-local paths relative to CWD. The script *itself*
 * lives in the package (REPO_ROOT), so we resolve it absolutely.
 *
 * Concern scripts are TypeScript (`.ts`) — the dispatcher invokes them
 * through `tsx` (resolved from the package's `node_modules/.bin`, falling
 * back to `npx tsx`), mirroring how `run.ts` runs its `.ts` twins.
 */
/**
 * Single-process dispatch (road-to-credible-install Phase 1): run a concern
 * IN-PROCESS via the static registry instead of re-spawning a per-concern
 * interpreter. Mirrors the child-process contract exactly — stdin via the
 * hook_stdin override, argv swap, cwd = workspace, hardened env, captured
 * stdout/stderr, crash → rc 3 (the caller applies the fail-open /
 * fail-closed reduction unchanged).
 *
 * Escape hatch: AGENT_CONFIG_HOOKS_ISOLATED=1 forces the historical
 * spawn-per-concern path (also used by the bench harness for A/B numbers).
 *
 * Known trade-off vs the spawn path: the 30 s kill-timeout cannot preempt
 * in-process synchronous code. Concerns are repo-owned, budget-capped and
 * fail-open; the latency budget gate (hook-latency-budget.json) is the
 * standing regression net.
 */
/**
 * ## Why this still re-serialises the envelope per concern (step 1.1, MEASURED NULL)
 *
 * `setHookStdinOverride` takes text, so every concern re-stringifies the whole
 * envelope — tool result included. On `post_tool_use` with the claude chain
 * bound that is eleven serialisations of the same payload per tool call, which
 * `road-to-per-turn-hook-economy` D-2 named as a cost worth removing.
 *
 * It was removed, measured against a pre-registered bar, and **put back**. Two
 * A/B runs on one machine, 2 MB payload, bundle arm, `post_tool_use` p50:
 * 166 → 135 ms (−18.7 %) at n=15, then 139 → 143 ms (**+2.9 %**) at n=25. The
 * runs disagree in SIGN, and the within-arm spread (p95 190–228 ms on the same
 * arm) is larger than the effect. That is the pre-registration's kill outcome:
 * under 5 %, publish the null and stop the phase.
 *
 * So the hoist is not here, deliberately, and this comment is the reason —
 * without it the next reader re-derives an "obvious" optimisation that has
 * already been tried and did not pay.
 *
 * One property to preserve if anyone re-attempts it: share the **serialised
 * string**, never a parsed object. The per-concern re-serialisation is
 * accidentally an isolation boundary (risk 1), and a string cannot be mutated by
 * one concern for the next. Pinned by
 * `tests/scripts/hooks/dispatch_envelope_isolation.test.ts`.
 */
function _run_concern_inproc(
  main_fn: ConcernMain,
  concern: ConcernDef,
  envelope: JsonObject,
): RunResult {
  const scriptAbs = path.join(REPO_ROOT, String(concern["script"]));
  const argsList = Array.isArray(concern["args"])
    ? concern["args"].map((a) => String(a))
    : [];
  argsList.push("--platform", String(envelope["platform"] || "generic"));
  const workspace = String(envelope["workspace_root"] || process.cwd());

  let out = "";
  let err = "";
  type WriteFn = typeof process.stdout.write;
  const makeCapture =
    (sink: (s: string) => void): WriteFn =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((chunk: any, enc?: any, cb?: any): boolean => {
      sink(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf-8"));
      const callback = typeof enc === "function" ? enc : cb;
      if (typeof callback === "function") callback();
      return true;
    }) as WriteFn;

  const prevStdoutWrite = process.stdout.write;
  const prevStderrWrite = process.stderr.write;
  const prevArgv = process.argv;
  const prevCwd = process.cwd();
  const prevEnv = { ...process.env };

  const started = performance.now();
  let rc = 0;
  setHookStdinOverride(_compactJsonDumps(envelope));
  process.stdout.write = makeCapture((s) => {
    out += s;
  });
  process.stderr.write = makeCapture((s) => {
    err += s;
  });
  try {
    process.argv = [prevArgv[0] as string, scriptAbs, ...argsList];
    // Same env-hardening the spawn path applied — concerns may spawn their
    // own children (dashboard regen, git), which inherit process.env.
    const hardened = hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT });
    for (const k of Object.keys(process.env)) {
      if (!(k in hardened)) delete process.env[k];
    }
    Object.assign(process.env, hardened);
    if (workspace !== prevCwd && _isDir(workspace)) {
      process.chdir(workspace);
    }
    const result = main_fn(argsList);
    rc = typeof result === "number" ? result : 0;
  } catch (exc) {
    rc = 3;
    const msg = exc instanceof Error ? (exc.stack ?? exc.message) : String(exc);
    err += `${String(concern["name"])}: ${msg}\n`;
    log_dispatch_issue(
      workspace,
      String(concern["name"] || "unknown"),
      "execution_failed",
      `in-process concern crashed: ${exc instanceof Error ? exc.message : String(exc)}`,
      fix_hint(),
    );
  } finally {
    process.stdout.write = prevStdoutWrite;
    process.stderr.write = prevStderrWrite;
    process.argv = prevArgv;
    for (const k of Object.keys(process.env)) {
      if (!(k in prevEnv)) delete process.env[k];
    }
    Object.assign(process.env, prevEnv);
    try {
      if (process.cwd() !== prevCwd) process.chdir(prevCwd);
    } catch {
      /* original cwd vanished — keep going, fail-open */
    }
    clearHookStdinOverride();
  }
  const elapsed = Math.floor(performance.now() - started);
  return { rc, stderr: err, stdout: out, duration_ms: elapsed };
}

function _run_concern(concern: ConcernDef, envelope: JsonObject): RunResult {
  // In-process fast path — the default whenever the concern is in the
  // static registry (all manifest concerns; parity is CI-enforced).
  if (process.env["AGENT_CONFIG_HOOKS_ISOLATED"] !== "1") {
    const inproc = CONCERN_REGISTRY[String(concern["script"])];
    if (inproc !== undefined) {
      return _run_concern_inproc(inproc, concern, envelope);
    }
  }
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
  // Consumer-runtime concern dispatch: scrub code-execution-injection env
  // vectors (loader / git-config / NODE_OPTIONS / …) before spawning each
  // concern, then set the package-root marker as an explicit override.
  const concern_env = hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT });

  const started = performance.now();
  const { command, args: spawnArgs } = _resolve_tsx_invocation(script, cmd.slice(1));
  const proc = spawnSync(command, spawnArgs, {
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
    "payload_bodies",
    "payload_stubs",
  ]);
  const summary: JsonObject = {
    schema_version: 1,
    session_id,
    // Run-level roll-up of step 2.1's counter: how many payload bodies this
    // dispatch omitted across the whole chain. A number, never a body.
    payload_stubs_served: entries.reduce(
      (n, e) => n + (typeof e["payload_stubs"] === "number" ? e["payload_stubs"] : 0),
      0,
    ),
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
    // P3 of `b-stop-async-split-prerequisites` (council 2026-08-20, option (a)).
    //
    // WAS: one `summary.json` per session, published by `atomic_write_json`.
    // The publish is atomic and that was never the problem — the PATH is one,
    // so two dispatches in the same session (parallel tool calls on this host,
    // or two platforms installed into one workspace) both wrote it and the later
    // rename discarded the earlier rollup entirely. Evidence loss, silent.
    //
    // The fix is the per-invocation discriminator the blocker names, held INSIDE
    // one file rather than fanned out across per-invocation filenames. Both
    // were considered and the file-per-invocation form was refused on growth:
    // the feedback tree is not pruned, so a 200-tool-call session would leave
    // 200 rollups per session dir, and capping THAT needs a directory scan on
    // the hot path. A capped list needs one locked read-modify-write, which is
    // the same primitive `rule-trips.json` now uses for the same reason.
    //
    // `invocation` is pid + monotonic clock: unique per dispatch without a
    // shared counter, and ordered within one process.
    const invocation = `${String(process.pid)}-${process.hrtime.bigint().toString()}`;
    update_json_under_lock<JsonObject>(path.join(fb_dir, "summary.json"), (loaded) => {
      const priorRaw = (loaded as JsonObject)["invocations"];
      const prior = Array.isArray(priorRaw) ? priorRaw : [];
      const next = [...prior, { invocation, ...summary }];
      return {
        schema_version: 2,
        session_id,
        // Newest last, oldest dropped — the same rotation direction
        // `dispatch-issues.jsonl` uses, so a reader learns one convention.
        invocations: next.slice(Math.max(0, next.length - SUMMARY_INVOCATION_CAP)),
      };
    });
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    process.stderr.write(`dispatch_hook: summary write failed: ${msg}\n`);
  }
}

/**
 * How many invocation rollups one session's `summary.json` retains.
 *
 * 20, matching nothing in particular and stated as such: the file is a human
 * debugging surface, twenty dispatches is more than a reader scrolls, and the
 * value exists to bound growth rather than to preserve a measured window.
 * `dispatch-issues.jsonl` caps at 200 because it holds FAILURES, which are rare;
 * this holds every dispatch, which is not.
 */
export const SUMMARY_INVOCATION_CAP = 20;

/**
 * Checkable-rule trip counting (road-to-credible-install Phase 6, scoped P3
 * cut): every concern that returns BLOCK (1) or WARN (2) — a violation the
 * gate actually caught — increments a per-concern counter in
 * `agents/runtime/state/rule-trips.json`. Extends the existing dispatcher
 * feedback machinery only; the evaluator/umbrella surfaces read this file.
 *
 * PII-exclusion-by-construction: the schema carries ONLY concern ids,
 * integer counters, and ISO dates — no field capable of holding free-form
 * content, prompt text, or file bodies. Never widen it.
 *
 * Fail-open (a broken counter must never affect dispatch), skipped in
 * replay mode like the feedback dir.
 */
function _record_rule_trips(envelope: JsonObject, entries: FeedbackEntry[]): void {
  if (is_replay_mode()) return;
  const tripped = entries.filter(
    (e) => e["exit_code"] === EXIT_BLOCK || e["exit_code"] === EXIT_WARN,
  );
  if (tripped.length === 0) return;
  try {
    const workspace = String(envelope["workspace_root"] || process.cwd());
    const state_dir = path.join(workspace, "agents", "runtime", "state");
    const target = path.join(state_dir, "rule-trips.json");
    const today = _now_iso().slice(0, 10);
    // P3 of `b-stop-async-split-prerequisites` (council 2026-08-20, option (a)).
    // The read used to sit OUTSIDE the lock: `readFileSync` here,
    // `atomic_write_json` there. `atomic_write_json` makes the PUBLISH atomic
    // and says nothing about load → increment → publish, so two concurrent
    // dispatchers both loaded `block: 3`, both computed 4, and one trip
    // vanished. `update_json_under_lock` holds all three steps under one lock,
    // which is the primitive that already exists for exactly this shape.
    //
    // The worse form is a lost FIELD, not a lost increment: this mutator
    // republishes the whole `concerns` map, so a counter another dispatcher
    // wrote in between would be reverted rather than merely missed.
    update_json_under_lock<JsonObject>(target, (loaded) => {
      const doc: JsonObject = { schema_version: 1, concerns: {}, ...(loaded as JsonObject) };
      const concernsRaw = doc["concerns"];
      const concerns = (
        _isObject(concernsRaw) ? concernsRaw : {}
      ) as Record<string, JsonObject>;
      for (const e of tripped) {
        const name = String(e["concern"]);
        const prevRaw = concerns[name];
        const prev = (_isObject(prevRaw) ? prevRaw : { block: 0, warn: 0 }) as JsonObject;
        concerns[name] = {
          block: (Number(prev["block"]) || 0) + (e["exit_code"] === EXIT_BLOCK ? 1 : 0),
          warn: (Number(prev["warn"]) || 0) + (e["exit_code"] === EXIT_WARN ? 1 : 0),
          last_trip: today,
        };
      }
      doc["schema_version"] = 1;
      doc["concerns"] = concerns;
      return doc;
    });
  } catch {
    /* fail-open — counters are observability, never dispatch-critical */
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
    read_exit: false,
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
      case "--read-exit":
        args.read_exit = true;
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

  // ── `--read-exit`: the transport-isolation cell ─────────────────────────────
  //
  // `b-payload-read-parse-dominates`, option (a), council 2026-08-20 (2/2
  // quorum): "add a same-fixture dispatcher cell that reads stdin and exits
  // immediately, reporting its own latency and its share of the large-payload
  // delta".
  //
  // WHY IT LIVES IN THE DISPATCHER rather than in a standalone probe script.
  // The term being isolated is `readFd0ToEnd` + one `JSON.parse` of the same
  // payload, and it must be measured through the SAME process shape as the
  // slot it is a share of — same interpreter, same bundle, same spawn. A
  // separate probe would have to re-implement the audited retrying reader, and
  // a copy of that reader is precisely the drift `hook_stdin` was consolidated
  // to remove. Bundle load does not vary with payload size, so it cancels in
  // the large-minus-small delta, which is the number the option asks for.
  //
  // Measurement-only, and it exits BEFORE the manifest load, the concern
  // resolution and every concern — so it can neither run a guard nor suppress
  // one. Same exposure `--dry-run` already carries: reaching it requires
  // editing the installed hook command, and anyone who can do that can delete
  // the hook instead.
  if (args.read_exit === true) {
    const probe = tty.isatty(0) ? { text: "", failure: null } : stdinReadFailure();
    if (probe.failure !== null) {
      process.stderr.write(`dispatch_hook: --read-exit read failed: ${probe.failure}\n`);
      return EXIT_ALLOW;
    }
    // The parse is the half of the term under test, so it must actually happen
    // and its result must be observable — otherwise a future optimiser could
    // elide it and the cell would silently measure the read alone.
    const envelope = _build_envelope(args, probe.text);
    process.stderr.write(
      `dispatch_hook: --read-exit ok (${probe.text.length} chars, ` +
        `${Object.keys(_isObject(envelope["payload"]) ? envelope["payload"] : {}).length} payload keys)\n`,
    );
    return EXIT_ALLOW;
  }

  if (!EVENT_VOCABULARY.has(args.event)) {
    process.stderr.write(
      `dispatch_hook: unknown event '${args.event}'; allowed: ` +
        `${_sortedRepr(EVENT_VOCABULARY)}\n`,
    );
    return EXIT_ALLOW; // fail-open per contract for unknown events
  }

  // ── The capture rate: both halves, written here ─────────────────────────────
  //
  // Two calls rather than one, because they must be able to FAIL DIFFERENTLY.
  // `recordOpportunity` is the denominator's independent writer — in-process,
  // no daemon — so a dead collector yields a climbing denominator against a
  // flat numerator and the rate falls instead of reading 0/0.
  // `recordCapture` is the numerator, and its absence was a real defect three
  // review rounds took to find: `spoolRecord` had no production caller, so the
  // rate was 0 % for a wiring omission and nothing could tell that from a
  // capture failure. Both are gated on the opt-in marker, never throw, and cost
  // two `existsSync` calls on a default-off install. Rationale, ordering and
  // the self-observation exclusion live in `collector_denominator.ts`.
  //
  // Placed after the vocabulary check so an unknown event is not an
  // opportunity, and before the manifest load so a missing manifest still is.
  if (!isSelfObservation()) {
    recordOpportunity(args.event, args.platform);
    recordCapture(args.event, args.platform);
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

  // `tty.isatty(0)`, NOT `process.stdin.isTTY`: reading the latter constructs
  // the stdin stream and puts fd 0 into non-blocking mode, after which the read
  // below throws EAGAIN on any payload above the pipe buffer and silently
  // yields an EMPTY envelope. That is a measured guard bypass, not a theory —
  // see readFd0ToEnd's header in hooks/hook_stdin.ts.
  const read = tty.isatty(0) ? { text: "", failure: null } : stdinReadFailure();
  const payload_text = read.text;
  _stdin_read_failed = read.failure;
  if (_stdin_read_failed !== null) {
    // NEVER silent: an empty envelope reached from a failed read means every
    // guard on this event evaluated nothing. The exit code is unchanged (see
    // `_stdin_read_failed`), so this line and the dispatch issue are the only
    // signal that the chain ran blind.
    process.stderr.write(
      `dispatch_hook: STDIN READ FAILED (${_stdin_read_failed}) — the concern ` +
        `chain for '${args.event}' ran against an EMPTY payload and could not ` +
        `evaluate anything. This is not an empty stdin.\n`,
    );
    try {
      log_dispatch_issue(
        process.cwd(),
        "dispatcher",
        "execution_failed",
        `stdin read failed on ${args.event}: ${_stdin_read_failed} — chain ran with an empty payload`,
        fix_hint(),
      );
    } catch {
      // observability never breaks the hook
    }
  }
  _maybe_capture_payload(args, payload_text);
  const session_role = resolveSessionRole(process.env);
  const refusal_retry = _is_refusal_retry(args.event, payload_text);
  const concerns = _resolve_concerns(manifest, args.platform, args.event, session_role, {
    refusal_retry,
  });

  if (args.dry_run) {
    const plan = {
      platform: args.platform,
      event: args.event,
      role: session_role,
      refusal_retry,
      concerns: concerns.map((c) => c["name"]),
    };
    process.stdout.write(_py_json_dumps(plan, 2) + "\n");
    return EXIT_ALLOW;
  }

  if (concerns.length === 0) {
    return EXIT_ALLOW; // platform unsupported / fallback-only / empty slot
  }

  // `b-stdin-read-failure-policy` option (c). Placed HERE, not at the read:
  // the decision needs the resolved concern list, because the whole question is
  // whether a fail-closed blocking guard was among the ones that just ran
  // blind. Before the dry-run branch it would turn a plan printer into a
  // refusal; after the chain it would spend the chain first.
  if (_stdin_read_failed !== null) {
    const deny = denyOnStdinFailure(args.platform, args.event, concerns, _stdin_read_failed);
    if (deny !== null) {
      const emission = emitFor(args.platform, args.event, "block", [deny.reason], EXIT_BLOCK);
      if (emission.stdout) process.stdout.write(emission.stdout);
      if (emission.stderr) process.stderr.write(emission.stderr);
      return emission.exit;
    }
  }

  const envelope = _build_envelope(args, payload_text);
  const session_id = _resolve_session_id(envelope);
  const started_at = _now_iso();
  const rcs: number[] = [];
  const feedback_entries: FeedbackEntry[] = [];
  // session_start context forwarding (road-to-second-brain Phase 1): a
  // concern may return {"context": "<string>"} in its stdout JSON; on
  // session_start the dispatcher forwards those blocks to its OWN stdout so
  // the host adds them to the session context (Claude Code SessionStart
  // stdout-injection; harmless surfacing elsewhere). All other events keep
  // the swallow-stdout contract unchanged.
  const context_blocks: string[] = [];
  // Per-concern message for the host emission (P0.1). Kept OUT of
  // feedback_entries on purpose: that record is written to disk with a
  // fixed-field schema (PII-exclusion-by-construction), and a concern's raw
  // stderr is free-form content. This array is in-memory only.
  const concern_messages: ConcernMessage[] = [];
  // Per-concern `tools:` filter (see _concern_matches_tool). Applied here so it
  // is one place, after the envelope exists and before any concern is spawned.
  const tool_name = _payload_tool_name(envelope);
  // Payload opt-in (step 2.1). There are at most FOUR distinct envelope shapes
  // per dispatch (keep neither / input / result / both), so they are memoised
  // by keep-set: concerns sharing a declaration share one clone, and building
  // one per concern would re-pay the allocation the stub exists to avoid.
  // `present` is the set of body classes this event actually carries — empty on
  // every non-tool event, which is why those pay nothing at all.
  // Payload opt-in (step 2.1). One planner owns the whole decision — which
  // classes are present, which any concern loses, the single measurement pass,
  // and the at-most-four envelope shapes — so the loop below reads a shape
  // rather than re-deriving one. Rationale and cost model: payload_stub.ts.
  const keep_by_concern = concerns.map(
    (c) => [c, _concern_body_classes(c)] as const,
  );
  const shapes = planPayloadShapes(
    envelope,
    keep_by_concern.map(([, keep]) => keep),
  );
  for (const [concern, keep_classes] of keep_by_concern) {
    if (!_concern_matches_tool(concern, tool_name)) {
      continue;
    }
    const concern_envelope = shapes.shapeFor(keep_classes);
    const stubs_served = shapes.stubsFor(keep_classes);
    // What was actually SERVED, not what was declared. Recording the
    // declaration made the record wrong in both directions on a body-less
    // event: a blocking `stop` concern read "input,result" for bodies it can
    // never receive, and an advisory one read "none" while the full envelope
    // went to it untouched.
    const served_classes = shapes.servedBy(keep_classes);
    const concern_started = _now_iso();
    const { rc: rawRcResult, stderr: stderr_text, stdout: stdout_text, duration_ms } =
      _run_concern(concern, concern_envelope);
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
    // P0.2 severity ceiling: an advisory concern can never block, on any host.
    // This covers BOTH the concern emitting EXIT_BLOCK directly and the
    // fail_closed promotion above turning a crash into a block.
    if (rc === EXIT_BLOCK && _is_advisory(concern)) {
      process.stderr.write(
        `dispatch_hook: concern '${String(concern["name"])}' is declared ` +
          `severity: advisory but returned BLOCK — downgraded to warn.\n`,
      );
      rc = EXIT_WARN;
    }
    rcs.push(rc);
    const reply = _parse_concern_stdout(stdout_text);
    // A concern states its reason either as JSON {"reason": …} on stdout
    // (advisory concerns) or as a formatted stderr line (the block guards, e.g.
    // `block-no-verify: BLOCKED — …`). Both are captured here so the emission
    // layer can surface the REAL message instead of a generic label; before
    // this, a rc=1 block discarded the concern's stderr entirely.
    const stated =
      typeof reply["reason"] === "string" && (reply["reason"] as string).trim()
        ? (reply["reason"] as string).trim()
        : stderr_text.trim();
    // `additional_context` — the longer, model-facing half of a concern's
    // reply. The contract has promised since v1 that it is forwarded and
    // "concatenated with \n\n separators"
    // (docs/contracts/hook-architecture-v1.md § reply shape), but nothing here
    // ever read the key: `reason` is capped at ~200 chars by convention and is
    // written for a human reading stderr, so every concern that put its
    // actionable instruction in `additional_context` delivered it nowhere.
    // Found 2026-08-06 by tracing why the language-mirror pin reached the model
    // on no path; `pr_url_reminder` had the same silent gap, and its own header
    // calls `additional_context` "what surfaces back to the model".
    const extra =
      typeof reply["additional_context"] === "string" &&
      (reply["additional_context"] as string).trim()
        ? (reply["additional_context"] as string).trim()
        : "";
    const message = [stated, extra].filter(Boolean).join("\n\n");
    if (message) {
      concern_messages.push({ rc, text: message, def: concern });
    }
    if (
      args.event === "session_start" &&
      rc === EXIT_ALLOW &&
      typeof reply["context"] === "string" &&
      (reply["context"] as string).trim()
    ) {
      context_blocks.push((reply["context"] as string).trim());
    }
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
      // Step 2.1's counter — an EXPOSURE denominator, not a detector, and the
      // review was right to refuse the stronger reading: these numbers are a
      // function of the declaration and the payload shape, so they say how
      // often a concern ran without a body, never whether it wanted one. The
      // detector for the wanting-one case is the source-derived check in
      // `lint_hook_manifest`, at authoring time, where it is decidable.
      // A sorted class list and an integer — nothing that can hold a body.
      payload_bodies: served_classes.join(",") || "none",
      payload_stubs: stubs_served,
    });
  }
  const final_rc = _reduce(rcs);
  _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at);
  _record_rule_trips(envelope, feedback_entries);
  if (context_blocks.length > 0 && final_rc === EXIT_ALLOW) {
    process.stdout.write(context_blocks.join("\n\n") + "\n");
  }

  // P0.1 host-semantics translation. The internal ladder (0/1/2) is written to
  // the feedback dir verbatim above — that record is unchanged. What leaves the
  // process is now the HOST's native contract, because the two languages
  // disagree: on Claude Code exit 1 does not block and exit 2 does, which
  // inverted every verdict (see host_semantics.ts for the documented mapping).
  // Unverified platforms keep the legacy pass-through byte-for-byte.
  // Emission shaping (nudge exclusivity + per-turn byte ceiling) also owns the
  // deciding-severity filter this line used to apply. See injection_budget.ts.
  const decidingReasons = shapeAndRecord(
    { packageRoot: REPO_ROOT, envelope, platform: args.platform, event: args.event },
    concern_messages,
    final_rc,
  );
  const emission = emitFor(
    args.platform,
    args.event,
    _severity_for(final_rc) as Severity,
    decidingReasons,
    final_rc,
  );
  if (emission.stdout) {
    process.stdout.write(emission.stdout);
  }
  if (emission.stderr) {
    process.stderr.write(emission.stderr);
  }
  return emission.exit;
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

/**
 * Set when the stdin read FAILED, as distinct from stdin being genuinely empty.
 *
 * The two were indistinguishable, and that was the second half of the bypass
 * F-1 records: removing the EAGAIN *trigger* still left `catch { return "" }`
 * converting any residual failure — an exhausted retry budget, `EIO`, `EBADF` —
 * into "no input", after which the whole chain runs with no `tool_name` and the
 * dispatcher exits 0. For a `fail_closed: true`, `severity: blocking` guard that
 * is an allow, emitted silently. Found by the R2 review.
 *
 * The failure is LOUD (stderr + a dispatch issue) on every slot, and since
 * `b-stdin-read-failure-policy` was decided (council 2026-08-20, option (c)) it
 * also DENIES — but only where a deny is honoured and a fail-closed blocking
 * concern was among the ones that ran blind. See `denyOnStdinFailure` for the
 * policy and for why the two broader options were refused.
 */
let _stdin_read_failed: string | null = null;


// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (declare at top of file).
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
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
