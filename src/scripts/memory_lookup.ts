#!/usr/bin/env tsx
/**
 * File-first memory retrieval.
 *
 * TypeScript twin of `src/scripts/memory_lookup.py` (ADR-200). The public
 * API and CLI contract mirror the Python original EXACTLY — same exported
 * names (snake_case kept deliberately, especially `retrieve(...)` whose
 * signature/return shape is cited by rules), same exit codes, stdout/stderr
 * split, byte-identical messages, same memory-file scan + ranking + JSON
 * output. No behaviour changes — latent Python bugs are replicated and
 * flagged as divergence candidates.
 *
 * Implements the shared `retrieve(types, keys, limit)` abstraction used
 * by skills. Reads YAML under `agents/memory/<type>/` (curated, hand-
 * reviewed) and JSONL under `agents/memory/intake/*.jsonl` (agent-written,
 * append-only, supersede-chain aware), plus user-ingested `knowledge`
 * chunks and opted-in `cross-repo` matches.
 *
 * Retrieval is entirely repo-side and file-backed — there is no external
 * backend. (The former optional `@event4u/agent-memory` package routing
 * was removed; see `docs/decisions/` for the agent-memory removal ADR.)
 *
 * Usage:
 *     memory_lookup --types domain-invariants,ownership --key "app/Http/Controllers/Foo" --limit 5
 *     memory_lookup --types incident-learnings --format json
 *
 *     import { retrieve } from './memory_lookup.js';
 *     const hits = retrieve(['ownership'], ['app/Http'], 3);
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import YAML, { parseDocument } from 'yaml';


// PyYAML implicit timestamp resolver. PyYAML's `safe_load` turns a plain
// `YYYY-MM-DD` scalar into a `datetime.date` (str → `YYYY-MM-DD`) and a full
// timestamp into a `datetime.datetime`. The `yaml` npm parses both to JS Date
// objects whose String()/JSON form differs, so `json.dumps(..., default=str)`
// in the CLI would not match. This marker preserves PyYAML's str() form so
// JSON output and as_dict() are byte-identical to the Python original.
const PYYAML_DATE_ONLY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const PYYAML_TIMESTAMP_RE =
    /^(?:[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}(?:[Tt]|[ \t]+)[0-9]{1,2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9]{1,2}(?::[0-9]{2})?))?)$/;

/** Marker carrying PyYAML's `str(datetime.*)` form (for JSON/default=str). */
class PyTimestamp {
    constructor(readonly pyStr: string) {}
    toString(): string {
        return this.pyStr;
    }
}

/**
 * Marker for a Python `float` so json.dumps renders integer-valued floats as
 * `0.0`/`1.0`, not `0`/`1`. The Hit `score` and the v1 `confidence` are always
 * Python floats; JS has no int/float distinction, so this preserves byte-for-byte
 * parity for whole-number scores.
 */
class PyFloat {
    constructor(readonly value: number) {}
}

// Mutable so tests can repoint them at a tmp tree (monkeypatch parity).
export let MEMORY_ROOT = path.join('agents', 'memory');
export let INTAKE_ROOT = path.join(MEMORY_ROOT, 'intake');
export let KNOWLEDGE_ROOT = path.join(MEMORY_ROOT, 'knowledge');

/** Test-only setters mirroring pytest monkeypatch on the module constants. */
export function _setMemoryRoot(p: string): void {
    MEMORY_ROOT = p;
}
export function _setIntakeRoot(p: string): void {
    INTAKE_ROOT = p;
}
export function _setKnowledgeRoot(p: string): void {
    KNOWLEDGE_ROOT = p;
}

export const CURATED_TYPES: ReadonlySet<string> = new Set([
    'ownership',
    'historical-patterns',
    'domain-invariants',
    'incident-learnings',
    'product-rules',
]);

// `knowledge` is its own type: user-ingested local documents that live
// under `agents/memory/knowledge/<ingest-id>/chunks/*.md`. They are
// repo-side (file-backed) but not "curated" and not intake.
export const KNOWLEDGE_TYPE = 'knowledge';

// Cross-repo retrieval. When this type is requested AND opted-in
// linked-project siblings exist, matches from `cross_repo_retrieve` are
// projected as `source="cross-repo"` Hits, scored below curated/knowledge.
// Opt-in by caller + lazy import → existing call sites unaffected.
export const CROSS_REPO_TYPE = 'cross-repo';

const _CURATED_STATUS_EXCLUDE: ReadonlySet<string> = new Set(['deprecated', 'archived', 'superseded']);

/** Mirror Python `entry.get("status") in _CURATED_STATUS_EXCLUDE`. */
function _statusExcluded(entry: Record<string, unknown>): boolean {
    const status = entry['status'];
    return typeof status === 'string' && _CURATED_STATUS_EXCLUDE.has(status);
}

