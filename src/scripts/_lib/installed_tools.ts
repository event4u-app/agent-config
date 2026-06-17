/**
 * Project-scope installed-tools manifest at `agents/installed-tools.lock`.
 *
 * TypeScript twin of `src/scripts/_lib/installed_tools.py` (ADR-200 — Python→TS
 * migration, Phase 2 / Wave 2a). Public API mirrors the Python module exactly
 * (snake_case kept deliberately — fidelity over TS idiom), including the
 * byte-exact YAML wire format the `_render` golden tests pin.
 *
 * Phase 3 of road-to-global-first-install (ADR-008). Committed
 * bill-of-materials for AI tooling a project depends on. Sibling to the
 * global lockfile (`installed_lock.ts`) but architecturally distinct:
 *
 * - `installed_lock` lives in `~/.event4u/agent-config/` and tracks the
 *   user-scope environment (a single `agent_config_version` and a flat
 *   `tools[]` list).
 * - `installed_tools` lives in `agents/` and tracks **per-project** tooling
 *   with richer per-entry metadata (`scope`, `bridge_marker`, `installed_at`).
 *
 * The file is machine-managed: `init` appends / merges; `sync` replays;
 * `validate` drift-checks. Schema is YAML; the Python reference uses `pyyaml`
 * when available and otherwise a constrained manual parser. This port has no
 * YAML library dependency — it always uses the manual parser, which handles
 * the documented schema (no anchors, no flow style, single-level nesting under
 * `tools`).
 *
 * Divergence candidate (flagged, not fixed): the Python reader prefers
 * `pyyaml` and only falls back to the manual parser when it is absent or the
 * YAML is malformed. This port has no YAML dependency, so it always takes the
 * manual-parser path. For the canonical schema both paths agree; for v2
 * manifests with nested `files` / `merged_keys` arrays the manual path
 * silently drops those nested fields (documented degraded read in the Python
 * source). A consumer relying on `pyyaml`-backed full-v2 fidelity would see a
 * behavior change here. See ADR-200 § intentional-divergence.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as fsPath from "node:path";

import { write_atomic } from "./fs_atomic.js";

export type EnvMap = Record<string, string | undefined>;

/** A loosely-typed dict, mirroring Python's `dict[str, Any]`. */
export type AnyDict = Record<string, unknown>;

export const MANIFEST_ENV = "AGENT_CONFIG_INSTALLED_TOOLS";
export const DEFAULT_MANIFEST_RELATIVE = fsPath.join("agents", "installed-tools.lock");
export const SCHEMA_VERSION = 2;

/**
 * Schema versions older writers may have emitted. Reading any of these
 * succeeds; writing always produces {@link SCHEMA_VERSION}.
 */
export const SCHEMA_VERSIONS_SUPPORTED: readonly number[] = [1, 2];

const _VALID_SCOPES: readonly string[] = ["global", "project"];

/**
 * Permitted values for `files[].kind` (P1.1, road-to-multi-package-
 * coexistence). `bridge` = team-pointer marker (e.g. `.cursorrules`);
 * `deployed` = bundle content we wrote (e.g. `.augment/rules/*.md`);
 * `marker` = one-off sentinel (e.g. `claude-desktop` install marker).
 */
export const FILE_KINDS: ReadonlySet<string> = new Set(["bridge", "deployed", "marker"]);

/**
 * Stable known deploy roots — directories under which the doctor command
 * surveys for foreign files. Writers may extend the live `deploy_roots` field
 * per project; this constant is the canonical default the installer seeds.
 */
export const DEFAULT_DEPLOY_ROOTS: readonly string[] = [
  ".augment/rules",
  ".augment/skills",
  ".augment/commands",
  ".cursor/rules",
  ".claude/skills",
  ".claude/commands",
  ".clinerules",
  ".windsurf/rules",
];

/** Expand a leading `~` like Python's `Path.expanduser()`. */
function expanduser(p: string): string {
  if (p === "~") {
    return os.homedir();
  }
  if (p.startsWith("~/") || (process.platform === "win32" && p.startsWith("~\\"))) {
    return fsPath.join(os.homedir(), p.slice(2));
  }
  return p;
}

