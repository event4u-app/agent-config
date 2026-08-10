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
 *
 * Soft-warns on placeholder platform blocks and dead concerns.
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
    names.add(name);
  }
  return names;
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
    }
  }
}

export function lint(manifestPath: string, strict: boolean): number {
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
  _check_roles(manifest, concernNames, errors);
  _check_aliases(manifest, errors);
  _check_orphan_trampolines(manifest, errors);
  _check_dead_concerns(concernNames, bound, warnings);

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
  let strict = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--manifest") {
      manifest = argv[i + 1] ?? manifest;
      i += 1;
    } else if (a === "--strict") {
      strict = true;
    }
  }
  return lint(manifest, strict);
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