export type HitSource = 'curated' | 'intake' | 'knowledge' | 'cross-repo';

export class Hit {
    id: string;
    type: string;
    source: string; // HitSource, kept as string to mirror the Python dataclass
    path: string; // file (or logical locator) that produced the hit
    score: number; // naive, content-match based [0..1]
    entry: Record<string, unknown>;

    constructor(
        id: string,
        type: string,
        source: string,
        p: string,
        score: number,
        entry: Record<string, unknown> = {},
    ) {
        this.id = id;
        this.type = type;
        this.source = source;
        this.path = p;
        this.score = score;
        this.entry = entry;
    }

    as_dict(): Record<string, unknown> {
        return {
            id: this.id,
            type: this.type,
            source: this.source,
            path: this.path,
            // score is a Python float — render `0.0` not `0` for whole numbers.
            score: new PyFloat(this.score),
            entry: this.entry,
        };
    }
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return (
        typeof v === 'object' &&
        v !== null &&
        !Array.isArray(v) &&
        !(v instanceof PyTimestamp) &&
        !(v instanceof PyFloat)
    );
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
 * Load a YAML file the way the Python `_load_yaml` does:
 * `yaml.safe_load(fh) or {}`. version: '1.1' matches PyYAML's default so
 * implicit scalar typing (dates, yes/no booleans) lands identically.
 */
function _load_yaml(p: string): unknown {
    const text = fs.readFileSync(p, 'utf-8');
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
            // source so JSON output / as_dict() match the Python original.
            if (node.value instanceof Date) {
                if (PYYAML_DATE_ONLY_RE.test(raw)) {
                    (node as { value: unknown }).value = new PyTimestamp(raw);
                } else if (PYYAML_TIMESTAMP_RE.test(raw)) {
                    (node as { value: unknown }).value = new PyTimestamp(_pyYamlDatetimeStr(raw));
                }
                return;
            }
            // PyYAML's bool resolver does NOT treat bare `y/Y/n/N` as boolean
            // (only yes/no/on/off/true/false) — restore those to strings.
            if (typeof node.value === 'boolean' && node.type === 'PLAIN' && /^[ynYN]$/.test(raw)) {
                (node as { value: unknown }).value = raw;
            }
        },
    });
    const data = doc.toJS({ mapAsMap: false });
    return data == null ? {} : data;
}

