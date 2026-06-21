#!/usr/bin/env node
/**
 * Local replay of the router against a corpus — pure, no API spend.
 *
 * TypeScript twin of `src/scripts/router_telemetry.py` (ADR-089 —
 * Python→TS migration, Phase 7). Mirrors the Python CLI contract
 * exactly: flags (`--corpus`, `--sample-cap`, `--profile`, `--out`,
 * `--quiet`), exit codes, stdout/stderr split, byte-identical messages,
 * and byte-identical generated report JSON.
 *
 * Phase 3 of `agents/roadmaps/road-to-value-dashboard-netto-cuts.md`.
 *
 * For each prompt in a corpus, applies the same trigger-match logic
 * agent hosts would apply at runtime against `dist/router.json`:
 *
 * - kernel rules: always active (no triggers, always-on by definition).
 * - tier_1 + tier_2 rules: active iff any trigger matches the prompt
 *   text (plus optional open-files / command context).
 *
 * Trigger semantics implemented:
 *
 *   | Type           | Match rule                                                       |
 *   |----------------|------------------------------------------------------------------|
 *   | `keyword`      | case-insensitive substring inside the prompt text                |
 *   | `phrase`       | case-insensitive substring (multi-word) inside the prompt text   |
 *   | `command`      | case-sensitive prefix on `command:` field (optional context)     |
 *   | `intent`       | informational only — never auto-matches; counted separately      |
 *   | `path_prefix`  | prefix match against any path in `open_files` (optional context) |
 *   | `file_pattern` | fnmatch against any path in `open_files` (optional context)      |
 *
 * Reports go to `internal/bench/reports/router-telemetry/<UTC>.json`.
 *
 * Honours `--quiet` per the script-output convention.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, YAMLError } from "yaml";

// src/scripts/router_telemetry.ts → two levels up is the repo root
// (mirrors the Python module's parent.parent.parent resolution from
// src/scripts/router_telemetry.py).
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const ROUTER_JSON = path.join(REPO_ROOT, "dist", "router.json");
const DEFAULT_OUT_DIR = path.join(
  REPO_ROOT,
  "internal",
  "bench",
  "reports",
  "router-telemetry",
);
const DEFAULT_SAMPLE_CAP = 200;

// Track B corpus = the Panel B evidence basis; rules that fire on its
// tasks are the attribution map and become the untouchable set.
const TRACK_B_CORPUS_REL = "internal/bench/corpora/ab-trackb.yaml";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type Trigger = Record<string, JsonValue>;

interface Rule {
  id?: JsonValue;
  triggers?: JsonValue;
  [key: string]: JsonValue;
}

interface Router {
  kernel?: JsonValue;
  tier_1?: JsonValue;
  tier_2?: JsonValue;
  [key: string]: JsonValue;
}

function _log(msg: string, quiet: boolean, err = false): void {
  if (err) {
    process.stderr.write(`${msg}\n`);
  } else if (!quiet) {
    process.stdout.write(`${msg}\n`);
  }
}

/**
 * UTC ISO-8601 timestamp with seconds precision and an explicit
 * `+00:00` offset, mirroring Python's
 * `datetime.now(timezone.utc).isoformat(timespec="seconds")`.
 */
function _utc_iso(): string {
  // JS toISOString → e.g. "2026-06-12T03:05:37.123Z"; strip millis and
  // swap the trailing "Z" for "+00:00".
  const iso = new Date().toISOString();
  return iso.slice(0, 19) + "+00:00";
}

// ── fnmatch (Python fnmatch.fnmatch) ─────────────────────────────────────

/**
 * Translate a Unix shell pattern into a RegExp, matching CPython's
 * `fnmatch.translate`. `*` → `.*`, `?` → `.`, `[...]` char classes
 * preserved (with `!` → `^` negation), everything else escaped.
 * Matching is case-sensitive on POSIX (the corpus paths are POSIX).
 */
