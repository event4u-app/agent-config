#!/usr/bin/env tsx
/**
 * File-first usage signal + hybrid promotion for global knowledge cards.
 *
 * TypeScript twin of `src/scripts/_lib/knowledge_global_promote.py` (ADR-200).
 * The public API and CLI contract mirror the Python original EXACTLY — same
 * exported snake_case names, same repo-slug / card-id derivation, same usage
 * sidecar shape (sorted-key JSON), same suggestion decision, same exit codes
 * and byte-identical stdout. No behaviour changes.
 *
 * Structure-grounding v2, Phase 2 (ADR-100 / road-to-structure-grounding-v2).
 * Replaces the retired `knowledge_card_usage.py` — file-first, no DB, no daemon.
 *
 * Two concerns:
 *
 *   * **Usage signal.** A tiny JSON sidecar in the global store
 *     (`~/.event4u/agent-config/knowledge/.usage.json`) records, per card
 *     *identity*, the set of distinct **repo-slugs** it has been seen in
 *     (`seen_in`) — identity, never a path (privacy floor). Recording a
 *     sighting NEVER writes a card to the store on its own.
 *   * **Hybrid promotion.** When a `public`/`vendor` card's `seen_in`
 *     reaches `auto_promote_threshold` distinct repos, the layer **suggests**
 *     promotion (one-tap confirm) — it never auto-promotes silently. `proprietary`
 *     cards are never suggested; they are manual-only.
 *
 * The card *write* on confirm (with the provenance footer) lives in the Phase-3
 * command surface; this module owns the signal + the suggestion decision.
 *
 * Pure except the sidecar write. Exit codes (CLI): 0 = ok, 1 = usage, 3 = error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { write_atomic } from './fs_atomic.js';
import * as knowledge_global from './knowledge_global.js';
import type { SettingsDict, SettingsValue } from './agent_settings.js';

export const USAGE_FILENAME = '.usage.json';
// Python: re.compile(r"[^a-z0-9._-]+"). The class is ASCII; replicate verbatim.
const _SLUG_RE = /[^a-z0-9._-]+/g;

// ---------------------------------------------------------------------------
// Repo-slug — privacy-safe project identity (NOT a path)
// ---------------------------------------------------------------------------

/**
 * Return a privacy-safe repo identity (slug), never a filesystem path.
 *
 * Prefers the git remote repository name (`origin` basename, `.git`
 * stripped); falls back to the project directory basename. Lower-cased and
 * sanitised to `[a-z0-9._-]`.
 */
export function repo_slug(project_root: string | null = null): string {
    const root = _resolve(project_root ?? process.cwd());
    let name = '';
    try {
        const out = spawnSync('git', ['-C', root, 'remote', 'get-url', 'origin'], {
            encoding: 'utf-8',
            timeout: 5000,
        });
        if (out.status === 0) {
            const url = _strip(out.stdout ?? '');
            const tail = _rstripSlash(url).split('/').pop() ?? '';
            name = tail.endsWith('.git') ? tail.slice(0, -4) : tail;
        }
    } catch {
        // git unavailable
        name = '';
    }
    if (!name) {
        name = path.basename(root);
    }
    return _stripDash(name.toLowerCase().replace(_SLUG_RE, '-')) || 'unknown';
}

/** Derive a stable card identity from its source or filename stem. */
export function card_id_from(options: { source?: string; card_name?: string } = {}): string {
    const source = options.source ?? '';
    const card_name = options.card_name ?? '';
    let base = card_name || source;
    base = base.split('/').pop() ?? base;
    if (base.endsWith('.md')) {
        base = base.slice(0, -3);
    }
    return _stripDash(base.toLowerCase().replace(_SLUG_RE, '-')) || 'card';
}

// ---------------------------------------------------------------------------
// Usage sidecar
// ---------------------------------------------------------------------------

function _usage_path(env: knowledge_global.EnvMapType): string {
    return path.join(knowledge_global.global_store_dir(env), USAGE_FILENAME);
}

/** Read the usage sidecar. Tolerant: missing/corrupt → empty skeleton. */
export function load_usage(env: knowledge_global.EnvMapType = null): SettingsDict {
    const p = _usage_path(env);
    try {
        const data = JSON.parse(_readText(p));
        if (_isPlainObject(data) && _isPlainObject(data['cards'])) {
            return data;
        }
    } catch {
        // OSError or JSON parse failure
    }
    return { version: 1, cards: {} };
}