/** Compute PyYAML `str(datetime.datetime(...))` for a matched timestamp scalar. */
function _pyYamlDatetimeStr(raw: string): string {
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
        time += `.${(frac + '000000').slice(0, 6)}`;
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

/**
 * Yield [file, entry] pairs for curated files of `mtype`.
 *
 * Supports both the content-addressed layout (`agents/memory/<type>/
 * <hash>.yml` — one entry per file) and the single-file layout
 * (`agents/memory/<type>.yml` or `<type>/entries.yml` with an `entries:`
 * list), so consumers can adopt either.
 *
 * Entries with status in `_CURATED_STATUS_EXCLUDE` are silently skipped —
 * they are yielded only by `_iter_curated_entries_all` (used by
 * `retrieve_with_meta` to populate the `skipped` list).
 */
function* _iter_curated_entries(mtype: string): Generator<[string, Record<string, unknown>]> {
    const type_dir = path.join(MEMORY_ROOT, mtype);
    const single_file = path.join(MEMORY_ROOT, `${mtype}.yml`);
    if (_isFile(single_file)) {
        const data = _load_yaml(single_file);
        const entries = _isPlainObject(data) ? data['entries'] : null;
        for (const e of Array.isArray(entries) ? entries : []) {
            if (_isPlainObject(e)) {
                if (_statusExcluded(e)) {
                    continue;
                }
                yield [single_file, e];
            }
        }
    }
    if (_isDir(type_dir)) {
        for (const yml of _rglobYmlSorted(type_dir)) {
            const dataRaw = _load_yaml(yml);
            const data = dataRaw == null ? {} : dataRaw;
            const entries = _isPlainObject(data) ? data['entries'] : undefined;
            if (Array.isArray(entries)) {
                for (const e of entries) {
                    if (_isPlainObject(e)) {
                        if (_statusExcluded(e)) {
                            continue;
                        }
                        yield [yml, e];
                    }
                }
            } else if (_isPlainObject(data) && data['id']) {
                // Flat, one-entry-per-file layout (content-addressed).
                if (_statusExcluded(data)) {
                    continue;
                }
                yield [yml, data];
            }
        }
    }
}

/**
 * Like `_iter_curated_entries` but yields ALL entries, including
 * deprecated/archived/superseded ones. Used by `retrieve_with_meta` to build
 * the `skipped` list.
 */
function* _iter_curated_entries_all(mtype: string): Generator<[string, Record<string, unknown>]> {
    const type_dir = path.join(MEMORY_ROOT, mtype);
    const single_file = path.join(MEMORY_ROOT, `${mtype}.yml`);
    if (_isFile(single_file)) {
        const data = _load_yaml(single_file);
        const entries = _isPlainObject(data) ? data['entries'] : null;
        for (const e of Array.isArray(entries) ? entries : []) {
            if (_isPlainObject(e)) {
                yield [single_file, e];
            }
        }
    }
    if (_isDir(type_dir)) {
        for (const yml of _rglobYmlSorted(type_dir)) {
            const dataRaw = _load_yaml(yml);
            const data = dataRaw == null ? {} : dataRaw;
            const entries = _isPlainObject(data) ? data['entries'] : undefined;
            if (Array.isArray(entries)) {
                for (const e of entries) {
                    if (_isPlainObject(e)) {
                        yield [yml, e];
                    }
                }
            } else if (_isPlainObject(data) && data['id']) {
                yield [yml, data];
            }
        }
    }
}

/** Yield [file, entry] from intake JSONL, applying supersede chains. */
function* _iter_intake_entries(mtype: string): Generator<[string, Record<string, unknown>]> {
    if (!_isDir(INTAKE_ROOT)) {
        return;
    }
    // Resolve supersede chains globally per file: later lines win.
    for (const jsonl of _globJsonlSorted(INTAKE_ROOT)) {
        const by_id = new Map<string, Record<string, unknown>>();
        const superseded = new Set<string>();
        const content = fs.readFileSync(jsonl, 'utf-8');
        for (let line of content.split(/\n/)) {
            line = line.trim();
            if (!line) {
                continue;
            }
            let obj: unknown;
            try {
                obj = JSON.parse(line);
            } catch {
                continue;
            }
            if (!_isPlainObject(obj)) {
                continue;
            }
            if (obj['type'] === 'supersede') {
                const target = obj['supersedes'];
                if (typeof target === 'string') {
                    superseded.add(target);
                }
                continue;
            }
            const eid = obj['id'];
            if (typeof eid === 'string') {
                by_id.set(eid, obj);
            }
        }
        for (const [eid, obj] of by_id.entries()) {
            if (superseded.has(eid)) {
                continue;
            }
            if (mtype && obj['entry_type'] && obj['entry_type'] !== mtype) {
                continue;
            }
            yield [jsonl, obj];
        }
    }
}

/**
 * Yield [chunk-file, entry] pairs from `agents/memory/knowledge/`.
 *
 * Layout (frozen in `docs/contracts/local-knowledge-ingestion.md`):
 *
 *     agents/memory/knowledge/<ingest-id>/
 *         manifest.json
 *         chunks/<n>.md
 *
 * Each chunk becomes one retrieval entry. The chunk body, the manifest
 * source path, and pinned flag are surfaced into the entry so `_score()`
 * can match on either the source path or the chunk text. The entry id is
 * `<ingest-id>:<chunk-stem>` so callers can locate the exact file on disk.
 */
function* _iter_knowledge_entries(): Generator<[string, Record<string, unknown>]> {
    if (!_isDir(KNOWLEDGE_ROOT)) {
        return;
    }
    for (const ingest_dir of _iterdirSorted(KNOWLEDGE_ROOT)) {
        if (!_isDir(ingest_dir)) {
            continue;
        }
        const manifest_path = path.join(ingest_dir, 'manifest.json');
        let manifest: Record<string, unknown> = {};
        if (_isFile(manifest_path)) {
            try {
                const parsed = JSON.parse(fs.readFileSync(manifest_path, 'utf-8'));
                manifest = _isPlainObject(parsed) ? parsed : {};
            } catch {
                manifest = {};
            }
        }
        const ingest_id = String(manifest['ingest_id'] || path.basename(ingest_dir));
        const source = String(manifest['source'] || '');
        const pinned = Boolean(manifest['pinned'] ?? false);
        const chunks_dir = path.join(ingest_dir, 'chunks');
        if (!_isDir(chunks_dir)) {
            continue;
        }
        for (const chunk of _globMdSorted(chunks_dir)) {
            let body: string;
            try {
                body = fs.readFileSync(chunk, 'utf-8');
            } catch {
                continue;
            }
            const entry: Record<string, unknown> = {
                id: `${ingest_id}:${_stem(chunk)}`,
                ingest_id,
                source,
                path: source,
                body,
                pinned,
                source_kind: 'knowledge',
            };
            yield [chunk, entry];
        }
    }
}

/**
 * Naive relevance score: max over keys of (glob-match | substring).
 *
 * Good enough for the `absent` path where retrieval is best-effort.
 * The `present` path returns a real score from agent-memory.
 */
export function _score(entry: Record<string, unknown>, keys: string[]): number {
    if (keys.length === 0) {
        return 0.1; // any hit beats no hit when there is no key
    }
    const hay_parts: string[] = [];
    for (const field_name of ['path', 'key', 'symptom', 'feature', 'rule', 'body']) {
        const v = entry[field_name];
        if (typeof v === 'string') {
            hay_parts.push(v);
        } else if (Array.isArray(v)) {
            for (const x of v) {
                hay_parts.push(_pyStr(x));
            }
        }
    }
    const hay = hay_parts.join(' | ').toLowerCase();
    let best = 0.0;
    for (const k of keys) {
        const kl = k.toLowerCase();
        if (_fnmatch(hay, `*${kl}*`)) {
            best = Math.max(best, 0.8);
        } else if (hay.includes(kl)) {
            best = Math.max(best, 0.6);
        }
    }
    return best;
}

/**
 * Project cross-repo matches into discounted, tagged Hits.
 *
 * Lazy + guarded: the Python original imports `cross_repo_retrieve` on
 * demand and swallows any failure (script absent, no opted-in siblings) so
 * the cross-repo type degrades to zero hits rather than breaking retrieval.
 * The TypeScript twin of `cross_repo_retrieve` is unported in this phase, so
 * this always degrades to zero hits — flagged as a divergence candidate.
 * Scores sit below curated/knowledge (0.85× floor, then a small per-rank
 * decrement) so cross-repo context never outranks the project's own truth.
 */
function _cross_repo_hits(keys: string[], limit: number): Hit[] {
    const query = keys
        .filter((k) => k)
        .join(' ')
        .trim();
    if (!query) {
        return [];
    }
    // cross_repo_retrieve has no TS twin yet, so the optional surface degrades
    // to zero hits exactly as the Python `except` branch would when the script
    // is absent in a consumer install.
    void limit;
    return [];
}

/** A skipped-entry record, mirroring the Python `skipped` dict shape. */
export interface SkippedEntry {
    id: string;
    type: string;
    reason: string;
    details: string;
}

/**
 * Mirror `datetime.date.today()` as a UTC-midnight Date. Used as the default
 * `_today` so the day-difference math in `_isStale` is timezone-stable.
 */
function _today(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Parse a `YYYY-MM-DD` string the way `datetime.date.fromisoformat` does. */
function _parseIsoDate(s: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) {
        return null;
    }
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) {
        return null;
    }
    const date = new Date(Date.UTC(y, mo - 1, d));
    // Reject overflow (e.g. 2026-02-31 → March), matching fromisoformat's strictness.
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
        return null;
    }
    return date;
}

