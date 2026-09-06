#!/usr/bin/env node
/**
 * Lint `src/scripts/hook_manifest.yaml`.
 *
 * Ported from the retired Python `src/scripts/lint_hook_manifest.py` (ADR-200, Phase 4 /
 * Wave 4b). Mirrors the Python CLI contract exactly: same manifest default,
 * finding messages, finding order, stdout/stderr split, and exit codes.
 *
 * Hard-fails on:
 *   - missing or malformed top-level keys (schema_version, concerns, platforms)
 *   - a concern entry referencing a non-existent script file
 *   - a platform binding referencing an unknown concern name
 *   - a platform binding referencing an unknown event
 *   - a native_event_aliases block referencing an unknown event or platform
 *   - an orphan `<platform>-dispatcher.sh` trampoline without a manifest block
 *   - a `host_lowering.yaml` row whose `verified.expires` has passed (or which
 *     was never verified) while it still carries a blocking binding
 *
 * Soft-warns on placeholder platform blocks, dead concerns, an expired row
 * carrying no blocking binding, and an incomplete `verified` provenance block.
 *
 * Exit codes:
 *   0 — clean (warnings allowed)
 *   1 — at least one hard failure
 *   2 — file or schema-load error
 *
 * `--strict` upgrades warnings to errors.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

import { assertScanned, DeadScopeError } from "./_lib/scan_scope.js";
import { asOf } from "./_lib/as_of.js";
import { parseHostLowering, type HostLowering } from "./hooks/host_lowering.js";
import { RE_ARM_EVENTS } from "./_lib/prefix_stable_surfaces.js";

// src/scripts/lint_hook_manifest.ts → two levels up is the repo root.
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const DEFAULT_MANIFEST = path.join(
  REPO_ROOT,
  "src",
  "scripts",
  "hook_manifest.yaml",
);
const HOOKS_DIR = path.join(REPO_ROOT, "src", "scripts", "hooks");
const DEFAULT_HOST_LOWERING = path.join(HOOKS_DIR, "host_lowering.yaml");

// Canonical event vocabulary — keep in lock-step with
// docs/contracts/hook-architecture-v1.md and dispatch_hook.EVENT_VOCABULARY.
const EVENT_VOCABULARY: ReadonlySet<string> = new Set([
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

// Known platform identifiers.
const KNOWN_PLATFORMS: ReadonlySet<string> = new Set([
  "augment",
  "claude",
  "cowork",
  "cursor",
  "cline",
  "windsurf",
  "gemini",
  "copilot",
]);

type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | { [key: string]: YamlValue };
type YamlObject = { [key: string]: YamlValue };

function isObject(v: unknown): v is YamlObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

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

/**
 * Load the manifest. the retired Python implementation reuses dispatch_hook._load_yaml
 * which prefers PyYAML (with a narrow fallback parser when PyYAML is absent).
 * The TS runtime always has the `yaml` package, so this mirrors the
 * PyYAML-present path (`yaml.safe_load(text) or {}`).
 */
function _load_manifest(p: string): YamlValue {
  const text = fs.readFileSync(p, "utf-8");
  const data = parseYaml(text, { version: "1.1" }) as YamlValue;
  return data === null || data === undefined ? {} : data;
}

// Python type(x).__name__ for the values that reach the message paths.
function pyTypeName(v: YamlValue): string {
  if (v === null) return "NoneType";
  if (typeof v === "string") return "str";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number") return Number.isInteger(v) ? "int" : "float";
  if (Array.isArray(v)) return "list";
  return "dict";
}

// Python `sorted(set)` repr for str sets: ['a', 'b', ...].
function sortedRepr(s: ReadonlySet<string>): string {
  const items = [...s].sort();
  return `[${items.map((x) => `'${x}'`).join(", ")}]`;
}

