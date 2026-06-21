#!/usr/bin/env tsx
/**
 * Content-addressed hash for a curated memory entry.
 *
 * TypeScript twin of `src/scripts/memory_hash.py` (ADR-200, Phase 7 /
 * dev-side memory CORE). The public API and CLI contract mirror the Python
 * original EXACTLY — same exported names (snake_case kept deliberately),
 * same canonical-JSON serialisation (sorted keys, no whitespace,
 * `ensure_ascii=False`, `default=str`), same SHA-256 truncation, same exit
 * codes, byte-identical messages. No behaviour changes.
 *
 * The hash is SHA-256 over the canonical-JSON-serialized entry, truncated
 * to the first 12 hex chars. Canonical JSON sorts object keys, uses no
 * extra whitespace, and normalises types so two equivalent entries hash
 * identically regardless of YAML formatting.
 *
 * Used by `/memory-promote` to pick the filename
 * `agents/memory/<type>/<hash>.yml` so the same entry promoted on two
 * branches converges to a single file after `git merge`.
 *
 * Usage:
 *     memory_hash --yaml path/to/entry.yml
 *     echo '{"id":"x"}' | memory_hash --json-stdin
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import * as path from 'node:path';
import YAML, { parseDocument } from 'yaml';

export const HASH_LEN = 12;

// PyYAML timestamp implicit-resolver. A *plain* (unquoted) scalar matching
// these is constructed as datetime.date / datetime.datetime. str() of a
// `datetime.date` is `YYYY-MM-DD`; str() of a `datetime.datetime` keeps the
// time component (e.g. `2026-01-01 13:45:30`). The `yaml` npm parses these
// to JS Date objects whose String() form differs, so canonical_json would
// hash differently — this marker preserves PyYAML's str() shape exactly.
const PYYAML_DATE_ONLY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const PYYAML_TIMESTAMP_RE =
    /^(?:[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}(?:[Tt]|[ \t]+)[0-9]{1,2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9]{1,2}(?::[0-9]{2})?))?)$/;

/** Marker carrying PyYAML's `str(datetime.*)` form for canonical hashing. */
class PyTimestamp {
    constructor(readonly pyStr: string) {}
}

/**
 * Canonical-JSON serialisation matching Python's
 * `json.dumps(obj, sort_keys=True, separators=(",",":"),
 *  ensure_ascii=False, default=str)`, encoded UTF-8.
 *
 * - Object keys sorted (recursively).
 * - No whitespace between tokens.
 * - Non-ASCII characters preserved (NOT escaped).
 * - Non-serialisable scalars fall back to `str(value)` (`default=str`).
 */
export function canonical_json(obj: unknown): Buffer {
    return Buffer.from(_dumps(obj), 'utf-8');
}

export function hash_entry(obj: unknown): string {
    return createHash('sha256').update(canonical_json(obj)).digest('hex').slice(0, HASH_LEN);
}

/** Serialise with sorted keys + compact separators, mirroring json.dumps. */
function _dumps(value: unknown): string {
    if (value === null || value === undefined) {
        // Python json: None → "null". `undefined` cannot occur from parsed
        // YAML/JSON; treat it as None for safety.
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _numRepr(value);
    }
    if (typeof value === 'string') {
        return _strRepr(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _dumps(v)).join(',')}]`;
    }
    if (value instanceof PyTimestamp) {
        // default=str on a datetime.date/datetime → PyYAML's str() form.
        return _strRepr(value.pyStr);
    }
    if (_isPlainObject(value)) {
        const keys = Object.keys(value).sort();
        const parts = keys.map((k) => `${_strRepr(k)}:${_dumps(value[k])}`);
        return `{${parts.join(',')}}`;
    }
    // default=str — any other type stringified, then JSON-quoted.
    return _strRepr(String(value));
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** json.dumps number repr: integers stay int-like; floats keep Python form. */
function _numRepr(n: number): string {
    if (!Number.isFinite(n)) {
        // Python json emits Infinity / -Infinity / NaN (allow_nan default).
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    if (Number.isInteger(n)) {
        return String(n);
    }
    return String(n);
}

/**
 * json.dumps string repr with `ensure_ascii=False`: standard JSON escapes
 * for control chars / `"` / `\`, but non-ASCII passed through verbatim.
 */
function _strRepr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20) {
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else {
                    // ensure_ascii=False — emit the char as-is (incl. non-ASCII).
                    out += ch;
                }
        }
    }
    return `${out}"`;
}