/** Recover the `str(lv)` form Python sees for a curated `last_validated`. */
function _pyStrDateLike(lv: unknown): string {
    if (lv instanceof PyTimestamp) {
        return lv.pyStr;
    }
    return _pyStr(lv);
}

/**
 * Return true when the entry's `last_validated` age exceeds `review_after_days`.
 *
 * Both fields are optional; if either is absent or malformed the entry is
 * treated as **not stale** (conservative — unknown freshness != stale).
 * Mirrors Python `_is_stale`: `str(lv)` → `date.fromisoformat` → day diff.
 */
function _isStale(entry: Record<string, unknown>, today: Date): boolean {
    const lv = entry['last_validated'];
    const rad = entry['review_after_days'];
    // Python: `not lv or not isinstance(rad, int)`. PyYAML ints land as JS
    // numbers; booleans are int in Python but excluded here as the common path.
    if (!lv || typeof rad !== 'number' || !Number.isInteger(rad)) {
        return false;
    }
    const validated = _parseIsoDate(_pyStrDateLike(lv));
    if (validated === null) {
        return false;
    }
    const days = Math.round((today.getTime() - validated.getTime()) / 86_400_000);
    return days > rad;
}

/**
 * Core retrieval loop shared by {@link retrieve} and {@link retrieve_with_meta}.
 *
 * Returns `[hits, skipped]` where `hits` is the ranked result list and
 * `skipped` lists curated entries excluded due to staleness or supersession.
 * Status-excluded entries are filtered upstream in `_iter_curated_entries`;
 * all entries (including deprecated/superseded ones) are scanned via
 * `_iter_curated_entries_all` so they can appear in `skipped`, but only
 * active, non-stale entries flow through `_iter_curated_entries` in the
 * normal path.
 */
