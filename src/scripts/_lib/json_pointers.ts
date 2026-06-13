/**
 * JSON-pointer helpers for the v2 `merged_keys[]` manifest field.
 *
 * TypeScript twin of `src/scripts/_lib/json_pointers.py` (ADR-094 —
 * Python→TS migration, Phase 2 / Wave 1). Public API mirrors the Python
 * module exactly (snake_case kept deliberately).
 *
 * Two invariants:
 *
 * 1. **No array indices.** Pointers MUST target named object keys only.
 *    `/hooks/PostToolUse` is valid; `/hooks/PostToolUse/0` is not.
 * 2. **Arrays carry a `value_hash` discriminator.** A pointer that
 *    targets a parent whose value is a list records the SHA-256 of the
 *    JSON-serialised list contents the install wrote, so uninstall can
 *    identify the owned elements by content rather than position.
 *
 * `value_hash` reproduces Python's canonical
 * `json.dumps(value, sort_keys=True, separators=(",", ":"))` output
 * byte-for-byte for JSON-shaped values (ensure_ascii escaping, key
 * sorting by code point) so hashes computed by either runtime match.
 */

import { createHash } from "node:crypto";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export class ArrayIndexPointerError extends Error {
  readonly pointer: string;
  readonly segment: string;

  constructor(pointer: string, segment: string) {
    super(
      `json_pointer '${pointer}' targets array index '${segment}'; ` +
        "pointers MUST target named object keys only " +
        "(see road-to-multi-package-coexistence.md § P1.5)",
    );
    this.name = "ArrayIndexPointerError";
    this.pointer = pointer;
    this.segment = segment;
  }
}

/** Escape a JSON pointer segment per RFC 6901 § 4. */
function _escape_segment(key: string): string {
  return key.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * Throw `ArrayIndexPointerError` if any segment is an integer.
 *
 * The empty pointer (`""`) is valid (targets the document root).
 * Otherwise the pointer must start with `/` and split into segments;
 * each segment that parses cleanly as a non-negative integer is
 * rejected (RFC 6901 array-index syntax).
 */
export function validate_pointer(pointer: string): void {
  if (pointer === "") return;
  if (!pointer.startsWith("/")) {
    throw new Error(
      `json_pointer '${pointer}' must start with '/' (RFC 6901)`,
    );
  }
  // Skip the leading empty segment from the leading slash.
  const segments = pointer.split("/").slice(1);
  for (const seg of segments) {
    // RFC 6901 § 4 — array index = unsigned integer, no leading zero
    // except for "0" itself.
    if (/^[0-9]+$/.test(seg) && (seg === "0" || !seg.startsWith("0"))) {
      throw new ArrayIndexPointerError(pointer, seg);
    }
  }
}

/** Compare two strings by Unicode code point (Python `str` ordering). */
function _cmp_code_points(a: string, b: string): number {
  const ai = [...a];
  const bi = [...b];
  const n = Math.min(ai.length, bi.length);
  for (let i = 0; i < n; i += 1) {
    const ca = (ai[i] as string).codePointAt(0) as number;
    const cb = (bi[i] as string).codePointAt(0) as number;
    if (ca !== cb) return ca - cb;
  }
  return ai.length - bi.length;
}

/**
 * Escape a string like Python's `json.dumps` with `ensure_ascii=True`:
 * short escapes for `"` `\` and control chars, `\uXXXX` for every
 * UTF-16 code unit outside 0x20–0x7E (non-BMP chars become surrogate
 * pairs — identical to CPython's encoder output).
 */
function _py_json_string(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    const ch = s[i] as string;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code >= 0x20 && code <= 0x7e) out += ch;
    else out += `\\u${code.toString(16).padStart(4, "0")}`;
  }
  return out + '"';
}

/** Render a number like Python's `json.dumps` (int vs float repr). */
function _py_json_number(n: number): string {
  if (!Number.isFinite(n)) {
    // Python emits Infinity/NaN literals by default; mirror that.
    if (Number.isNaN(n)) return "NaN";
    return n > 0 ? "Infinity" : "-Infinity";
  }
  // Note: a Python *float* with integral value renders as "1.0" while a
  // Python int renders "1"; JS has a single number type, so integral
  // values render in int form. JSON-parsed documents behave identically
  // in both runtimes (json.loads(\"1.0\") keeps float in Python — see
  // divergence notes in the migration report).
  return String(n);
}