function _check_concerns(manifest: YamlObject, errors: string[]): Set<string> {
  const concernsRaw = manifest["concerns"] ?? {};
  if (!isObject(concernsRaw) || Object.keys(concernsRaw).length === 0) {
    errors.push("manifest: 'concerns' must be a non-empty mapping");
    return new Set();
  }
  const names = new Set<string>();
  const nudgeRanks = new Map<number, string[]>();
  for (const [name, spec] of Object.entries(concernsRaw)) {
    if (!isObject(spec)) {
      errors.push(
        `concerns.${name}: must be a mapping, got ${pyTypeName(spec)}`,
      );
      continue;
    }
    const script = spec["script"];
    if (!script || typeof script !== "string") {
      errors.push(`concerns.${name}: 'script' must be a relative path`);
      continue;
    }
    if (!_isFile(path.join(REPO_ROOT, script))) {
      errors.push(`concerns.${name}: script not found at '${script}'`);
    }
    // `tools:` — the optional per-concern tool filter the dispatcher applies
    // in-process (`_concern_matches_tool`). Validated because the failure mode
    // is silent: the dispatcher fails toward RUNNING the concern on anything
    // malformed, so a typo (`tool:`, a bare string, `[]`) would look like a
    // working filter while filtering nothing. An unvalidated key is worse than
    // no key.
    if ("tools" in spec) {
      const tools = spec["tools"];
      if (!Array.isArray(tools)) {
        errors.push(
          `concerns.${name}: 'tools' must be a list of tool names ` +
            `(got ${pyTypeName(tools)}) — omit the key for "every event"`,
        );
      } else if (tools.length === 0) {
        errors.push(
          `concerns.${name}: 'tools' is an empty list — omit the key, or use ` +
            `["*"], rather than a filter that reads as "no tools"`,
        );
      } else {
        for (const t of tools) {
          if (typeof t !== "string" || t.trim() === "") {
            errors.push(
              `concerns.${name}: 'tools' entries must be non-empty strings, ` +
                `got ${pyTypeName(t)}`,
            );
          }
        }
      }
    }
    // `needs_payload_bodies:` — the payload opt-in
    // (`road-to-per-turn-hook-economy` step 2.1). Validated for the same
    // reason `tools:` is, with the polarity reversed: the dispatcher ignores
    // anything it does not recognise, so `true`, `"input"`, or a misspelled
    // `[inputs]` all resolve to "keep nothing" and the concern silently
    // receives stubs it was meant to opt out of. A concern that reads a body
    // and gets a stub does not crash — it reads `undefined` and reports
    // nothing, which is the failure this check exists to keep a YAML typo from
    // introducing. The runtime deliberately does NOT widen on a malformed
    // value; that would make this check unenforceable.
    if ("needs_payload_bodies" in spec) {
      const raw = spec["needs_payload_bodies"];
      if (!Array.isArray(raw)) {
        errors.push(
          `concerns.${name}: 'needs_payload_bodies' must be a list of body ` +
            `classes (got ${pyTypeName(raw)}) — use [input], [result], or ` +
            `[input, result]; omit the key to receive stubs, which is the default`,
        );
      } else if (raw.length === 0) {
        errors.push(
          `concerns.${name}: 'needs_payload_bodies' is an empty list — omit ` +
            `the key rather than declaring a need for nothing`,
        );
      } else {
        for (const cls of raw) {
          if (cls !== "input" && cls !== "result") {
            errors.push(
              `concerns.${name}: 'needs_payload_bodies' entries must be ` +
                `'input' or 'result', got ${JSON.stringify(cls)}`,
            );
          }
        }
      }
    }
    // `re_arm:` — the named boundary at which a rebuilt prompt prefix is
    // expected and paid for once (`road-to-runtime-context-floors` step 1.2).
    // `check_prefix_stable_mutation` reads this key to decide whether a
    // mid-session write into a declared prefix-stable surface is a violation or
    // a declared, budgeted rebuild. Validated here for the same reason
    // `needs_payload_bodies` is: the gate treats an unrecognised value as
    // "undeclared" and fails, so a typo would look like a real violation and
    // send the author hunting the wrong defect.
    if ("re_arm" in spec) {
      const ev = spec["re_arm"];
      if (typeof ev !== "string" || !RE_ARM_EVENTS.includes(ev)) {
        errors.push(
          `concerns.${name}: 're_arm' must name a declared re-arm event ` +
            `(${RE_ARM_EVENTS.join(" | ")}), got ${JSON.stringify(ev)} — ` +
            `see docs/contracts/prefix-stable-surfaces.md`,
        );
      }
    }
    // `nudge_rank:` — the nudge-exclusivity ordering `injection_budget`
    // arbitrates on. Validated here because `injection_budget._selectNudge`
    // says so in as many words: "a tie is a manifest defect rather than a
    // runtime one, and `lint_hook_manifest` is where it should eventually be
    // caught — that check does not exist yet and this comment is the honest
    // statement of the gap". This is that check.
    //
    // A tie is not a crash. `_selectNudge` keeps the lowest rank and breaks
    // ties on concern name, so a collision resolves stably and arbitrarily:
    // one nudge silently wins forever, and the author who added the second one
    // gets no signal that their concern can never emit. That is the failure
    // mode — silent, not loud.
    if ("nudge_rank" in spec) {
      const rank = spec["nudge_rank"];
      if (typeof rank !== "number" || !Number.isInteger(rank) || rank < 1) {
        errors.push(
          `concerns.${name}: 'nudge_rank' must be a positive integer ` +
            `(got ${pyTypeName(rank)}) — the dispatcher keeps the LOWEST rank, ` +
            `so a malformed value reads as "never wins" rather than as an error`,
        );
      } else {
        const seen = nudgeRanks.get(rank);
        if (seen) {
          seen.push(name);
        } else {
          nudgeRanks.set(rank, [name]);
        }
      }
    }
    names.add(name);
  }
  // Uniqueness is enforced GLOBALLY, not per event, and that is a deliberate
  // choice rather than an accident of what is easy to compute. `_selectNudge`
  // compares candidates within one dispatch, so two concerns bound to disjoint
  // events could share a rank harmlessly and the accurate invariant is
  // per-event. Global uniqueness is the strictly-safe superset: it costs
  // nothing at today's two declared ranks, and an author reusing a rank across
  // events is exactly the confusion worth refusing. If a legitimate design
  // ever needs the same rank on two events, NARROW this to concerns sharing at
  // least one bound event — do not delete it.
  for (const [rank, holders] of nudgeRanks) {
    if (holders.length > 1) {
      errors.push(
        `concerns: nudge_rank ${rank} is declared by ${holders.length} concerns ` +
          `(${holders.slice().sort().join(", ")}) — ranks must be unique, because ` +
          `the dispatcher breaks a tie on concern name and the loser can then ` +
          `never emit`,
      );
    }
  }
  return names;
}