function _retrieve_internal(types: string[], keys: string[], limit: number, today: Date): [Hit[], SkippedEntry[]] {
    const repo_hits: Hit[] = [];
    const skipped: SkippedEntry[] = [];
    for (const mtype of types) {
        if (mtype === KNOWLEDGE_TYPE) {
            for (const [p, entry] of _iter_knowledge_entries()) {
                let base = _score(entry, keys);
                // Pinned entries get a slight ranking boost so the
                // `/knowledge:list --pin` flag has retrieval effect.
                if (entry['pinned']) {
                    base = Math.min(1.0, base + 0.05);
                }
                repo_hits.push(
                    new Hit(
                        String(entry['id'] ?? ''),
                        KNOWLEDGE_TYPE,
                        'knowledge',
                        String(p),
                        // Discount vs curated/intake so hand-reviewed repo
                        // entries still win on equal relevance.
                        base * 0.85,
                        entry,
                    ),
                );
            }
            continue;
        }
        if (mtype === CROSS_REPO_TYPE) {
            for (const h of _cross_repo_hits(keys, limit)) {
                repo_hits.push(h);
            }
            continue;
        }
        if (!CURATED_TYPES.has(mtype)) {
            continue;
        }
        // Curated entries: status filtering happens inside _iter_curated_entries.
        // We additionally filter stale entries here and track them in skipped.
        for (const [p, entry] of _iter_curated_entries(mtype)) {
            void p;
            if (_isStale(entry, today)) {
                const lv = 'last_validated' in entry ? _pyStrDateLike(entry['last_validated']) : 'unknown';
                const rad = 'review_after_days' in entry ? _pyStr(entry['review_after_days']) : '?';
                skipped.push({
                    id: String(entry['id'] ?? ''),
                    type: mtype,
                    reason: 'stale',
                    details: `last_validated=${lv}, review_after_days=${rad}`,
                });
                continue;
            }
            repo_hits.push(new Hit(String(entry['id'] ?? ''), mtype, 'curated', String(p), _score(entry, keys), entry));
        }
        // Capture superseded/deprecated entries in skipped (for retrieve_with_meta).
        for (const [p, entry] of _iter_curated_entries_all(mtype)) {
            void p;
            const status = 'status' in entry && entry['status'] !== undefined ? entry['status'] : 'active';
            if (typeof status === 'string' && _CURATED_STATUS_EXCLUDE.has(status)) {
                skipped.push({
                    id: String(entry['id'] ?? ''),
                    type: mtype,
                    reason: 'superseded',
                    details: `status=${_pyStr(status)}`,
                });
            }
        }
        for (const [p, entry] of _iter_intake_entries(mtype)) {
            repo_hits.push(
                new Hit(
                    String(entry['id'] ?? ''),
                    mtype,
                    'intake',
                    String(p),
                    _score(entry, keys) * 0.9, // slight discount vs curated
                    entry,
                ),
            );
        }
    }

    _sortMerged(repo_hits);
    const positives = repo_hits.filter((h) => h.score > 0);
    const hits = (positives.length > 0 ? positives : repo_hits).slice(0, limit);
    return [hits, skipped];
}

/**
 * Return up to `limit` hits across the requested types, highest score first.
 *
 * Repo entries (curated + intake) are preferred on ties — they are
 * hand-reviewed or session-captured against the repo itself. Knowledge
 * and cross-repo hits are discounted so the project's own truth wins on
 * equal relevance.
 *
 * Curated entries with status `deprecated`, `archived`, or `superseded` are
 * excluded. Stale entries (age > `review_after_days`) are also excluded. Use
 * {@link retrieve_with_meta} to see skipped entries.
 */
export function retrieve(types: string[], keys: string[], limit = 5): Hit[] {
    const [hits] = _retrieve_internal(types, keys, limit, _today());
    return hits;
}

/**
 * Like {@link retrieve} but returns a dict with `results` and `skipped`.
 *
 * `skipped` lists curated entries excluded due to staleness or supersession,
 * each with `id`, `type`, `reason` (`"stale"` | `"superseded"`), and `details`.
 * Callers should surface stale entries to the user — silently ignoring them
 * violates the `analysis-memory-loop` contract (§ 4).
 *
 * `today` may be injected for deterministic testing (the Python keyword arg
 * is `_today`; a JS `Date` at UTC midnight or `null` for the real today).
 */
export function retrieve_with_meta(
    types: string[],
    keys: string[],
    limit = 5,
    today: Date | null = null,
): { results: Hit[]; skipped: SkippedEntry[] } {
    const day = today ?? _today();
    const [hits, skipped] = _retrieve_internal(types, keys, limit, day);
    return { results: hits, skipped };
}

/**
 * Return the top hit if its score meets `threshold`, else `null`.
 *
 * Used by analysis skills for the dedup pre-check described in
 * `analysis-memory-loop` § 2. A return value indicates an existing entry that
 * should be reinforced or superseded rather than creating a new one.
 *
 * `today` may be injected for deterministic testing.
 */