function _load_yaml(p: string): unknown {
    // PyYAML availability is the Python-side concern; here a read failure
    // surfaces as a thrown error (mirrors Python's open() raising).
    const text = fs.readFileSync(p, 'utf-8');
    // version: '1.1' matches PyYAML's default (YAML 1.1) so implicit typing
    // (e.g. yes/no → bool, sexagesimals) lands the same way `safe_load` does.
    // The `yaml` npm parses plain timestamp scalars to JS Date objects whose
    // String() form differs from PyYAML's `str(datetime.*)`; rewrite those to
    // a PyTimestamp marker carrying the exact PyYAML str() so canonical_json
    // hashes identically.
    const doc = parseDocument(text, { version: '1.1', prettyErrors: false });
    if (doc.errors.length > 0) {
        const err = doc.errors[0];
        throw new Error(err ? err.message : 'YAML parse error');
    }
    YAML.visit(doc, {
        Scalar(_key, node) {
            if (!node.range) {
                return;
            }
            const raw = text.slice(node.range[0], node.range[1]);
            // Under YAML 1.1 the `yaml` lib resolves plain timestamp scalars to
            // JS Date objects. Recover PyYAML's str() form from the original
            // source text so canonical_json hashes identically.
            if (node.value instanceof Date) {
                if (PYYAML_DATE_ONLY_RE.test(raw)) {
                    (node as { value: unknown }).value = new PyTimestamp(raw);
                } else if (PYYAML_TIMESTAMP_RE.test(raw)) {
                    (node as { value: unknown }).value = new PyTimestamp(_pyYamlDatetimeStr(raw));
                }
                return;
            }
            // PyYAML's bool resolver does NOT treat bare `y/Y/n/N` as boolean
            // (only yes/no/on/off/true/false). The `yaml` lib's 1.1 schema
            // does — restore those four to strings to match `safe_load`.
            if (typeof node.value === 'boolean' && node.type === 'PLAIN' && /^[ynYN]$/.test(raw)) {
                (node as { value: unknown }).value = raw;
            }
        },
    });
    return doc.toJS({ mapAsMap: false });
}

/** Compute PyYAML `str(datetime.datetime(...))` for a matched timestamp scalar. */
function _pyYamlDatetimeStr(raw: string): string {
    // Split date / time on T|t|whitespace; PyYAML always renders the date with
    // a space separator and zero-padded fields, time as HH:MM:SS[.ffffff][±HH:MM].
    const m =
        /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[Tt]|[ \t]+)(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d*))?(?:[ \t]*(Z|[-+]\d{1,2}(?::\d{2})?))?$/.exec(
            raw,
        );
    if (!m) {
        return raw;
    }
    const [, y, mo, d, h, mi, s, frac, tz] = m;
    const date = `${y}-${_pad2(mo as string)}-${_pad2(d as string)}`;
    let time = `${_pad2(h as string)}:${mi}:${s}`;
    if (frac && /[1-9]/.test(frac)) {
        // datetime.microsecond → str() pads to 6 digits, drops trailing zeros
        // only by truncation to 6 then keeping all 6 (Python keeps 6).
        const micro = (frac + '000000').slice(0, 6);
        time += `.${micro}`;
    }
    let off = '';
    if (tz) {
        if (tz === 'Z') {
            off = '+00:00';
        } else {
            const tm = /^([-+])(\d{1,2})(?::(\d{2}))?$/.exec(tz);
            if (tm) {
                off = `${tm[1]}${_pad2(tm[2] as string)}:${tm[3] ?? '00'}`;
            }
        }
    }
    return `${date} ${time}${off}`;
}

function _pad2(v: string): string {
    return v.length === 1 ? `0${v}` : v;
}

export function main(): number {
    const argv = process.argv.slice(2);
    const parsed = _parseArgs(argv);
    let entry: unknown;
    if (parsed.yaml !== null) {
        entry = _load_yaml(parsed.yaml);
    } else {
        entry = JSON.parse(fs.readFileSync(0, 'utf-8'));
    }
    if (!(_isPlainObject(entry) || Array.isArray(entry))) {
        process.stderr.write(`error: expected object/array, got ${_pyTypeName(entry)}\n`);
        return 1;
    }
    process.stdout.write(`${hash_entry(entry)}\n`);
    return 0;
}

/** Mirror Python `type(x).__name__` for the error message. */
function _pyTypeName(v: unknown): string {
    if (v === null || v === undefined) {
        return 'NoneType';
    }
    if (typeof v === 'boolean') {
        return 'bool';
    }
    if (typeof v === 'number') {
        return Number.isInteger(v) ? 'int' : 'float';
    }
    if (typeof v === 'string') {
        return 'str';
    }
    return typeof v;
}

interface ParsedArgs {
    yaml: string | null;
    json_stdin: boolean;
}

const _USAGE = 'usage: memory_hash [-h] (--yaml YAML | --json-stdin)';

/** argparse-style error: usage line + `<prog>: error: <msg>` to stderr, exit 2. */
function _argError(msg: string): never {
    process.stderr.write(`${_USAGE}\n`);
    process.stderr.write(`memory_hash: error: ${msg}\n`);
    process.exit(2);
}

/** argparse mutually-exclusive group (required) for --yaml / --json-stdin. */
function _parseArgs(argv: string[]): ParsedArgs {
    const args: ParsedArgs = { yaml: null, json_stdin: false };
    let sawGroup = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--yaml') {
            if (sawGroup) {
                _argError('argument --yaml: not allowed with argument --json-stdin');
            }
            args.yaml = argv[++i] as string;
            sawGroup = true;
        } else if (a.startsWith('--yaml=')) {
            if (sawGroup) {
                _argError('argument --yaml: not allowed with argument --json-stdin');
            }
            args.yaml = a.slice('--yaml='.length);
            sawGroup = true;
        } else if (a === '--json-stdin') {
            if (sawGroup) {
                _argError('argument --json-stdin: not allowed with argument --yaml');
            }
            args.json_stdin = true;
            sawGroup = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(`${_USAGE}\n`);
            process.exit(0);
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    if (!sawGroup) {
        _argError('one of the arguments --yaml --json-stdin is required');
    }
    return args;
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    process.exit(main());
}