/** The two slots whose payload carries a stubbable tool body. */
const TOOL_BODY_EVENTS: ReadonlySet<string> = new Set([
  "pre_tool_use",
  "post_tool_use",
]);

/**
 * Payload keys per body class, mirroring `hooks/payload_stub.ts::BODY_KEYS`.
 *
 * Duplicated deliberately rather than imported: this gate must keep working if
 * the dispatcher module moves, and the pair is pinned by a test that asserts
 * the two lists agree. A silent divergence would make the gate scan for keys
 * the dispatcher no longer stubs.
 */
const BODY_KEY_LITERALS: Readonly<Record<'input' | 'result', readonly string[]>> = {
  input: ["tool_input", "toolInput"],
  result: ["tool_response", "toolResponse", "tool_result", "toolUseResult"],
};

/** `// payload-bodies-waiver: <class> — <reason>` in a concern's own source. */
const WAIVER_RE = /payload-bodies-waiver:\s*(input|result)\s*[—:-]\s*(.+)/g;

/**
 * A concern that READS a payload body must declare it
 * (`road-to-per-turn-hook-economy` step 2.1).
 *
 * ## Why this is derived from source rather than from trust
 *
 * The first version of this check covered guards only, and the R2 review named
 * the gap precisely: the failure mode the change itself introduces — a NEW
 * advisory `post_tool_use` concern that reads `tool_response` and forgets the
 * declaration — passed the lint, passed every test, and then read `undefined`
 * in silence. Runtime cannot catch it either: the dispatcher's stub counter is
 * a function of the declaration and the payload shape, so it says how often a
 * concern ran without a body and never whether it wanted one.
 *
 * Authoring time is where the question is decidable, so the requirement is
 * computed from the concern's own script: if it mentions a body key, it
 * declares that class or says in the file why it does not.
 *
 * ## Over-detection is the safe direction, on purpose
 *
 * The scan is a literal match on the key name in quotes or after a dot, so a
 * COMMENT mentioning `tool_response` also trips it. That is deliberate: a false
 * positive costs one concern receiving a body it does not need, which is
 * exactly the status quo before this phase; a false negative costs silence. The
 * escape hatch is a `payload-bodies-waiver:` line naming the class and a
 * reason, which keeps the claim next to the code that makes it instead of in a
 * manifest a concern author may never open.
 *
 * ## The guard floor stays, and is stricter than the source scan
 *
 * `fail_closed` / `severity: blocking` on a tool slot requires `input`
 * regardless of what the source scan finds, and a waiver cannot lift it: a
 * guard served a stub has nothing to match and exits ALLOW. The dispatcher
 * enforces the same floor independently (`_concern_body_classes` returns every
 * class for a guard) and does not depend on this lint having run.
 *
 * Scoped to the two tool slots deliberately. `turn-end-gate` is blocking and
 * binds `stop`, whose payload carries no tool body at all — requiring a
 * declaration there would put a "give me the bodies" line on a concern that
 * can never receive one, which documents nothing and misleads the next reader.
 */