/** Return the active manifest path, honoring the env override. */
export function manifest_path(project_root: string, env?: EnvMap | null): string {
  const env_map = env ?? process.env;
  const override = env_map[MANIFEST_ENV];
  if (override) {
    return expanduser(override);
  }
  return fsPath.join(project_root, DEFAULT_MANIFEST_RELATIVE);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

const _TOP_KEY_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"?([^"\n]*?)"?\s*$/;
const _LIST_DASH_RE = /^\s*-\s*(.+?)\s*$/;
const _INDENT_KEY_RE = /^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"?([^"\n]*?)"?\s*$/;

/**
 * Parse the manifest into a dict; return `null` if absent.
 *
 * Tolerates partial / malformed files: missing keys yield missing dict entries
 * rather than throwing, so a corrupted file does not brick `init`. v1 and v2
 * wire formats both return the same shape — v2 optional fields (`deploy_roots`,
 * per-tool `files` / `merged_keys`) default to empty lists when absent, so
 * callers can iterate without `?? []` boilerplate (P1.2).
 */
export function read_manifest(path: string): AnyDict | null {
  let text: string;
  try {
    text = require_read_text(path);
  } catch {
    return null;
  }
  // This port has no YAML dependency — always use the manual parser. See the
  // module-level divergence note.
  const data = _parse_manual(text);
  return _normalise_v2_shape(data);
}

/** Read a file as UTF-8 text, throwing on any error (caller catches). */
function require_read_text(path: string): string {
  return fs.readFileSync(path, { encoding: "utf-8" });
}

/**
 * Backfill v2 optional fields so consumers can iterate uniformly.
 *
 * Idempotent: calling on an already-normalised dict is a no-op. Does not
 * mutate input lists — replaces missing keys with fresh empties.
 */
export function _normalise_v2_shape(data: AnyDict): AnyDict {
  if (data["tools"] === undefined || data["tools"] === null) {
    data["tools"] = [];
  }
  if (data["deploy_roots"] === undefined || data["deploy_roots"] === null) {
    data["deploy_roots"] = [];
  }
  const tools = data["tools"] as unknown[];
  for (const tool of tools) {
    if (typeof tool !== "object" || tool === null) {
      continue;
    }
    const t = tool as AnyDict;
    if (t["files"] === undefined || t["files"] === null) {
      t["files"] = [];
    }
    if (t["merged_keys"] === undefined || t["merged_keys"] === null) {
      t["merged_keys"] = [];
    }
  }
  return data;
}

/**
 * Strict v1 manual parser; v2 nested fields are skipped, not raised.
 *
 * Handles the canonical v1 wire format (top-level scalars + `tools` array with
 * single-level key:value entries). For v2 manifests it still extracts the
 * top-level scalars and the per-tool scalar fields, but silently drops nested
 * arrays (`files`, `merged_keys`) and top-level `deploy_roots`.
 */
export function _parse_manual(text: string): AnyDict {
  const data: AnyDict = { tools: [] };
  const tools = data["tools"] as AnyDict[];
  let in_tools = false;
  let current: AnyDict | null = null;
  // When the current tool entry opened a nested array (`files:` or
  // `merged_keys:`), suppress recognition of the deeper `- key` lines as new
  // tools until the indent climbs back to the per-tool level (4 spaces).
  let skip_until_outdent = false;
  for (const raw of splitlines(text)) {
    const stripped = raw.trim();
    if (!stripped || stripped.startsWith("#")) {
      continue;
    }
    if (stripped === "tools:") {
      in_tools = true;
      current = null;
      skip_until_outdent = false;
      continue;
    }
    if (in_tools) {
      const indent = raw.length - lstrip_spaces(raw).length;
      if (skip_until_outdent && indent > 4) {
        continue;
      }
      skip_until_outdent = false;
      const m = _LIST_DASH_RE.exec(raw);
      if (m && indent === 2) {
        const first = m[1]!;
        current = {};
        tools.push(current);
        const inline = _TOP_KEY_RE.exec(first);
        if (inline) {
          current[inline[1]!] = inline[2]!;
        }
        continue;
      }
      const mk = _INDENT_KEY_RE.exec(raw);
      if (mk && current !== null && indent === 4) {
        const key = mk[1]!;
        const val = mk[2]!;
        if ((key === "files" || key === "merged_keys") && !val) {
          skip_until_outdent = true;
          continue;
        }
        current[key] = val;
        continue;
      }
    }
    const m_top = _TOP_KEY_RE.exec(raw);
    if (m_top) {
      const key = m_top[1]!;
      const value = m_top[2]!;
      if (key === "deploy_roots" && !value) {
        // Top-level v2 array — skip until next top-level scalar.
        in_tools = false;
        current = null;
        skip_until_outdent = true;
        continue;
      }
      if (key === "schema_version") {
        const parsed = parse_int_strict(value);
        data[key] = parsed === null ? value : parsed;
      } else {
        data[key] = value;
      }
      in_tools = false;
      current = null;
      skip_until_outdent = false;
    }
  }
  return data;
}