/**
 * Record that `card_id` was seen in repo `slug`. Dedups; no card write.
 *
 * Honours the kill-switch: when global sharing is disabled this is a no-op
 * (returns the in-memory entry without persisting).
 */
export function record_seen(
    card_id: string,
    slug: string,
    options: {
        tier?: string;
        source?: string;
        today?: string;
        env?: knowledge_global.EnvMapType;
    } = {},
): SettingsDict {
    const tier = options.tier ?? '';
    const source = options.source ?? '';
    const today = options.today ?? '';
    const env = options.env ?? null;

    const usage = load_usage(env);
    const cards = usage['cards'] as SettingsDict;
    let entry = cards[card_id] as SettingsDict | undefined;
    if (entry === undefined) {
        entry = { tier, source, seen_in: [], first_seen: {}, promoted: false };
        cards[card_id] = entry;
    }
    if (tier) {
        entry['tier'] = tier;
    }
    if (source && !entry['source']) {
        entry['source'] = source;
    }
    const seen_in = entry['seen_in'] as string[];
    if (slug && !seen_in.includes(slug)) {
        seen_in.push(slug);
        seen_in.sort();
    }
    if (!_pyTruthy(entry['first_seen'])) {
        entry['first_seen'] = { repo: slug, date: today };
    }

    if (!knowledge_global.is_enabled(env !== null ? { env } : {})) {
        return entry; // kill-switch: never persist a global-store write
    }

    write_atomic(_usage_path(env), pyJsonDumps(usage, 2, true) + '\n');
    return entry;
}

// ---------------------------------------------------------------------------
// Promotion suggestion (never silent)
// ---------------------------------------------------------------------------

/**
 * True when a card warrants a promotion *suggestion* (never auto-promote).
 *
 * `proprietary` is never suggested (manual-only). An already-promoted card
 * is not re-suggested.
 */
export function should_suggest(
    entry: SettingsDict,
    options: { threshold: number; allowed: Set<string> },
): boolean {
    if (_pyTruthy(entry['promoted'])) {
        return false;
    }
    const tier = (entry['tier'] ?? '') as string;
    if (tier === 'proprietary' || !options.allowed.has(tier)) {
        return false;
    }
    const seen = entry['seen_in'];
    const len = Array.isArray(seen) ? seen.length : 0;
    return len >= options.threshold;
}

/**
 * List cards that warrant a promotion suggestion under the current config.
 *
 * Empty when global sharing is disabled.
 */
