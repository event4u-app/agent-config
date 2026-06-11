#!/usr/bin/env node
/**
 * Lint `src/scripts/hook_manifest.yaml`.
 *
 * TypeScript twin of `src/scripts/lint_hook_manifest.py` (ADR-089, Phase 4 /
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
 * Load the manifest. The Python original reuses dispatch_hook._load_yaml
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
  _check_aliases(manifest, errors);
  _check_orphan_trampolines(manifest, errors);
  _check_dead_concerns(concernNames, bound, warnings);

  for (const w of warnings) {
    process.stderr.write(`warn: ${w}\n`);
  }
  for (const e of errors) {
    process.stderr.write(`error: ${e}\n`);
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

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main(process.argv.slice(2)));
}