export function find_duplicate(types: string[], keys: string[], threshold = 0.6, today: Date | null = null): Hit | null {
    const result = retrieve_with_meta(types, keys, 1, today);
    const hits = result.results;
    if (hits.length > 0 && (hits[0] as Hit).score >= threshold) {
        return hits[0] as Hit;
    }
    return null;
}

/**
 * Mirror `repo_hits.sort(key=lambda h: (h.score, h.source == "curated"),
 * reverse=True)` — stable descending by (score, isCurated).
 */
function _sortMerged(merged: Hit[]): void {
    // Python's list.sort is stable. To reproduce a stable descending sort by
    // a composite key, sort the (index, hit) pairs and compare keys; equal
    // keys keep original order (lower index first).
    const indexed = merged.map((h, i) => ({ h, i }));
    indexed.sort((a, b) => {
        if (a.h.score !== b.h.score) {
            return b.h.score - a.h.score; // descending score
        }
        const ac = a.h.source === 'curated' ? 1 : 0;
        const bc = b.h.source === 'curated' ? 1 : 0;
        if (ac !== bc) {
            return bc - ac; // descending: curated (True) before non-curated
        }
        return a.i - b.i; // stable: preserve original order
    });
    for (let i = 0; i < indexed.length; i += 1) {
        merged[i] = (indexed[i] as { h: Hit }).h;
    }
}

export const _CONTRACT_VERSION = 1;
// Exported under the Python name too.
export { _CONTRACT_VERSION as CONTRACT_VERSION };

// Memory types this file-backed backend can answer. Types outside this set
// map to `unknown_type` per the retrieval contract.
const _KNOWN_TYPES: ReadonlySet<string> = new Set([...CURATED_TYPES, KNOWLEDGE_TYPE, CROSS_REPO_TYPE]);

/**
 * Return a v1 retrieval-contract envelope.
 *
 * Wraps {@link retrieve} and projects the internal `Hit` shape into the
 * shape defined by `internal/schemas/retrieval-v1.schema.json`. Unknown
 * types are reported as `status: unknown_type` for that slice only, rather
 * than failing the whole call. All entries are file-backed (`source: "repo"`).
 */