function _fnmatchToRegExp(pat: string): RegExp {
  let res = "";
  let i = 0;
  const n = pat.length;
  while (i < n) {
    const c = pat[i] as string;
    i += 1;
    if (c === "*") {
      res += ".*";
    } else if (c === "?") {
      res += ".";
    } else if (c === "[") {
      let j = i;
      if (j < n && pat[j] === "!") {
        j += 1;
      }
      if (j < n && pat[j] === "]") {
        j += 1;
      }
      while (j < n && pat[j] !== "]") {
        j += 1;
      }
      if (j >= n) {
        res += "\\[";
      } else {
        let stuff = pat.slice(i, j);
        if (!stuff.includes("-")) {
          stuff = stuff.replace(/\\/g, "\\\\");
        } else {
          // Faithful port of CPython's dash-handling in fnmatch.translate:
          // split the class body on `-` (bounded to [i, j)), escaping each
          // chunk, then re-join with `-` so ranges survive.
          const chunks: string[] = [];
          let k = pat[i] === "!" ? i + 2 : i + 1;
          let start = i;
          while (true) {
            const rel = pat.slice(k, j).indexOf("-");
            if (rel < 0) {
              break;
            }
            const idx = k + rel;
            chunks.push(pat.slice(start, idx));
            start = idx + 1;
            k = idx + 3;
          }
          chunks.push(pat.slice(start, j));
          stuff = chunks
            .map((s) => s.replace(/\\/g, "\\\\").replace(/-/g, "\\-"))
            .join("-");
        }
        // Escape regex set-meta chars except backslash/dash already handled.
        stuff = stuff.replace(/([&~|])/g, "\\$1");
        i = j + 1;
        if (stuff.startsWith("!")) {
          stuff = "^" + stuff.slice(1);
        } else if (stuff.startsWith("^") || stuff.startsWith("[")) {
          stuff = "\\" + stuff;
        }
        res += `[${stuff}]`;
      }
    } else {
      res += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^(?:${res})$`, "s");
}

function _fnmatch(name: string, pat: string): boolean {
  return _fnmatchToRegExp(pat).test(name);
}

// ── Trigger matching ─────────────────────────────────────────────────────

/** Apply one trigger to a prompt + context; return True on match. */
export function trigger_matches(
  trigger: Trigger,
  prompt: string,
  open_files?: Iterable<string> | null,
  command?: string | null,
): boolean {
  const prompt_lower = prompt.toLowerCase();
  if ("keyword" in trigger) {
    return prompt_lower.includes(String(trigger["keyword"]).toLowerCase());
  }
  if ("phrase" in trigger) {
    return prompt_lower.includes(String(trigger["phrase"]).toLowerCase());
  }
  if ("command" in trigger) {
    if (!command) {
      return false;
    }
    return command.startsWith(String(trigger["command"]));
  }
  if ("path_prefix" in trigger) {
    if (!open_files) {
      return false;
    }
    const pref = String(trigger["path_prefix"]);
    for (const p of open_files) {
      if (String(p).startsWith(pref)) {
        return true;
      }
    }
    return false;
  }
  if ("file_pattern" in trigger) {
    if (!open_files) {
      return false;
    }
    const pat = String(trigger["file_pattern"]);
    for (const p of open_files) {
      if (_fnmatch(String(p), pat)) {
        return true;
      }
    }
    return false;
  }
  if ("intent" in trigger) {
    // Intent triggers are informational and never auto-match.
    return false;
  }
  return false;
}

interface MatchedTrigger {
  tier: string;
  rule: JsonValue | undefined;
  trigger: Trigger;
}

interface ActivatedRule {
  tier: string;
  rule: JsonValue | undefined;
}

interface MatchResult {
  matched_triggers: MatchedTrigger[];
  activated_rules: ActivatedRule[];
}

function _asRuleList(value: JsonValue | undefined): Rule[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as unknown as Rule[];
}

function _asTriggerList(value: JsonValue | undefined): Trigger[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as unknown as Trigger[];
}

/**
 * Return the matched-triggers + activated-rules for one prompt.
 *
 * Kernel rules are always active. tier_1 always considered. tier_2
 * only considered when `profile == 'full'`.
 */
export function match_prompt(
  router: Router,
  prompt: string,
  profile = "full",
  open_files?: Iterable<string> | null,
  command?: string | null,
): MatchResult {
  const tiers: Array<[string, Rule[]]> = [
    ["tier_1", _asRuleList(router["tier_1"])],
  ];
  if (profile === "full") {
    tiers.push(["tier_2", _asRuleList(router["tier_2"])]);
  }

  const matched_triggers: MatchedTrigger[] = [];
  const activated_rules: ActivatedRule[] = [];

  for (const [tier_name, rules] of tiers) {
    for (const rule of rules) {
      const rule_id = rule["id"];
      const rule_triggers = _asTriggerList(rule["triggers"]);
      let rule_hit = false;
      for (const trig of rule_triggers) {
        if (trigger_matches(trig, prompt, open_files, command)) {
          matched_triggers.push({ tier: tier_name, rule: rule_id, trigger: trig });
          rule_hit = true;
        }
      }
      if (rule_hit) {
        activated_rules.push({ tier: tier_name, rule: rule_id });
      }
    }
  }

  // Kernel rules are always active.
  const kernel = Array.isArray(router["kernel"]) ? router["kernel"] : [];
  for (const kid of kernel) {
    activated_rules.push({ tier: "kernel", rule: kid });
  }

  return { matched_triggers, activated_rules };
}

// ── JSON serialization (Python-faithful) ─────────────────────────────────

/**
 * Compact JSON like Python's `json.dumps(value, sort_keys=True)`:
 * object keys sorted, default separators (`", "` between items, `": "`
 * after keys), `ensure_ascii=True` semantics are NOT applied here because
 * the trigger dicts are flat string→scalar maps — but for safety the
 * encoder still mirrors Python's default ensure_ascii=True escaping for
 * any non-ASCII char, matching `json.dumps` defaults.
 */
function py_json_compact_sorted(value: JsonValue): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return _py_json_string(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => py_json_compact_sorted(v)).join(", ") + "]";
  }
  const obj = value as { [key: string]: JsonValue };
  const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const parts = keys.map(
    (k) => `${_py_json_string(k)}: ${py_json_compact_sorted(obj[k] as JsonValue)}`,
  );
  return "{" + parts.join(", ") + "}";
}

/**
 * Encode a string the way Python's `json.dumps(s)` does with the default
 * `ensure_ascii=True`: standard escapes plus `\uXXXX` for any code unit
 * > 0x7e.
 */
function _py_json_string(s: string): string {
  const base = JSON.stringify(s);
  let out = "";
  for (let i = 0; i < base.length; i += 1) {
    const code = base.charCodeAt(i);
    if (code > 0x7e) {
      out += "\\u" + code.toString(16).padStart(4, "0");
    } else {
      out += base[i];
    }
  }
  return out;
}

/**
 * Pretty JSON like Python's `json.dumps(value, indent=2,
 * ensure_ascii=False)`: 2-space indent, `": "` key separator, `,`
 * item separator, insertion-order keys, non-ASCII preserved verbatim.
 */
function py_json_dumps_indent2(value: JsonValue): string {
  return _render_indent(value, 0);
}

function _render_indent(value: JsonValue, depth: number): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    // ensure_ascii=False → JSON.stringify already keeps non-ASCII verbatim
    // and applies the standard escape set, matching Python.
    return JSON.stringify(value);
  }
  const pad = "  ".repeat(depth + 1);
  const closePad = "  ".repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((v) => pad + _render_indent(v, depth + 1));
    return "[\n" + items.join(",\n") + "\n" + closePad + "]";
  }
  const obj = value as { [key: string]: JsonValue };
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return "{}";
  }
  const items = keys.map(
    (k) => pad + JSON.stringify(k) + ": " + _render_indent(obj[k] as JsonValue, depth + 1),
  );
  return "{\n" + items.join(",\n") + "\n" + closePad + "}";
}

// ── Corpus loading ───────────────────────────────────────────────────────

function _exists(p: string): boolean {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

function _safe_yaml_load(p: string): Record<string, JsonValue> | null {
  if (!_exists(p)) {
    return null;
  }
  try {
    const data = parseYaml(fs.readFileSync(p, "utf-8"), { version: "1.1" });
    // Python: `yaml.safe_load(...) or {}` → falsy (None/"") collapses to {}.
    if (data === null || data === undefined || data === "" || data === false) {
      return {};
    }
    return data as Record<string, JsonValue>;
  } catch (e) {
    if (e instanceof YAMLError) {
      return null;
    }
    throw e;
  }
}

interface PromptEntry {
  id: string;
  text: string;
  intended_triggers: string[];
  replay_opaque_triggers: string[];
  open_files: string[];
  command: string | null;
}

/**
 * Return per-prompt entries capped at sample_cap, sorted by id.
 *
 * Each entry: `{id, text, intended_triggers, open_files, command}`.
 * All context fields beyond id/text are optional; missing → defaults.
 */
export function load_corpus_prompts(
  corpus_path: string,
  sample_cap: number,
): PromptEntry[] {
  const data = _safe_yaml_load(corpus_path);
  if (!data) {
    return [];
  }
  const out: PromptEntry[] = [];
  // Track B uses `tasks:`, dev uses `prompts:`.
  for (const key of ["tasks", "prompts"]) {
    const section = data[key];
    const entries = Array.isArray(section) ? section : [];
    for (const raw of entries) {
      const entry = (raw ?? {}) as Record<string, JsonValue>;
      const pid = String(entry["id"] ?? "");
      // Python: entry.get("prompt") or entry.get("text") or ""
      const promptVal = entry["prompt"];
      const textVal = entry["text"];
      const text = _firstTruthy(promptVal, textVal, "");
      let intended: JsonValue = entry["intended_triggers"] ?? [];
      let opaque: JsonValue = entry["replay_opaque_triggers"] ?? [];
      let open_files: JsonValue = entry["open_files"] ?? [];
      const commandRaw = entry["command"];
      const command = _isTruthy(commandRaw) ? commandRaw : null;
      if (!Array.isArray(intended)) {
        intended = [];
      }
      if (!Array.isArray(opaque)) {
        opaque = [];
      }
      if (!Array.isArray(open_files)) {
        open_files = [];
      }
      if (pid && _isTruthy(text)) {
        out.push({
          id: pid,
          text: String(text),
          intended_triggers: (intended as JsonValue[]).map((t) => String(t)),
          replay_opaque_triggers: (opaque as JsonValue[]).map((t) => String(t)),
          open_files: (open_files as JsonValue[]).map((p) => String(p)),
          command: command !== null ? String(command) : null,
        });
      }
    }
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out.slice(0, sample_cap);
}

/** Mirror Python's `a or b or c` short-circuit on truthiness. */
function _firstTruthy(...values: Array<JsonValue | undefined>): JsonValue {
  let last: JsonValue = "";
  for (const v of values) {
    if (v !== undefined) {
      last = v;
      if (_isTruthy(v)) {
        return v;
      }
    }
  }
  return last;
}

/** Python truthiness for the value shapes we encounter (str, list, null). */
function _isTruthy(v: JsonValue | undefined): boolean {
  if (v === undefined || v === null || v === false) {
    return false;
  }
  if (typeof v === "string") {
    return v.length > 0;
  }
  if (typeof v === "number") {
    return v !== 0;
  }
  if (Array.isArray(v)) {
    return v.length > 0;
  }
  if (typeof v === "object") {
    return Object.keys(v).length > 0;
  }
  return true;
}

// ── Aggregation ──────────────────────────────────────────────────────────

interface AggregateResult {
  per_trigger_hits: { [key: string]: number };
  per_rule_activations: { [tier: string]: { [rule: string]: number } };
  panel_b_untouchable_rules: string[];
  panel_b_tier2_drivers: string[];
  per_corpus_summary: JsonValue[];
  intended_vs_observed_match: JsonValue[];
  unintended_activation_histogram: JsonValue[];
  never_matched_tier1?: string[];
}

/** Replay every corpus through the router; aggregate hits. */
export function aggregate_replay(
  router: Router,
  corpora: Array<[string, string]>,
  sample_cap: number,
  profile: string,
): AggregateResult {
  const per_trigger_hits: { [key: string]: number } = {};
  const per_rule_activations: { [tier: string]: { [rule: string]: number } } = {};
  const panel_b_seen_tier1 = new Set<string>();
  const panel_b_seen_tier2 = new Set<string>();
  const per_corpus_summary: JsonValue[] = [];
  const intended_vs_observed: JsonValue[] = [];
  const unintended_histogram: { [key: string]: number } = {};

  for (const [corpus_name, corpus_path] of corpora) {
    const prompts = load_corpus_prompts(corpus_path, sample_cap);
    const corpus_rule_hits: { [rule: string]: number } = {};
    for (const entry of prompts) {
      const pid = entry.id;
      const text = entry.text;
      const intended = entry.intended_triggers;
      const opaque = entry.replay_opaque_triggers;
      const result = match_prompt(
        router,
        text,
        profile,
        entry.open_files.length > 0 ? entry.open_files : null,
        entry.command,
      );
      for (const hit of result.matched_triggers) {
        const key = `${hit.rule}::${py_json_compact_sorted(hit.trigger)}`;
        per_trigger_hits[key] = (per_trigger_hits[key] ?? 0) + 1;
      }
      // seen_in_prompt is a set of (tier, rid) tuples — replicate with a
      // string key keeping insertion order for deterministic iteration.
      const seen_in_prompt = new Map<string, [string, string]>();
      for (const act of result.activated_rules) {
        const rid = act.rule;
        if (rid === null || rid === undefined || act.tier === "kernel") {
          // Skip kernel — always-on by definition, no signal.
          continue;
        }
        seen_in_prompt.set(`${act.tier} ${String(rid)}`, [act.tier, String(rid)]);
      }
      const activated_ids = new Set<string>();
      for (const [, rid] of seen_in_prompt.values()) {
        activated_ids.add(rid);
      }
      for (const [tier, rid] of seen_in_prompt.values()) {
        if (per_rule_activations[tier] === undefined) {
          per_rule_activations[tier] = {};
        }
        const bucket = per_rule_activations[tier] as { [rule: string]: number };
        bucket[rid] = (bucket[rid] ?? 0) + 1;
        corpus_rule_hits[rid] = (corpus_rule_hits[rid] ?? 0) + 1;
        if (corpus_name === "ab-trackb") {
          if (tier === "tier_1") {
            panel_b_seen_tier1.add(rid);
          } else if (tier === "tier_2") {
            panel_b_seen_tier2.add(rid);
          }
        }
      }
      // Council R3 honesty floor: surface intended vs observed.
      if (intended.length > 0 || opaque.length > 0) {
        const intended_set = new Set(intended);
        const opaque_set = new Set(opaque);
        const hit = [...intended_set].filter((x) => activated_ids.has(x)).sort();
        const miss = [...intended_set].filter((x) => !activated_ids.has(x)).sort();
        const unintended = [...activated_ids]
          .filter((x) => !intended_set.has(x) && !opaque_set.has(x))
          .sort();
        intended_vs_observed.push({
          corpus: corpus_name,
          task: pid,
          intended: [...intended].sort(),
          replay_opaque: [...opaque].sort(),
          hit,
          missed_intended: miss,
          unintended_activations: unintended,
        });
        // Council R3 #3: inter-rule conflict histogram.
        for (const rid of unintended) {
          unintended_histogram[rid] = (unintended_histogram[rid] ?? 0) + 1;
        }
      }
    }
    const topRules = Object.entries(corpus_rule_hits)
      .map(([k, v]) => [k, v] as [string, number])
      .sort((a, b) => -a[1] - -b[1])
      .slice(0, 10);
    per_corpus_summary.push({
      corpus: corpus_name,
      prompts_replayed: prompts.length,
      unique_rules_activated: Object.keys(corpus_rule_hits).length,
      top_rules: topRules.map(([k, v]) => [k, v]),
    });
  }

  const panel_b_untouchable = [...panel_b_seen_tier1].sort();
  return {
    per_trigger_hits,
    per_rule_activations,
    panel_b_untouchable_rules: panel_b_untouchable,
    panel_b_tier2_drivers: [...panel_b_seen_tier2].sort(),
    per_corpus_summary,
    intended_vs_observed_match: intended_vs_observed,
    unintended_activation_histogram: Object.entries(unintended_histogram)
      .map(([k, v]) => [k, v] as [string, number])
      .sort((a, b) => -a[1] - -b[1])
      .map(([k, v]) => [k, v]),
  };
}

// ── Reports ────────────────────────────────────────────────────────────────

export function write_report(
  aggregate: AggregateResult,
  out_dir: string,
  corpora_paths: string[],
  sample_cap: number,
  profile: string,
): string {
  fs.mkdirSync(out_dir, { recursive: true });
  const stamp = _utc_iso().replace(/:/g, "-");
  const out_path = path.join(out_dir, `${stamp}.json`);
  const latest = path.join(out_dir, "latest.json");
  const payload: { [key: string]: JsonValue } = {
    schema_version: 1,
    schema_id: "router-telemetry-v1",
    generated_at: _utc_iso(),
    config: {
      router: "dist/router.json",
      profile,
      sample_cap_per_corpus: sample_cap,
      corpora: corpora_paths.map((p) => _relToRepo(p)),
    },
    ...(aggregate as unknown as { [key: string]: JsonValue }),
  };
  const text = py_json_dumps_indent2(payload) + "\n";
  fs.writeFileSync(out_path, text);
  fs.writeFileSync(latest, text);
  return out_path;
}

/**
 * Path relative to REPO_ROOT, POSIX separators.
 *
 * Faithful to Python's `Path.relative_to(REPO_ROOT)`: raises when `p` is
 * not a subpath of REPO_ROOT (e.g. a relative corpus path passed via
 * `--corpus NAME:relpath`, or an absolute path outside the repo). Python
 * lets that `ValueError` propagate uncaught — a latent crash on custom
 * non-subpath corpus/out paths. We mirror the failure (a thrown error →
 * non-zero exit) rather than silently emitting a `../../` relative path.
 * The default CI invocation only ever feeds absolute subpaths, so this
 * path is never hit there.
 */
function _relToRepo(p: string): string {
  const root = path.resolve(REPO_ROOT);
  // Python's relative_to raises when one path is relative and the other
  // absolute (REPO_ROOT is always absolute), or when the absolute target
  // is not under the root.
  const isSubpath =
    path.isAbsolute(p) && (p === root || p.startsWith(root + path.sep));
  if (!isSubpath) {
    throw new Error(
      `'${p}' is not in the subpath of '${REPO_ROOT}' ` +
        `OR one path is relative and the other is absolute.`,
    );
  }
  const rel = path.relative(root, p);
  return rel.split(path.sep).join("/");
}

/** Tier-1 rules with zero activations across all corpora — dead-rule candidates. */
export function find_never_matched_tier1(
  router: Router,
  activations: AggregateResult,
): string[] {
  const tier_1_activations =
    (activations.per_rule_activations["tier_1"] as { [rule: string]: number }) ?? {};
  const all_tier_1_ids: string[] = [];
  for (const r of _asRuleList(router["tier_1"])) {
    if (_isTruthy(r["id"])) {
      all_tier_1_ids.push(String(r["id"]));
    }
  }
  return all_tier_1_ids
    .filter((rid) => !(rid in tier_1_activations))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// ── Entry point ──────────────────────────────────────────────────────────

export function run(
  corpora: Array<[string, string]>,
  out_dir: string = DEFAULT_OUT_DIR,
  sample_cap: number = DEFAULT_SAMPLE_CAP,
  profile = "full",
  quiet = false,
): number {
  if (!_exists(ROUTER_JSON)) {
    _log(`router not found: ${ROUTER_JSON}`, quiet, true);
    return 1;
  }
  let router: Router;
  try {
    router = JSON.parse(fs.readFileSync(ROUTER_JSON, "utf-8")) as Router;
  } catch (exc) {
    _log(`failed to parse router: ${_jsonErrMsg(exc)}`, quiet, true);
    return 1;
  }

  _log(
    `router_telemetry: replaying ${corpora.length} corpora · ` +
      `cap=${sample_cap} prompts/corpus · profile=${profile}`,
    quiet,
  );
  const agg = aggregate_replay(router, corpora, sample_cap, profile);
  const never_matched = find_never_matched_tier1(router, agg);
  agg.never_matched_tier1 = never_matched;

  const out_path = write_report(
    agg,
    out_dir,
    corpora.map(([, p]) => p),
    sample_cap,
    profile,
  );
  const relpath = _relToRepo(out_path);
  _log(
    `router_telemetry: wrote ${relpath} · ` +
      `panel_b_untouchable=${agg.panel_b_untouchable_rules.length} · ` +
      `never_matched_tier1=${never_matched.length}`,
    false,
  );
  return 0;
}

/** Render a JSON parse error message akin to Python's JSONDecodeError str. */
function _jsonErrMsg(exc: unknown): string {
  if (exc instanceof Error) {
    return exc.message;
  }
  return String(exc);
}

interface ParsedArgs {
  corpus: string[];
  sample_cap: number;
  profile: string;
  out: string;
  quiet: boolean;
}

/**
 * Parse argv mirroring the Python argparse contract. On invocation
 * errors (bad --sample-cap int, bad --profile choice, unknown flag,
 * missing value) the function throws an `ArgError` carrying the exit
 * code (2) — matching argparse's behaviour.
 */
class ArgError extends Error {
  code: number;
  constructor(message: string, code = 2) {
    super(message);
    this.code = code;
  }
}

export function parse_args(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    corpus: [],
    sample_cap: DEFAULT_SAMPLE_CAP,
    profile: "full",
    out: DEFAULT_OUT_DIR,
    quiet: false,
  };
  let i = 0;
  const next = (flag: string): string => {
    i += 1;
    if (i >= argv.length) {
      throw new ArgError(`argument ${flag}: expected one argument`);
    }
    return argv[i] as string;
  };
  while (i < argv.length) {
    const a = argv[i] as string;
    if (a === "--corpus") {
      out.corpus.push(next("--corpus"));
    } else if (a.startsWith("--corpus=")) {
      out.corpus.push(a.slice("--corpus=".length));
    } else if (a === "--sample-cap") {
      out.sample_cap = _parseInt(next("--sample-cap"));
    } else if (a.startsWith("--sample-cap=")) {
      out.sample_cap = _parseInt(a.slice("--sample-cap=".length));
    } else if (a === "--profile") {
      out.profile = _parseProfile(next("--profile"));
    } else if (a.startsWith("--profile=")) {
      out.profile = _parseProfile(a.slice("--profile=".length));
    } else if (a === "--out") {
      out.out = next("--out");
    } else if (a.startsWith("--out=")) {
      out.out = a.slice("--out=".length);
    } else if (a === "--quiet") {
      out.quiet = true;
    } else {
      throw new ArgError(`unrecognized arguments: ${a}`);
    }
    i += 1;
  }
  return out;
}

function _parseInt(s: string): number {
  // argparse type=int uses Python int() — base-10, allows surrounding
  // whitespace and a leading sign, rejects floats/garbage.
  const t = s.trim();
  if (!/^[+-]?\d+$/.test(t)) {
    throw new ArgError(`argument --sample-cap: invalid int value: '${s}'`);
  }
  return parseInt(t, 10);
}

function _parseProfile(s: string): string {
  if (s !== "balanced" && s !== "full") {
    throw new ArgError(
      `argument --profile: invalid choice: '${s}' (choose from 'balanced', 'full')`,
    );
  }
  return s;
}

function _default_corpora(): Array<[string, string]> {
  const corpora: Array<[string, string]> = [
    ["ab-trackb", path.join(REPO_ROOT, TRACK_B_CORPUS_REL)],
    ["dev", path.join(REPO_ROOT, "tests/eval/corpus-dev.yaml")],
    ["non-dev", path.join(REPO_ROOT, "tests/eval/corpus-non-dev.yaml")],
  ];
  const coverage_dir = path.join(
    REPO_ROOT,
    "internal",
    "bench",
    "corpora",
    "router-coverage",
  );
  let isDir = false;
  try {
    isDir = fs.statSync(coverage_dir).isDirectory();
  } catch {
    isDir = false;
  }
  if (isDir) {
    const yamls = fs
      .readdirSync(coverage_dir)
      .filter((f) => f.endsWith(".yaml"))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const f of yamls) {
      const stem = f.slice(0, f.length - ".yaml".length);
      corpora.push([`router-coverage:${stem}`, path.join(coverage_dir, f)]);
    }
  }
  return corpora;
}

export function main(argv?: string[]): number {
  let args: ParsedArgs;
  try {
    args = parse_args(argv !== undefined ? argv : process.argv.slice(2));
  } catch (e) {
    if (e instanceof ArgError) {
      process.stderr.write(`${e.message}\n`);
      return e.code;
    }
    throw e;
  }
  let corpora: Array<[string, string]>;
  if (args.corpus.length === 0) {
    corpora = _default_corpora();
  } else {
    corpora = [];
    for (const spec of args.corpus) {
      if (!spec.includes(":")) {
        process.stderr.write(`--corpus expects NAME:PATH, got ${_pyRepr(spec)}\n`);
        return 1;
      }
      const idx = spec.indexOf(":");
      const name = spec.slice(0, idx);
      const p = spec.slice(idx + 1);
      corpora.push([name.trim(), p.trim()]);
    }
  }
  return run(corpora, args.out, args.sample_cap, args.profile, args.quiet);
}

/** Python `repr()` of a string for the NAME:PATH error message. */
function _pyRepr(s: string): string {
  // Python prefers single quotes unless the string contains a single quote
  // and no double quote.
  if (s.includes("'") && !s.includes('"')) {
    return `"${s.replace(/\\/g, "\\\\")}"`;
  }
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

// Execute when run directly (mirrors `if __name__ == "__main__"`).
const _invokedDirectly = (() => {
  try {
    return process.argv[1] !== undefined &&
      fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();

if (_invokedDirectly) {
  process.exit(main());
}