function _check_guard_payload_bodies(
  manifest: YamlObject,
  errors: string[],
): void {
  const concernsRaw = manifest["concerns"];
  const platformsRaw = manifest["platforms"];
  if (!isObject(concernsRaw) || !isObject(platformsRaw)) return;
  const onToolSlot = new Set<string>();
  for (const block of Object.values(platformsRaw)) {
    if (!isObject(block)) continue;
    for (const [event, names] of Object.entries(block)) {
      if (!TOOL_BODY_EVENTS.has(event) || !Array.isArray(names)) continue;
      for (const n of names) {
        if (typeof n === "string") onToolSlot.add(n);
      }
    }
  }
  for (const [name, spec] of Object.entries(concernsRaw)) {
    if (!isObject(spec) || !onToolSlot.has(name)) continue;
    const isGuard = spec["fail_closed"] === true || spec["severity"] === "blocking";
    const declared = spec["needs_payload_bodies"];
    const declaredSet = new Set(
      Array.isArray(declared)
        ? declared.filter((c): c is string => typeof c === "string")
        : [],
    );
    if (isGuard && !declaredSet.has("input")) {
      errors.push(
        `concerns.${name}: bound on a tool slot and fail_closed / ` +
          `severity: blocking, so it must declare 'needs_payload_bodies' ` +
          `including 'input' — a guard served a payload stub has nothing to ` +
          `match and exits ALLOW`,
      );
    }
    const script = spec["script"];
    if (typeof script !== "string") continue;
    let source = "";
    try {
      source = fs.readFileSync(path.join(REPO_ROOT, script), "utf8");
    } catch {
      continue; // missing script is already reported by _check_concerns
    }
    const waived = new Map<string, string>();
    for (const m of source.matchAll(WAIVER_RE)) {
      const cls = m[1];
      const reason = (m[2] ?? "").trim();
      if (cls !== undefined && reason) waived.set(cls, reason);
    }
    for (const [cls, keys] of Object.entries(BODY_KEY_LITERALS)) {
      if (declaredSet.has(cls)) continue;
      const hit = keys.find(
        (k) =>
          source.includes(`'${k}'`) ||
          source.includes(`"${k}"`) ||
          source.includes(`.${k}`),
      );
      if (hit === undefined) continue;
      if (waived.has(cls)) continue;
      errors.push(
        `concerns.${name}: ${script} references '${hit}' but does not declare ` +
          `'${cls}' in needs_payload_bodies — it would receive a stub and read ` +
          `undefined in silence. Declare the class, or put ` +
          `\`payload-bodies-waiver: ${cls} — <reason>\` in the script saying ` +
          `why the body is not needed`,
      );
    }
  }
}

