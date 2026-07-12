#!/usr/bin/env tsx
/**
 * File-first usage signal + hybrid promotion for global knowledge cards.
 *
 * Ported from the retired Python `src/scripts/_lib/knowledge_global_promote.py` (ADR-200).
 * The public API and CLI contract mirror the retired Python implementation EXACTLY — same
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
import { fileURLToPath, pathToFileURL } from 'node:url';

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

// ---------------------------------------------------------------------------
// Sensitivity gate (Phase 1, road-to-feedback-8.11 — successor note to
// ADR-119). Layered ON TOP of the existing tier/redaction gate in
// `knowledge_global_redaction.ts`: a card must clear tier + redaction FIRST,
// then clear this gate before its write is allowed to proceed.
// ---------------------------------------------------------------------------

/** Outcome of the sensitivity gate for one promotion attempt. */
export interface SensitivityGateResult {
    readonly eligible: boolean;
    readonly reason: string;
    /** The EFFECTIVE sensitivity used for the decision (post auto-derivation). */
    readonly sensitivity: string;
}

/**
 * Resolve the effective sensitivity used for a promotion decision.
 *
 * A redaction hit always forces `prohibited`, overriding any declared value —
 * this is independent of the tier gate's own `halt_on_trigger` setting, so a
 * `prohibited` override never depends on that unrelated config flag. An
 * unset / invalid declared value defaults to `project` (never `shareable` —
 * `shareable` is never auto-assigned, only explicitly declared by a human).
 */
export function resolve_effective_sensitivity(declared: string, violations_present: boolean): string {
    if (violations_present) {
        return 'prohibited';
    }
    const d = (declared ?? '').trim();
    return knowledge_global.SENSITIVITIES.includes(d) ? d : knowledge_global.DEFAULT_SENSITIVITY;
}

/**
 * Gate a card for promotion on the sensitivity axis.
 *
 * Refuses anything whose effective sensitivity is not `shareable` (including
 * the machine-derived `prohibited` override), and refuses a `shareable` card
 * that has no human-entered `promotion_reason` — the auto-promote
 * *suggestion* only ever leads to a write once a human states why the card
 * is safe to share.
 */
export function gate_sensitivity_for_promotion(
    declared_sensitivity: string,
    options: { violations_present?: boolean; promotion_reason?: string } = {},
): SensitivityGateResult {
    const violations_present = options.violations_present ?? false;
    const effective = resolve_effective_sensitivity(declared_sensitivity, violations_present);

    if (effective === 'prohibited') {
        return {
            eligible: false,
            sensitivity: effective,
            reason:
                'sensitivity: prohibited — redaction-class content, never leaves the repo',
        };
    }
    if (effective !== 'shareable') {
        return {
            eligible: false,
            sensitivity: effective,
            reason:
                `sensitivity '${effective}' — promotion refused unless a human explicitly ` +
                "reclassifies the card to 'shareable'",
        };
    }
    const reason = (options.promotion_reason ?? '').trim();
    if (!reason) {
        return {
            eligible: false,
            sensitivity: effective,
            reason:
                "sensitivity 'shareable' but no promotion_reason given — a human must state " +
                'why this card is safe to share before it may be promoted',
        };
    }
    return { eligible: true, sensitivity: effective, reason: 'sensitivity gate passed' };
}

// ---------------------------------------------------------------------------
// Revocation ledger — append-only tombstone trail (Phase 1, road-to-feedback-8.11)
// ---------------------------------------------------------------------------

export const REVOCATIONS_FILENAME = '.revocations.jsonl';

/** One append-only tombstone line: what was revoked, when, and why. */
export interface RevocationEntry {
    readonly revoked_at: string;
    readonly card_id: string;
    readonly reason: string;
}

function _revocations_path(env: knowledge_global.EnvMapType): string {
    return path.join(knowledge_global.global_store_dir(env, { create: true }), REVOCATIONS_FILENAME);
}

/**
 * Append one tombstone line to the revocation ledger — the caller MUST call
 * this BEFORE deleting the card/usage entry it documents. Append-only (a
 * single `fs.appendFileSync`, never rewritten): no `forget` / `forget --tier`
 * / `purge` call ever removes a prior tombstone, so the ledger stays a
 * durable audit trail across every deletion path — including `purge`, which
 * deliberately spares this one file while wiping everything else.
 */
export function append_tombstone(
    card_id: string,
    reason: string,
    options: { today?: string; env?: knowledge_global.EnvMapType } = {},
): RevocationEntry {
    const entry: RevocationEntry = {
        revoked_at: options.today ?? '',
        card_id,
        reason: reason || 'no reason given',
    };
    fs.appendFileSync(_revocations_path(options.env ?? null), JSON.stringify(entry) + '\n', 'utf-8');
    return entry;
}

/** Read the revocation ledger. Tolerant: missing file → []; malformed lines are skipped. */
export function load_tombstones(env: knowledge_global.EnvMapType = null): RevocationEntry[] {
    let text: string;
    try {
        text = fs.readFileSync(
            path.join(knowledge_global.global_store_dir(env), REVOCATIONS_FILENAME),
            'utf-8',
        );
    } catch {
        return [];
    }
    const out: RevocationEntry[] = [];
    for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = raw.trim();
        if (!line) {
            continue;
        }
        try {
            const obj: unknown = JSON.parse(line);
            if (_isPlainObject(obj) && typeof obj['card_id'] === 'string') {
                out.push({
                    revoked_at: String(obj['revoked_at'] ?? ''),
                    card_id: obj['card_id'],
                    reason: String(obj['reason'] ?? ''),
                });
            }
        } catch {
            // corrupt line — skip; never let one bad line crash the ledger read
        }
    }
    return out;
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

const _isMain =
    _isCliEntry();
if (_isMain) {
    // Mirror `raise SystemExit(main())`.
    process.exit(main());
}