export function retrieve_v1(types: string[], keys: string[], limit = 20): Record<string, unknown> {
    const known = types.filter((t) => _KNOWN_TYPES.has(t));
    const unknown = types.filter((t) => !_KNOWN_TYPES.has(t));

    const hits = retrieve(known, keys, limit);

    const slice_counts: Record<string, number> = {};
    for (const t of known) {
        slice_counts[t] = 0;
    }
    const entries: Record<string, unknown>[] = [];
    for (const h of hits) {
        const envelope_entry: Record<string, unknown> = {
            id: h.id,
            type: h.type,
            source: 'repo',
            // confidence = round(float(score), 4) — always a Python float.
            confidence: new PyFloat(_round4(h.score)),
            body: _isPlainObject(h.entry) ? { ...h.entry } : {},
        };
        if (h.type in slice_counts) {
            slice_counts[h.type] = (slice_counts[h.type] as number) + 1;
        }
        entries.push(envelope_entry);
    }

    const slices: Record<string, Record<string, unknown>> = {};
    for (const t of known) {
        slices[t] = { status: 'ok', count: slice_counts[t] ?? 0 };
    }
    const errors: Record<string, unknown>[] = [];
    for (const t of unknown) {
        slices[t] = { status: 'unknown_type', count: 0 };
        errors.push({
            type: t,
            code: 'unknown_type',
            message: `file-backed backend does not know type ${_pyRepr(t)}`,
        });
    }

    const sliceVals = Object.values(slices);
    const oks = sliceVals.filter((s) => s['status'] === 'ok');
    const fails = sliceVals.filter((s) => s['status'] !== 'ok');
    const envelope_status = fails.length === 0 ? 'ok' : oks.length === 0 ? 'error' : 'partial';

    const envelope: Record<string, unknown> = {
        contract_version: _CONTRACT_VERSION,
        status: envelope_status,
        entries,
        slices,
    };
    if (errors.length > 0) {
        envelope['errors'] = errors;
    }
    return envelope;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface ParsedArgs {
    types: string;
    key: string[];
    limit: number;
    format: 'text' | 'json';
    envelope: 'legacy' | 'v1';
}

function _parseArgs(argv: string[]): ParsedArgs {
    const args: ParsedArgs = {
        types: '',
        key: [],
        limit: 5,
        format: 'text',
        envelope: 'legacy',
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--types') {
            args.types = argv[++i] as string;
        } else if (a.startsWith('--types=')) {
            args.types = a.slice('--types='.length);
        } else if (a === '--key') {
            args.key.push(argv[++i] as string);
        } else if (a.startsWith('--key=')) {
            args.key.push(a.slice('--key='.length));
        } else if (a === '--limit') {
            args.limit = _parseInt(argv[++i], '--limit');
        } else if (a.startsWith('--limit=')) {
            args.limit = _parseInt(a.slice('--limit='.length), '--limit');
        } else if (a === '--format') {
            args.format = _checkChoice(argv[++i], ['text', 'json'], '--format') as 'text' | 'json';
        } else if (a.startsWith('--format=')) {
            args.format = _checkChoice(a.slice('--format='.length), ['text', 'json'], '--format') as 'text' | 'json';
        } else if (a === '--envelope') {
            args.envelope = _checkChoice(argv[++i], ['legacy', 'v1'], '--envelope') as 'legacy' | 'v1';
        } else if (a.startsWith('--envelope=')) {
            args.envelope = _checkChoice(a.slice('--envelope='.length), ['legacy', 'v1'], '--envelope') as
                | 'legacy'
                | 'v1';
        } else if (a === '-h' || a === '--help') {
            _printUsage();
            process.exit(0);
        } else {
            process.stderr.write(`memory_lookup: error: unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    return args;
}

function _parseInt(value: string | undefined, flag: string): number {
    const n = Number(value);
    if (value === undefined || !Number.isInteger(n)) {
        process.stderr.write(
            `memory_lookup: error: argument ${flag}: invalid int value: '${value ?? ''}'\n`,
        );
        process.exit(2);
    }
    return n;
}

function _checkChoice(value: string | undefined, choices: string[], flag: string): string {
    if (value === undefined || !choices.includes(value)) {
        process.stderr.write(
            `memory_lookup: error: argument ${flag}: invalid choice: '${value ?? ''}' (choose from ${choices
                .map((c) => `'${c}'`)
                .join(', ')})\n`,
        );
        process.exit(2);
    }
    return value;
}

function _printUsage(): void {
    process.stdout.write(
        'usage: memory_lookup [-h] [--types TYPES] [--key KEY] [--limit LIMIT] ' +
            '[--format {text,json}] [--envelope {legacy,v1}]\n',
    );
}

export function main(): number {
    const args = _parseArgs(process.argv.slice(2));
    const types = args.types
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t);
    if (types.length === 0) {
        process.stderr.write('error: --types is required\n');
        return 2;
    }
    if (args.envelope === 'v1') {
        const envelope = retrieve_v1(types, args.key, args.limit);
        process.stdout.write(`${pyJsonDumps(envelope, 2)}\n`);
        return 0;
    }
    const hits = retrieve(types, args.key, args.limit);
    if (args.format === 'json') {
        const payload = {
            hits: hits.map((h) => h.as_dict()),
        };
        process.stdout.write(`${pyJsonDumps(payload, 2)}\n`);
    } else {
        if (hits.length === 0) {
            process.stdout.write('  (no hits)\n');
        }
        for (const h of hits) {
            process.stdout.write(
                `  [${h.source}] ${h.type}  score=${_fixed2(h.score)}  ` +
                    `id=${h.id || '-'}  path=${h.path}\n`,
            );
        }
    }
    return 0;
}

// ---------------------------------------------------------------------------
// helpers — Python compatibility
// ---------------------------------------------------------------------------

/** Mirror Python `f"{score:.2f}"`. */
function _fixed2(n: number): string {
    return n.toFixed(2);
}

/** Mirror Python `round(x, 4)` (banker's rounding). */
function _round4(n: number): number {
    return _pyRound(n, 4);
}

/** Python 3 round(): round-half-to-even at the given decimal places. */
function _pyRound(value: number, ndigits: number): number {
    const factor = 10 ** ndigits;
    const scaled = value * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    if (diff > 0.5) {
        rounded = floor + 1;
    } else if (diff < 0.5) {
        rounded = floor;
    } else {
        // exactly .5 → round to even
        rounded = floor % 2 === 0 ? floor : floor + 1;
    }
    return rounded / factor;
}

/** fnmatch.fnmatch — translate a shell glob to a regex (POSIX-normcase). */
function _fnmatch(name: string, pattern: string): boolean {
    const re = _fnmatchTranslate(pattern);
    return re.test(name);
}

/**
 * Mirror fnmatch.translate: `*` → `.*`, `?` → `.`, `[...]` char class,
 * everything else escaped. Anchored full-match.
 */
function _fnmatchTranslate(pat: string): RegExp {
    let res = '';
    let i = 0;
    const n = pat.length;
    while (i < n) {
        const c = pat[i] as string;
        i += 1;
        if (c === '*') {
            res += '.*';
        } else if (c === '?') {
            res += '.';
        } else if (c === '[') {
            let j = i;
            if (j < n && pat[j] === '!') {
                j += 1;
            }
            if (j < n && pat[j] === ']') {
                j += 1;
            }
            while (j < n && pat[j] !== ']') {
                j += 1;
            }
            if (j >= n) {
                res += '\\[';
            } else {
                let stuff = pat.slice(i, j);
                if (!stuff.includes('-')) {
                    stuff = stuff.replace(/\\/g, '\\\\');
                } else {
                    // Match CPython's bracket-range handling minimally.
                    stuff = stuff.replace(/\\/g, '\\\\');
                }
                i = j + 1;
                if (stuff.startsWith('!')) {
                    stuff = `^${stuff.slice(1)}`;
                } else if (stuff.startsWith('^') || stuff.startsWith('[')) {
                    stuff = `\\${stuff}`;
                }
                res += `[${stuff}]`;
            }
        } else {
            res += _reEscape(c);
        }
    }
    // CPython uses (?s:...)\Z — dotall, anchored to end. Anchor both ends.
    return new RegExp(`^(?:${res})$`, 's');
}

function _reEscape(ch: string): string {
    return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Mirror Python str(x) for list-element haystack building / repr. */
function _pyStr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    return String(value);
}

/** Mirror Python repr() for a string in the unknown_type message: {t!r}. */
function _pyRepr(s: string): string {
    // Python repr prefers single quotes unless the string contains a single
    // quote and no double quote.
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        if (ch === quote || ch === '\\') {
            out += `\\${ch}`;
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else {
            out += ch;
        }
    }
    return out + quote;
}

// ---------------------------------------------------------------------------
// filesystem helpers — mirror pathlib glob/rglob/iterdir ordering
// ---------------------------------------------------------------------------

/** Mirror sorted(dir.rglob("*.yml")) — recursive, sorted by POSIX path string. */
function _rglobYmlSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.name.endsWith('.yml')) {
                out.push(full);
            }
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort();
    return out;
}

/** Mirror sorted(dir.glob("*.jsonl")) — non-recursive, sorted. */
function _globJsonlSorted(dir: string): string[] {
    return _globSorted(dir, '.jsonl');
}

/** Mirror sorted(dir.glob("*.md")). */
function _globMdSorted(dir: string): string[] {
    return _globSorted(dir, '.md');
}

function _globSorted(dir: string, suffix: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out = entries
        .filter((e) => e.name.endsWith(suffix) && (e.isFile() || (e.isSymbolicLink() && _isFile(path.join(dir, e.name)))))
        .map((e) => path.join(dir, e.name));
    out.sort();
    return out;
}

/** Mirror sorted(dir.iterdir()). */
function _iterdirSorted(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names.map((name) => path.join(dir, name));
    out.sort();
    return out;
}

function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    return dot <= 0 ? base : base.slice(0, dot);
}

// ---------------------------------------------------------------------------
// Python-compatible json.dumps(obj, indent=N, default=str)
// ---------------------------------------------------------------------------

/**
 * `json.dumps(obj, indent=2, default=str)`. Uses item separator `,\n` +
 * indent and key separator `": "`. Non-serialisable values fall back to
 * str(). `ensure_ascii=True` by default → non-ASCII escaped.
 */
function pyJsonDumps(value: unknown, indent: number): string {
    return _escapeNonAscii(_dumpsIndent(value, indent, 0));
}

function _dumpsIndent(value: unknown, indent: number, depth: number): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _jsonNum(value);
    }
    if (typeof value === 'string') {
        return _jsonStrAscii(value);
    }
    if (value instanceof PyTimestamp) {
        // default=str on a datetime → PyYAML str() form (already computed).
        return _jsonStrAscii(value.pyStr);
    }
    if (value instanceof PyFloat) {
        return _jsonFloat(value.value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dumpsIndent(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (_isPlainObject(value)) {
        const keys = Object.keys(value);
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map((k) => `${pad}${_jsonStrAscii(k)}: ${_dumpsIndent(value[k], indent, depth + 1)}`);
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    // default=str
    return _jsonStrAscii(String(value));
}

function _jsonNum(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return String(n);
}

/** Render a Python float — integer-valued floats keep a `.0` suffix (repr(float)). */
function _jsonFloat(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return Number.isInteger(n) ? `${n}.0` : String(n);
}

/** JSON string with standard escapes (ensure_ascii handled by caller pass). */
function _jsonStrAscii(s: string): string {
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
                    out += ch;
                }
        }
    }
    return `${out}"`;
}

function _escapeNonAscii(s: string): string {
    let out = '';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (code > 0x7f) {
            for (let i = 0; i < ch.length; i += 1) {
                out += `\\u${ch.charCodeAt(i).toString(16).padStart(4, '0')}`;
            }
        } else {
            out += ch;
        }
    }
    return out;
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    process.exit(main());
}