function _check_platforms(
  manifest: YamlObject,
  concernNames: Set<string>,
  errors: string[],
  warnings: string[],
): Set<string> {
  const platformsRaw = manifest["platforms"] ?? {};
  if (!isObject(platformsRaw) || Object.keys(platformsRaw).length === 0) {
    errors.push("manifest: 'platforms' must be a non-empty mapping");
    return new Set();
  }
  const bound = new Set<string>();
  for (const [plat, block] of Object.entries(platformsRaw)) {
    if (!KNOWN_PLATFORMS.has(plat)) {
      errors.push(
        `platforms.${plat}: unknown platform ` +
          `(allowed: ${sortedRepr(KNOWN_PLATFORMS)})`,
      );
      continue;
    }
    if (block === null || block === undefined) {
      warnings.push(`platforms.${plat}: placeholder (no events bound)`);
      continue;
    }
    if (!isObject(block)) {
      errors.push(`platforms.${plat}: must be mapping or null`);
      continue;
    }
    if (block["fallback_only"]) {
      continue; // Copilot — intentional, no event surface
    }
    for (const [event, names] of Object.entries(block)) {
      if (!EVENT_VOCABULARY.has(event)) {
        errors.push(
          `platforms.${plat}.${event}: unknown event ` +
            `(allowed: ${sortedRepr(EVENT_VOCABULARY)})`,
        );
        continue;
      }
      if (!Array.isArray(names)) {
        errors.push(
          `platforms.${plat}.${event}: must be a list of concern names`,
        );
        continue;
      }
      for (const n of names) {
        if (typeof n !== "string" || !concernNames.has(n)) {
          errors.push(
            `platforms.${plat}.${event}: unknown concern '${String(n)}'`,
          );
        } else {
          bound.add(n);
        }
      }
    }
  }
  return bound;
}

function _check_aliases(manifest: YamlObject, errors: string[]): void {
  const aliasesRaw = manifest["native_event_aliases"] ?? {};
  if (!isObject(aliasesRaw)) {
    errors.push("native_event_aliases: must be a mapping");
    return;
  }
  for (const [plat, mapping] of Object.entries(aliasesRaw)) {
    if (!KNOWN_PLATFORMS.has(plat)) {
      errors.push(`native_event_aliases.${plat}: unknown platform`);
      continue;
    }
    if (!isObject(mapping)) {
      errors.push(`native_event_aliases.${plat}: must be a mapping`);
      continue;
    }
    for (const [native, target] of Object.entries(mapping)) {
      if (typeof target !== "string" || !EVENT_VOCABULARY.has(target)) {
        errors.push(
          `native_event_aliases.${plat}.${native}: ` +
            `target '${String(target)}' not in vocabulary`,
        );
      }
    }
  }
}

function _check_orphan_trampolines(
  manifest: YamlObject,
  errors: string[],
): void {
  if (!_isDir(HOOKS_DIR)) {
    return;
  }
  const platformsRaw = manifest["platforms"] ?? {};
  const platforms: YamlObject = isObject(platformsRaw) ? platformsRaw : {};
  let entries: string[];
  try {
    entries = fs.readdirSync(HOOKS_DIR);
  } catch {
    return;
  }
  entries.sort();
  const suffix = "-dispatcher.sh";
  for (const entryName of entries) {
    if (!entryName.endsWith(suffix)) {
      continue;
    }
    const plat = entryName.slice(0, entryName.length - suffix.length);
    if (!KNOWN_PLATFORMS.has(plat)) {
      errors.push(
        `orphan trampoline ${entryName}: unknown platform '${plat}'`,
      );
      continue;
    }
    const block = platforms[plat];
    const hasBinding =
      isObject(block) && Object.keys(block).some((k) => EVENT_VOCABULARY.has(k));
    if (block === null || block === undefined || (isObject(block) && !hasBinding)) {
      errors.push(
        `orphan trampoline ${entryName}: ` +
          `platform '${plat}' has no event bindings in manifest`,
      );
    }
  }
}

function _check_dead_concerns(
  concernNames: Set<string>,
  bound: Set<string>,
  warnings: string[],
): void {
  const dead = [...concernNames].filter((n) => !bound.has(n)).sort();
  for (const n of dead) {
    warnings.push(`concerns.${n}: declared but not bound to any platform`);
  }
}