/** Canonical JSON: sorted keys, no whitespace, ensure_ascii — Python parity. */
function _canonical_json(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return _py_json_number(value);
    case "string":
      return _py_json_string(value);
    case "object":
      break;
    default:
      throw new TypeError(
        `Object of type ${typeof value} is not JSON serializable`,
      );
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => _canonical_json(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort(_cmp_code_points);
  const parts = keys.map(
    (k) => `${_py_json_string(k)}:${_canonical_json(obj[k])}`,
  );
  return `{${parts.join(",")}}`;
}

/**
 * Return a stable SHA-256 hex digest of `value` (JSON-serialised).
 *
 * Uses canonical JSON (sorted keys, no whitespace) so the hash is
 * insertion-order independent. Used to discriminate tool-owned
 * entries in a shared array on uninstall.
 */
export function value_hash(value: unknown): string {
  const payload = _canonical_json(value);
  return createHash("sha256").update(payload, "utf-8").digest("hex");
}

export interface PointerEntry {
  json_pointer: string;
  value_hash: string | null;
}

export interface MergeEntry extends PointerEntry {
  file: string;
}

function _is_plain_object(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

export interface CollectPointersOptions {
  prefix?: string;
  include_arrays?: boolean;
}

/**
 * Walk an overlay dict and return one entry per object-key pointer.
 *
 * Each entry: `{ json_pointer: string, value_hash: string | null }`.
 * `value_hash` is set when the targeted value is a list (arrays need
 * content-hash discrimination on uninstall); for nested dicts we
 * recurse and emit a pointer for each inner key. Scalars get a pointer
 * with `value_hash = null` (the key/value pair fully identifies the
 * merge).
 *
 * The collector NEVER emits array-index pointers — list contents are
 * owned wholesale at the parent key.
 */
export function collect_pointers(
  overlay: Record<string, unknown>,
  options: CollectPointersOptions = {},
): PointerEntry[] {
  const prefix = options.prefix ?? "";
  const include_arrays = options.include_arrays ?? true;
  const entries: PointerEntry[] = [];
  for (const [key, value] of Object.entries(overlay)) {
    const pointer = `${prefix}/${_escape_segment(String(key))}`;
    if (_is_plain_object(value)) {
      // Recurse so the manifest captures the leaf object keys, not just
      // the root container. Empty dicts get a single entry at the key
      // so an uninstall can still remove them.
      if (Object.keys(value).length === 0) {
        entries.push({ json_pointer: pointer, value_hash: null });
      } else {
        entries.push(
          ...collect_pointers(value, { prefix: pointer, include_arrays }),
        );
      }
    } else if (Array.isArray(value)) {
      entries.push({
        json_pointer: pointer,
        value_hash: include_arrays ? value_hash(value) : null,
      });
    } else {
      entries.push({ json_pointer: pointer, value_hash: null });
    }
  }
  // Validate every emitted pointer once at the end — cheap and
  // guarantees the invariant even if a future caller hand-crafts
  // entries.
  for (const entry of entries) {
    validate_pointer(entry.json_pointer);
  }
  return entries;
}

/**
 * Return v2 `merged_keys[]` entries for a single JSON merge.
 *
 * `file_label` is the manifest-relative file path the merge touched
 * (e.g. `.cursor/hooks.json`). The overlay is the dict the installer
 * wrote into the file; only its top-level object keys become pointers
 * (recursing through nested objects, halting at lists / scalars).
 */
export function build_merge_entries(
  file_label: string,
  overlay: Record<string, unknown>,
): MergeEntry[] {
  const pointers = collect_pointers(overlay);
  return pointers.map((entry) => ({
    file: file_label,
    json_pointer: entry.json_pointer,
    value_hash: entry.value_hash,
  }));
}

// ---------------------------------------------------------------------------
// Subtraction (P2.2 — uninstall round-trip)
// ---------------------------------------------------------------------------

/** Split a non-empty pointer into unescaped segments. */
function _split_segments(pointer: string): string[] {
  if (pointer === "") return [];
  // RFC 6901: leading '/' separates segments; unescape ~1 → '/' and ~0 → '~'.
  const parts = pointer.split("/").slice(1);
  return parts.map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/**
 * Walk `doc` down `segments` and return `[parent_dict, leaf_key]`.
 *
 * Returns `null` when any intermediate segment is missing or not a
 * dict (we never descend into lists by index, see `validate_pointer`).
 */
function _navigate(
  doc: unknown,
  segments: string[],
): [Record<string, unknown>, string] | null {
  if (segments.length === 0) return null;
  let cursor: unknown = doc;
  for (const seg of segments.slice(0, -1)) {
    if (!_is_plain_object(cursor) || !(seg in cursor)) return null;
    cursor = cursor[seg];
  }
  if (!_is_plain_object(cursor)) return null;
  const leaf = segments[segments.length - 1] as string;
  if (!(leaf in cursor)) return null;
  return [cursor, leaf];
}

export interface SubtractWarning {
  pointer: string;
  reason: "missing" | "drift";
  expected_hash: string | null;
  actual_hash: string | null;
}

export interface SubtractEntry {
  json_pointer: string;
  value_hash?: string | null;
}

/**
 * Remove the pointers in `entries` from `doc`; trim empty ancestors.
 *
 * `entries` is a list of `{ json_pointer, value_hash }` records (the
 * per-file slice of a tool's `merged_keys[]`). For each entry:
 *
 * - `value_hash == null` → delete the key at the pointer.
 * - `value_hash` set → the target is a list owned wholesale by the
 *   tool. Delete only when the current value's hash still matches;
 *   otherwise treat as **drift** (a neighbour package or the user
 *   edited the array) and skip, surfacing a warning.
 *
 * After every leaf removal we walk up the ancestor chain and drop any
 * empty dict the removal left behind — but only empty ones. A
 * neighbour tool's remaining keys keep the container alive, so its
 * contributions are never touched.
 *
 * Returns `[updated_doc, warnings]` where `warnings` describes
 * pointers that could not be subtracted cleanly.
 */
export function subtract_pointers(
  doc: Record<string, unknown>,
  entries: SubtractEntry[],
): [Record<string, unknown>, SubtractWarning[]] {
  const warnings: SubtractWarning[] = [];
  // Sort longest-first so leaves are removed before their ancestors —
  // otherwise ancestor cleanup races leaf removal in deep trees.
  // Array.prototype.sort is stable (ES2019), matching Python's sorted().
  const ordered = [...entries].sort(
    (a, b) =>
      _split_segments(b.json_pointer).length -
      _split_segments(a.json_pointer).length,
  );
  for (const entry of ordered) {
    const pointer = entry.json_pointer;
    const expected = entry.value_hash ?? null;
    const segments = _split_segments(pointer);
    const nav = _navigate(doc, segments);
    if (nav === null) {
      warnings.push({
        pointer,
        reason: "missing",
        expected_hash: expected,
        actual_hash: null,
      });
      continue;
    }
    const [parent, leaf] = nav;
    if (expected !== null) {
      const actual = value_hash(parent[leaf]);
      if (actual !== expected) {
        warnings.push({
          pointer,
          reason: "drift",
          expected_hash: expected,
          actual_hash: actual,
        });
        continue;
      }
    }
    delete parent[leaf];
    // Trim empty-ancestor chain — never remove a container that still
    // holds foreign keys.
    for (let depth = segments.length - 1; depth > 0; depth -= 1) {
      const ancestor_segments = segments.slice(0, depth);
      const anc_nav = _navigate(doc, ancestor_segments);
      if (anc_nav === null) break;
      const [anc_parent, anc_leaf] = anc_nav;
      const candidate = anc_parent[anc_leaf];
      if (_is_plain_object(candidate) && Object.keys(candidate).length === 0) {
        delete anc_parent[anc_leaf];
        continue;
      }
      break;
    }
  }
  return [doc, warnings];
}

export type { JsonValue };