export function promotion_candidates(
    options: { env?: knowledge_global.EnvMapType; cwd?: string | null } = {},
): SettingsDict[] {
    const env = options.env ?? null;
    const cwd = options.cwd ?? null;
    const cfgOpts = {
        ...(cwd !== null ? { cwd } : {}),
        ...(env !== null ? { env } : {}),
    };
    if (!knowledge_global.is_enabled(cfgOpts)) {
        return [];
    }
    const cfg = knowledge_global.load_global_sharing_config(cfgOpts);
    const threshold = _pyInt(cfg['auto_promote_threshold'], 2);
    const allowed = knowledge_global.allowed_tiers(cfgOpts);
    const usage = load_usage(env);
    const cards = usage['cards'] as SettingsDict;
    const out: SettingsDict[] = [];
    for (const cid of Object.keys(cards).sort()) {
        const entry = cards[cid] as SettingsDict;
        if (should_suggest(entry, { threshold, allowed })) {
            out.push({ card_id: cid, ...entry });
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const _PROG = 'knowledge_global_promote';

export function main(argv: string[] | null = null): number {
    const args = argv ?? process.argv.slice(2);
    return _dispatch(args);
}

function _dispatch(argv: string[]): number {
    const mainUsage = `${_PROG} [-h] {record-seen,slug,candidates} ...`;
    const positionals: string[] = [];
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(`usage: ${mainUsage}\n`);
            process.exitCode = 0;
            return 0;
        }
        positionals.push(a);
    }
    const cmd = positionals[0];
    if (cmd === undefined) {
        _printMainHelp(mainUsage);
        return 1;
    }
    if (cmd === 'record-seen') {
        return _runRecordSeen(positionals.slice(1));
    }
    if (cmd === 'slug') {
        return _runSlug(positionals.slice(1));
    }
    if (cmd === 'candidates') {
        return _runCandidates(positionals.slice(1));
    }
    _argparseError(
        `argument cmd: invalid choice: ${_pyRepr(cmd)} (choose from 'record-seen', 'slug', 'candidates')`,
        mainUsage,
    );
    return 2;
}

function _runRecordSeen(rest: string[]): number {
    const usage = `${_PROG} record-seen [-h] [--slug SLUG] [--tier TIER] [--source SOURCE] [--date DATE] card_id`;
    let card_id: string | null = null;
    let slug = '';
    let tier = '';
    let source = '';
    let date = '';
    for (let i = 0; i < rest.length; i += 1) {
        const a = rest[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(`usage: ${usage}\n`);
            process.exitCode = 0;
            return 0;
        } else if (a === '--slug') {
            slug = (rest[++i] ?? '') as string;
        } else if (a.startsWith('--slug=')) {
            slug = a.slice('--slug='.length);
        } else if (a === '--tier') {
            tier = (rest[++i] ?? '') as string;
        } else if (a.startsWith('--tier=')) {
            tier = a.slice('--tier='.length);
        } else if (a === '--source') {
            source = (rest[++i] ?? '') as string;
        } else if (a.startsWith('--source=')) {
            source = a.slice('--source='.length);
        } else if (a === '--date') {
            date = (rest[++i] ?? '') as string;
        } else if (a.startsWith('--date=')) {
            date = a.slice('--date='.length);
        } else if (a.startsWith('-')) {
            _argparseError(`unrecognized arguments: ${a}`, usage);
            return 2;
        } else if (card_id === null) {
            card_id = a;
        } else {
            _argparseError(`unrecognized arguments: ${a}`, usage);
            return 2;
        }
    }
    if (card_id === null) {
        _argparseError('the following arguments are required: card_id', usage);
        return 2;
    }
    const resolvedSlug = slug || repo_slug();
    const entry = record_seen(card_id, resolvedSlug, { tier, source, today: date });
    process.stdout.write(pyJsonDumps(entry, 2, true) + '\n');
    return 0;
}

function _runSlug(rest: string[]): number {
    for (const a of rest) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(`usage: ${_PROG} slug [-h]\n`);
            process.exitCode = 0;
            return 0;
        }
    }
    process.stdout.write(repo_slug() + '\n');
    return 0;
}

function _runCandidates(rest: string[]): number {
    for (const a of rest) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(`usage: ${_PROG} candidates [-h]\n`);
            process.exitCode = 0;
            return 0;
        }
    }
    process.stdout.write(pyJsonDumps(promotion_candidates(), 2, true) + '\n');
    return 0;
}

function _printMainHelp(usage: string): void {
    process.stdout.write(
        `usage: ${usage}\n\n` +
            'File-first usage signal + hybrid promotion for global knowledge cards.\n',
    );
}

function _argparseError(message: string, usage: string): void {
    process.stderr.write(`usage: ${usage}\n${_PROG}: error: ${message}\n`);
    process.exitCode = 2;
}

// ---------------------------------------------------------------------------
// helpers — Python compatibility
// ---------------------------------------------------------------------------

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Mirror `Path(p).resolve()` — absolute + symlink-resolved (strict=false). */
function _resolve(p: string): string {
    const abs = path.resolve(p);
    try {
        return fs.realpathSync(abs);
    } catch {
        return abs;
    }
}

function _readText(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}

function _strip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

/** Python `url.rstrip("/")`. */
function _rstripSlash(s: string): string {
    return s.replace(/\/+$/, '');
}

/** Python `s.strip("-")`. */
function _stripDash(s: string): string {
    return s.replace(/^-+/, '').replace(/-+$/, '');
}

/** Python `int(cfg.get(...))` with default — tolerant of strings/floats. */
function _pyInt(value: SettingsValue, fallback: number): number {
    if (typeof value === 'number') {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const n = parseInt(value, 10);
        return Number.isNaN(n) ? fallback : n;
    }
    return fallback;
}

/** Python truthiness. */
function _pyTruthy(value: SettingsValue): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (_isPlainObject(value)) {
        return Object.keys(value).length > 0;
    }
    return true;
}

/** Python repr() for a string (single-quoted preference). */
function _pyRepr(s: string): string {
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

/** `json.dumps(obj, indent=N, sort_keys=true)` — reuse the core lib's serializer. */
function pyJsonDumps(value: unknown, indent: number, sortKeys: boolean): string {
    return knowledge_global.pyJsonDumps(value, indent, sortKeys);
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    // Mirror `raise SystemExit(main())`.
    process.exit(main());
}