/**
 * Role-axis validation (road-to-token-economy-dispatch Phase 2). Errors on:
 *   - a `roles` block that is not a mapping of role → { drop: [names] }
 *   - a drop entry naming an unknown concern
 *   - a drop entry naming a concern bound to ANY platform's `pre_tool_use`
 *     slot — the safety-guard slot is undroppable (Phase 2.3: "the manifest
 *     diff must show zero pre_tool_use guard removals, CI-checked"). The
 *     dispatcher also refuses pre_tool_use drops at runtime; this check
 *     makes the attempt a red build instead of a silent no-op.
 */
export function _check_roles(
  manifest: YamlObject,
  concernNames: Set<string>,
  errors: string[],
): void {
  const rolesRaw = manifest["roles"];
  if (rolesRaw === undefined || rolesRaw === null) {
    return; // no role axis — valid (every chain is the orchestrator default)
  }
  if (!isObject(rolesRaw)) {
    errors.push(`roles: must be a mapping, got ${pyTypeName(rolesRaw)}`);
    return;
  }
  // Concerns bound on any platform's pre_tool_use slot — the undroppable set.
  const guardBound = new Set<string>();
  const platformsRaw = manifest["platforms"];
  if (isObject(platformsRaw)) {
    for (const block of Object.values(platformsRaw)) {
      if (!isObject(block)) continue;
      const pre = block["pre_tool_use"];
      if (Array.isArray(pre)) {
        for (const n of pre) {
          if (typeof n === "string") guardBound.add(n);
        }
      }
    }
  }
  for (const [role, spec] of Object.entries(rolesRaw)) {
    if (!isObject(spec)) {
      errors.push(`roles.${role}: must be a mapping, got ${pyTypeName(spec)}`);
      continue;
    }
    const drop = spec["drop"];
    if (drop === undefined || drop === null) {
      continue; // a role without a drop list is a no-op entry — allowed
    }
    if (!Array.isArray(drop)) {
      errors.push(`roles.${role}: 'drop' must be a list, got ${pyTypeName(drop)}`);
      continue;
    }
    for (const name of drop) {
      if (typeof name !== "string" || !concernNames.has(name)) {
        errors.push(`roles.${role}: drop entry '${String(name)}' is not a known concern`);
        continue;
      }
      if (guardBound.has(name)) {
        errors.push(
          `roles.${role}: drop entry '${name}' is bound to a pre_tool_use slot — ` +
            `safety guards are undroppable on every role`,
        );
      }
      // Severity-based twin of the slot check (review hardening 2026-08-10):
      // a fail_closed or non-advisory concern is guard-shaped regardless of
      // which slot it binds to — dropping one from a role chain would be a
      // safety removal wearing an economy label.
      const concernsRaw = manifest["concerns"];
      const spec = isObject(concernsRaw) ? concernsRaw[name] : undefined;
      if (isObject(spec)) {
        const advisory = String(spec["severity"] ?? "").trim().toLowerCase() === "advisory";
        const failClosed = spec["fail_closed"] === true;
        if (failClosed || !advisory) {
          errors.push(
            `roles.${role}: drop entry '${name}' is ${failClosed ? "fail_closed" : "not severity: advisory"} — ` +
              `only advisory, fail-open concerns may be role-dropped`,
          );
        }
      }
    }
  }
}

/**
 * A capability fact that cannot expire is a capability fact nobody re-checks.
 *
 * Three rounds of corrections to the same host claims is what this gate exists
 * to stop, so the rule is mechanical rather than editorial: an unverified row —
 * and an expired one is unverified, by the same definition `host_semantics`
 * uses — may not carry a blocking binding. Everything softer warns, because a
 * lapse on an advisory row must not red an unrelated pull request.
 */