/** `str.splitlines()` — split on `\n`, dropping a trailing empty segment. */
function splitlines(text: string): string[] {
  const parts = text.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts;
}

/** Left-strip only spaces, mirroring Python's `lstrip(" ")`. */
function lstrip_spaces(s: string): string {
  let i = 0;
  while (i < s.length && s[i] === " ") {
    i += 1;
  }
  return s.slice(i);
}

/** Parse a base-10 int the way Python's `int(value)` does; null on failure. */
function parse_int_strict(value: string): number | null {
  if (!/^[+-]?\d+$/.test(value.trim())) {
    return null;
  }
  return Number.parseInt(value, 10);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

function _render(
  version: string,
  tools: AnyDict[],
  options: { deploy_roots?: string[] | null } = {},
): string {
  const deploy_roots = options.deploy_roots ?? null;
  const lines: string[] = [
    `schema_version: ${SCHEMA_VERSION}`,
    `agent_config_version: "${version}"`,
  ];
  if (deploy_roots && deploy_roots.length > 0) {
    lines.push("deploy_roots:");
    for (const root of deploy_roots) {
      lines.push(`  - ${root}`);
    }
  }
  lines.push("tools:");
  for (const tool of tools) {
    lines.push(`  - name: ${String(tool["name"])}`);
    lines.push(`    scope: ${String(tool["scope"])}`);
    lines.push(`    bridge_marker: ${String(tool["bridge_marker"])}`);
    lines.push(`    installed_at: "${String(tool["installed_at"])}"`);
    const status = tool["status"];
    if (status) {
      lines.push(`    status: ${String(status)}`);
    }
    let files = (tool["files"] as AnyDict[] | undefined) ?? [];
    if (files.length > 0) {
      // Sort by path ascending — deterministic output for golden-file tests
      // and stable team diffs (P1.3).
      files = stable_sort(files, (f) => [String(f["path"])]);
      lines.push("    files:");
      for (const entry of files) {
        lines.push(`      - path: ${String(entry["path"])}`);
        lines.push(`        kind: ${String(entry["kind"])}`);
        const sha = entry["sha256"];
        if (sha === null || sha === undefined) {
          lines.push("        sha256: null");
        } else {
          lines.push(`        sha256: "${String(sha)}"`);
        }
      }
    }
    let merged = (tool["merged_keys"] as AnyDict[] | undefined) ?? [];
    if (merged.length > 0) {
      // Sort by (file, json_pointer) ascending — deterministic output
      // regardless of insertion order (P1.3).
      merged = stable_sort(merged, (e) => [
        String(e["file"]),
        String(e["json_pointer"]),
      ]);
      lines.push("    merged_keys:");
      for (const entry of merged) {
        lines.push(`      - file: ${String(entry["file"])}`);
        lines.push(`        json_pointer: "${String(entry["json_pointer"])}"`);
        const vh = entry["value_hash"];
        if (vh !== null && vh !== undefined) {
          lines.push(`        value_hash: "${String(vh)}"`);
        }
      }
    }
  }
  return lines.join("\n") + "\n";
}

/**
 * Stable sort by a tuple key, mirroring Python's tuple-comparison `sorted`.
 * Compares each component lexicographically; ties keep input order.
 */
function stable_sort<T>(items: T[], key: (item: T) => string[]): T[] {
  return items
    .map((item, index) => ({ item, index, k: key(item) }))
    .sort((a, b) => {
      const len = Math.max(a.k.length, b.k.length);
      for (let i = 0; i < len; i += 1) {
        const av = a.k[i] ?? "";
        const bv = b.k[i] ?? "";
        if (av < bv) return -1;
        if (av > bv) return 1;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

/**
 * Atomically write the manifest; return the path written.
 *
 * Delegates to {@link write_atomic} so the crash-safety guarantees (fsync
 * file, atomic rename, fsync parent dir) are shared with every other v2
 * writer.
 *
 * `deploy_roots` is the optional top-level v2 field listing directories the
 * doctor command surveys for foreign files. When omitted, the field is not
 * emitted (callers may rely on {@link DEFAULT_DEPLOY_ROOTS} for the survey
 * scope).
 */
export function write_manifest(
  path: string,
  version: string,
  tools: AnyDict[],
  options: { deploy_roots?: string[] | null } = {},
): string {
  const rendered = _render(version, tools, { deploy_roots: options.deploy_roots ?? null });
  return write_atomic(path, rendered);
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

/** Raised when an existing manifest entry conflicts with the new scope. */
export class ScopeMismatchError extends Error {
  readonly name_: string;
  readonly recorded_scope: string;
  readonly new_scope: string;

  constructor(name: string, recorded_scope: string, new_scope: string) {
    super(
      `tool '${name}' is committed as scope=${recorded_scope}; ` +
        `refusing to change it to scope=${new_scope} without --force`,
    );
    this.name = "ScopeMismatchError";
    this.name_ = name;
    this.recorded_scope = recorded_scope;
    this.new_scope = new_scope;
  }
}

/**
 * Return a new tools list with `name` added or refreshed.
 *
 * Idempotency rules from ADR-008 §Lifecycle:
 * - Same name, same scope → no-op (timestamp preserved).
 * - Same name, different scope → throw {@link ScopeMismatchError} unless
 *   `force=true`, in which case the entry is rewritten.
 * - New name → appended in install order (not alphabetised).
 *
 * `files` / `merged_keys` are the v2 per-tool inventories (P1.4). When
 * provided, they replace whatever was previously recorded on the entry — the
 * installer is authoritative for the set of artefacts it just wrote. When
 * `null`/omitted, existing values are preserved on the idempotent path and
 * absent on first-write.
 */
export function upsert_tool(
  existing: AnyDict[],
  options: {
    name: string;
    scope: string;
    bridge_marker: string;
    installed_at?: string | null;
    force?: boolean;
    files?: AnyDict[] | null;
    merged_keys?: AnyDict[] | null;
  },
): AnyDict[] {
  const {
    name,
    scope,
    bridge_marker,
    installed_at = null,
    force = false,
    files = null,
    merged_keys = null,
  } = options;

  if (!_VALID_SCOPES.includes(scope)) {
    throw new ValueError(`scope must be one of ${_VALID_SCOPES.join(",")}: '${scope}'`);
  }
  const stamp = installed_at || _today();

  const _build = (prior: AnyDict | null = null): AnyDict => {
    const entry: AnyDict = {
      name,
      scope,
      bridge_marker,
      installed_at: stamp,
    };
    if (files !== null) {
      entry["files"] = [...files];
    } else if (prior !== null && Array.isArray(prior["files"]) && (prior["files"] as unknown[]).length > 0) {
      entry["files"] = [...(prior["files"] as AnyDict[])];
    }
    if (merged_keys !== null) {
      entry["merged_keys"] = [...merged_keys];
    } else if (
      prior !== null &&
      Array.isArray(prior["merged_keys"]) &&
      (prior["merged_keys"] as unknown[]).length > 0
    ) {
      entry["merged_keys"] = [...(prior["merged_keys"] as AnyDict[])];
    }
    return entry;
  };

  const result: AnyDict[] = [];
  let found = false;
  for (const entry of existing) {
    if (entry["name"] === name) {
      found = true;
      const recorded = String(entry["scope"] ?? "");
      if (recorded === scope) {
        if (files === null && merged_keys === null) {
          // Idempotent no-op — preserve original entry.
          result.push(entry);
        } else {
          // Refresh inventories, preserve installed_at.
          const refreshed = _build(entry);
          refreshed["installed_at"] = entry["installed_at"] ?? stamp;
          result.push(refreshed);
        }
        continue;
      }
      if (!force) {
        throw new ScopeMismatchError(name, recorded, scope);
      }
      result.push(_build(entry));
      continue;
    }
    result.push(entry);
  }
  if (!found) {
    result.push(_build());
  }
  return result;
}

/** Thrown for invalid-argument conditions, mirroring Python's `ValueError`. */
export class ValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValueError";
  }
}

function _today(): string {
  // UTC date in YYYY-MM-DD — matches Python's
  // `datetime.now(timezone.utc).strftime("%Y-%m-%d")`.
  return new Date().toISOString().slice(0, 10);
}