export function _check_host_lowering(
  tablePath: string,
  errors: string[],
  warnings: string[],
  today: string = asOf().toISOString().slice(0, 10),
): void {
  let table: HostLowering;
  try {
    table = parseHostLowering(fs.readFileSync(tablePath, "utf-8"));
  } catch (exc) {
    errors.push(
      `host_lowering: ${tablePath} could not be read or parsed: ` +
        `${exc instanceof Error ? exc.message : String(exc)}`,
    );
    return;
  }
  for (const [host, surfaces] of table) {
    for (const [surface, row] of surfaces) {
      const blocking = [...row.slots.entries()]
        .filter(([, s]) => s.block_exit !== null)
        .map(([slot]) => slot);
      const expired = row.verified !== null && row.verified.expires < today;
      const where = `host_lowering ${host}/${surface}`;

      if (row.verified === null) {
        if (blocking.length > 0) {
          errors.push(
            `${where}: carries a blocking binding (${blocking.join(", ")}) with \`verified: null\`. ` +
              "Establish the row with a live deny probe and a dated `verified` block, or set " +
              "`block_exit: null` on those slots.",
          );
        }
        continue;
      }
      if (expired && blocking.length > 0) {
        errors.push(
          `${where}: \`verified.expires\` was ${row.verified.expires} and today is ${today}, ` +
            `while the row still carries a blocking binding (${blocking.join(", ")}). ` +
            "Re-establish it with a live deny probe on that host and move `expires` forward, " +
            "or set `block_exit: null` on those slots — an expired row reads as unverified.",
        );
      } else if (expired) {
        warnings.push(
          `${where}: \`verified.expires\` was ${row.verified.expires} and today is ${today}. ` +
            "The row carries no blocking binding, so nothing is degraded; re-establish it " +
            "before attaching one.",
        );
      }
      for (const field of ["docs_at", "host_version"] as const) {
        if (row.verified[field] === null) {
          warnings.push(`${where}: \`verified.${field}\` is null — the row is admissible but not fully cited.`);
        }
      }
    }
  }
}

export function lint(
  manifestPath: string,
  strict: boolean,
  hostLoweringPath: string = DEFAULT_HOST_LOWERING,
  // Threaded so a fixture test can pin the day the verdict is read against.
  // Left undefined the check resolves it through `asOf()`.
  today?: string,
): number {
  if (!_isFile(manifestPath)) {
    process.stderr.write(
      `lint_hook_manifest: file not found: ${manifestPath}\n`,
    );
    return 2;
  }
  let manifest: YamlValue;
  try {
    manifest = _load_manifest(manifestPath);
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    process.stderr.write(`lint_hook_manifest: load error: ${msg}\n`);
    return 2;
  }
  if (!isObject(manifest) || manifest["schema_version"] !== 1) {
    process.stderr.write("lint_hook_manifest: schema_version must be 1\n");
    return 1;
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const concernNames = _check_concerns(manifest, errors);
  const bound = _check_platforms(manifest, concernNames, errors, warnings);
  _check_guard_payload_bodies(manifest, errors);
  _check_roles(manifest, concernNames, errors);
  _check_aliases(manifest, errors);
  _check_orphan_trampolines(manifest, errors);
  _check_dead_concerns(concernNames, bound, warnings);
  _check_host_lowering(hostLoweringPath, errors, warnings, today);

  for (const w of warnings) {
    process.stderr.write(`warn: ${w}\n`);
  }
  for (const e of errors) {
    process.stderr.write(`error: ${e}\n`);
  }

  // Concerns are the units read — each one resolves a script path on disk.
  // Runs after the findings are printed so the existing `'concerns' must be a
  // non-empty mapping` line still reaches the caller. Exit 1, not 2: the
  // manifest loaded fine (2 is reserved for a file that could not be read or
  // parsed); what is empty is its declared scope.
  try {
    assertScanned({
      gate: "lint_hook_manifest",
      scanned: concernNames.size,
      units: "concern(s)",
      roots: [manifestPath],
    });
  } catch (exc) {
    if (exc instanceof DeadScopeError) {
      process.stderr.write(`error: ${exc.message}\n`);
      return 1;
    }
    throw exc;
  }

  if (errors.length > 0) {
    return 1;
  }
  if (strict && warnings.length > 0) {
    return 1;
  }
  return 0;
}

export function main(argv: string[]): number {
  let manifest = DEFAULT_MANIFEST;
  let hostLowering = DEFAULT_HOST_LOWERING;
  let strict = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--manifest") {
      manifest = argv[i + 1] ?? manifest;
      i += 1;
    } else if (a === "--host-lowering") {
      hostLowering = argv[i + 1] ?? hostLowering;
      i += 1;
    } else if (a === "--strict") {
      strict = true;
    }
  }
  return lint(manifest, strict, hostLowering);
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
