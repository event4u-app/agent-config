#!/usr/bin/env tsx
/**
 * File-first global knowledge-card layer — store path, config, origin-tier.
 *
 * TypeScript twin of `src/scripts/_lib/knowledge_global.py` (ADR-200,
 * Python→TS migration). The public API and CLI contract mirror the Python
 * original EXACTLY — same exported snake_case names, same semantics, same
 * tier-classification, provenance footer, and config-merge behavior, same
 * exit codes and byte-identical stdout. No behaviour changes.
 *
 * Structure-grounding v2 (ADR-100 / road-to-structure-grounding-v2). Promotes
 * *expensive* (remote) project-local knowledge cards to a per-user, file-first
 * global store reusable across projects **as leads only**.
 *
 * This module is the shared spine for every later phase (redaction, promotion,
 * the command surface, the linter):
 *
 *   * `global_store_dir` — resolve `~/.event4u/agent-config/knowledge/`
 *     (the install `global` scope), created **lazily**. No index, no daemon,
 *     no DB, no vector store, no background decay (preserves the 2026-06-14
 *     Layer-2 sunset's core — see ADR-100).
 *   * `load_global_sharing_config` — read the user-global `knowledge.global_sharing`
 *     setting (default ON for the safe tiers), with hard defaults.
 *   * `classify_tier` — origin-tier detection: a card source is `public`
 *     (registry / GitHub / docs URL), `vendor` (known SaaS API host), or
 *     `proprietary` (in-house DB / private API / repo-relative). Conservative:
 *     an unknown / hostless source classifies `proprietary` (manual-only).
 *
 * Pure, read-only except `global_store_dir(create=true)`. Lazy YAML import.
 *
 * Exit codes (CLI): 0 = ok, 1 = bad usage, 3 = internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { load_agent_settings } from './agent_settings.js';
import type { SettingsDict, SettingsValue } from './agent_settings.js';
import * as user_global_paths from './user_global_paths.js';

/** Env-map shape for the optional `env` parameter (mirrors Python `Optional[dict]`). */
export type EnvMapType = user_global_paths.EnvMap | null;

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

export const TIERS: readonly string[] = ['public', 'vendor', 'proprietary'];

/**
 * Default tiers eligible to auto-cross a project boundary under default-on.
 * `proprietary` is excluded by design — manual-only regardless of `enabled`.
 */
export const DEFAULT_ALLOWED_TIERS: readonly string[] = ['public', 'vendor'];

/**
 * Hard defaults applied when the setting block is absent. Default is ON for
 * the safe tiers; turning sharing on never makes promotion automatic.
 */
export const DEFAULT_CONFIG: SettingsDict = {
    enabled: true,
    allowed_tiers: [...DEFAULT_ALLOWED_TIERS],
    redaction: { enabled: true, halt_on_trigger: true },
    auto_promote_threshold: 2,
    freshness: { hypothesis_after_days: 90, stale_after_days: 180 },
};

// Host suffix allowlists — extend as new sources appear. Matched on the
// registrable host suffix so subdomains are covered (e.g. `foo.npmjs.com`).
const _PUBLIC_HOST_SUFFIXES: readonly string[] = [
    'npmjs.com',
    'npmjs.org',
    'registry.npmjs.org',
    'yarnpkg.com',
    'pypi.org',
    'pythonhosted.org',
    'readthedocs.io',
    'readthedocs.org',
    'packagist.org',
    'rubygems.org',
    'crates.io',
    'pkg.go.dev',
    'github.com',
    'raw.githubusercontent.com',
    'githubusercontent.com',
    'gitlab.com',
    'bitbucket.org',
    'developer.mozilla.org',
    'w3.org',
    'ietf.org',
    'json-schema.org',
];

// Known third-party SaaS / vendor API hosts. Their structure is shareable
// **with redaction** (may carry account ids / region hints in examples).
const _VENDOR_HOST_SUFFIXES: readonly string[] = [
    'stripe.com',
    'amazonaws.com',
    'googleapis.com',
    'cloud.google.com',
    'azure.com',
    'azure.net',
    'twilio.com',
    'sendgrid.com',
    'slack.com',
    'atlassian.net',
    'atlassian.com',
    'shopify.com',
    'salesforce.com',
    'hubspot.com',
    'openai.com',
    'anthropic.com',
    'cloudflare.com',
    'datadoghq.com',
    'sentry.io',
    'auth0.com',
    'okta.com',
    'plaid.com',
];

// Hosts that always mean a private / in-house surface.
const _PROPRIETARY_HOST_MARKERS: readonly string[] = [
    'localhost',
    '.internal',
    '.local',
    '.lan',
    '.intranet',
    '.corp',
    '.test',
];

// ---------------------------------------------------------------------------
// Store path
// ---------------------------------------------------------------------------

/**
 * Resolve the file-first global card store.
 *
 * `~/.event4u/agent-config/knowledge/` (honours `EVENT4U_CONFIG_HOME`).
 * Created **lazily** only when `create=true` — no index, no daemon.
 */
export function global_store_dir(
    env: user_global_paths.EnvMap | null = null,
    options: { create?: boolean } = {},
): string {
    const create = options.create ?? false;
    const root = path.join(user_global_paths.event4u_root(env), 'knowledge');
    if (create) {
        fs.mkdirSync(root, { recursive: true });
    }
    return root;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function _deep_default_merge(base: SettingsDict, override: SettingsValue): SettingsDict {
    const out: SettingsDict = {};
    for (const [k, v] of Object.entries(base)) {
        out[k] = _is_plain_dict(v) ? { ...v } : v;
    }
    if (!_is_plain_dict(override)) {
        return out;
    }
    for (const [key, val] of Object.entries(override)) {
        if (_is_plain_dict(out[key]) && _is_plain_dict(val)) {
            out[key] = _deep_default_merge(out[key] as SettingsDict, val);
        } else {
            out[key] = val;
        }
    }
    return out;
}

/**
 * Return the resolved `knowledge.global_sharing` config with defaults.
 *
 * Reads the full settings cascade (project + user-global whitelist) via
 * {@link load_agent_settings}. Missing block → defaults (sharing ON for the
 * safe tiers). Tolerant: any read failure returns the hard defaults.
 */
export function load_global_sharing_config(
    options: { cwd?: string | null; env?: user_global_paths.EnvMap | null } = {},
): SettingsDict {
    const cwd = options.cwd ?? null;
    let settings: SettingsDict;
    try {
        settings = load_agent_settings(cwd !== null ? { cwd } : {});
    } catch {
        // never let a read error gate the agent
        return _deep_default_merge(DEFAULT_CONFIG, {});
    }
    let block: SettingsValue = (settings ?? {})['knowledge'] ?? {};
    block = _is_plain_dict(block) ? (block['global_sharing'] ?? {}) : {};
    return _deep_default_merge(DEFAULT_CONFIG, block);
}

/** True when the global-sharing layer is active. `enabled: false` no-ops. */
export function is_enabled(
    options: { cwd?: string | null; env?: user_global_paths.EnvMap | null } = {},
): boolean {
    const cfg = load_global_sharing_config(options);
    const enabled = cfg['enabled'] ?? true;
    return _pyTruthy(enabled);
}

/**
 * Tiers auto-eligible to cross a boundary. `proprietary` is never here —
 * it is manual-only regardless of the configured list (the gate hard-codes it).
 */
export function allowed_tiers(
    options: { cwd?: string | null; env?: user_global_paths.EnvMap | null } = {},
): Set<string> {
    const cfg = load_global_sharing_config(options);
    const raw = cfg['allowed_tiers'] ?? DEFAULT_ALLOWED_TIERS;
    const list = Array.isArray(raw) ? raw : [];
    const tiers = new Set<string>();
    for (const t of list) {
        if (TIERS.includes(t as string)) {
            tiers.add(t as string);
        }
    }
    tiers.delete('proprietary');
    return tiers;
}

// ---------------------------------------------------------------------------
// Origin-tier detection
// ---------------------------------------------------------------------------

/** Return the lowercased host of a URL source, or null if hostless. */
function _host_of(source: string): string | null {
    const s = (source ?? '').trim();
    if (!s.includes('://')) {
        // Bare `host/path` or relative file path. Treat a leading
        // `domain.tld/...` as a URL-ish host; anything else is hostless.
        const head = s.split('/', 1)[0] as string;
        if (head.includes('.') && !head.includes(' ') && !head.startsWith('.')) {
            return head.toLowerCase();
        }
        return null;
    }
    const host = _urlsplit_hostname(s);
    return host ? host.toLowerCase() : null;
}

/**
 * Mirror `urllib.parse.urlsplit(s).hostname` for the host component.
 *
 * urlsplit's hostname is the lowercased netloc with userinfo/port stripped,
 * brackets removed from IPv6. We replicate the parts this module relies on:
 * extract netloc between `//` and the next `/`, `?`, or `#`, strip any
 * `user:pass@`, strip a trailing `:port`, and de-bracket IPv6.
 */
function _urlsplit_hostname(url: string): string | null {
    const schemeIdx = url.indexOf('://');
    if (schemeIdx < 0) {
        return null;
    }
    let rest = url.slice(schemeIdx + 3);
    // netloc ends at the first /, ?, or #.
    const stop = rest.search(/[/?#]/);
    let netloc = stop < 0 ? rest : rest.slice(0, stop);
    // Strip userinfo.
    const at = netloc.lastIndexOf('@');
    if (at >= 0) {
        netloc = netloc.slice(at + 1);
    }
    if (netloc === '') {
        return null;
    }
    // IPv6 literal in brackets.
    if (netloc.startsWith('[')) {
        const close = netloc.indexOf(']');
        if (close >= 0) {
            return netloc.slice(1, close).toLowerCase();
        }
    }
    // Strip :port.
    const colon = netloc.indexOf(':');
    if (colon >= 0) {
        netloc = netloc.slice(0, colon);
    }
    return netloc === '' ? null : netloc.toLowerCase();
}

function _suffix_match(host: string, suffixes: readonly string[]): boolean {
    return suffixes.some((suf) => host === suf || host.endsWith('.' + suf));
}

/**
 * Classify a card source into `public` / `vendor` / `proprietary`.
 *
 * * `public` — registry / GitHub / canonical-docs host.
 * * `vendor` — known third-party SaaS API host (shareable with redaction).
 * * `proprietary` — in-house DB / private API / repo-relative / unknown.
 *
 * Conservative: an unknown or hostless source is `proprietary` (manual-only),
 * so a misclassification never auto-leaks a private surface.
 */
export function classify_tier(source: string): string {
    const s = (source ?? '').trim().toLowerCase();
    if (!s) {
        return 'proprietary';
    }

    const host = _host_of(source);
    if (host === null) {
        // No host — repo-relative path, file:, or a bare in-house identifier.
        return 'proprietary';
    }

    // Private markers win outright.
    if (
        host === 'localhost' ||
        _PROPRIETARY_HOST_MARKERS.some((m) => host === _lstripDot(m) || host.endsWith(m))
    ) {
        return 'proprietary';
    }
    // Bare IPs (incl. private ranges) are in-house by default.
    const parts = host.split('.').filter((p) => p !== '');
    if (
        parts.every((p) => _isPyDigit(p)) &&
        _isPyDigit(host.split('.').join(''))
    ) {
        return 'proprietary';
    }

    if (_suffix_match(host, _VENDOR_HOST_SUFFIXES)) {
        return 'vendor';
    }
    if (_suffix_match(host, _PUBLIC_HOST_SUFFIXES)) {
        return 'public';
    }
    // Unknown public-looking host → conservative manual-only.
    return 'proprietary';
}

/** Mirror Python `m.lstrip(".")` for the proprietary-marker comparison. */
function _lstripDot(s: string): string {
    return s.replace(/^\.+/, '');
}

/**
 * Mirror Python `str.isdigit()` for the bare-IP check.
 *
 * Python `str.isdigit()` is True for a non-empty string whose chars are all
 * digits (Unicode digit/decimal). The host parts here are ASCII; an empty
 * string is False. `"".isdigit()` is False, matching the `all(...)` over a
 * possibly-empty filtered list (vacuously True) combined with the second
 * `host.replace(".","").isdigit()` guard.
 */
function _isPyDigit(s: string): boolean {
    if (s.length === 0) {
        return false;
    }
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (code < 0x30 || code > 0x39) {
            // ASCII fast-path; fall back to Unicode Nd for parity.
            if (!/\p{Nd}/u.test(ch)) {
                return false;
            }
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// Provenance footer — the audit trail that substitutes for git history
// ---------------------------------------------------------------------------

export const PROVENANCE_START = '<!-- global-provenance:start -->';
export const PROVENANCE_END = '<!-- global-provenance:end -->';
const _PROVENANCE_FIELDS: readonly string[] = [
    'first_seen',
    'promoted_at',
    'last_verified',
    'tier',
    'seen_in',
];

/** Render the global-card provenance footer (the unversioned-store audit trail). */
export function render_provenance_footer(args: {
    first_seen_repo: string;
    first_seen_date: string;
    promoted_at: string;
    last_verified: string;
    tier: string;
    seen_in: string[];
}): string {
    return [
        PROVENANCE_START,
        '<!-- This global store is unversioned (ADR-100); this footer is its audit trail. -->',
        `- first_seen: ${args.first_seen_repo} · ${args.first_seen_date}`,
        `- promoted_at: ${args.promoted_at}`,
        `- last_verified: ${args.last_verified}`,
        `- tier: ${args.tier}`,
        `- seen_in: ${args.seen_in.join(', ')}`,
        PROVENANCE_END,
        '',
    ].join('\n');
}

/** Extract the provenance footer fields as a flat dict (empty if absent). */
export function parse_provenance_footer(text: string): Record<string, string> {
    if (!text.includes(PROVENANCE_START) || !text.includes(PROVENANCE_END)) {
        return {};
    }
    const block = _splitOnce(_splitOnce(text, PROVENANCE_START)[1], PROVENANCE_END)[0];
    const out: Record<string, string> = {};
    for (const line of _splitlines(block)) {
        const s = _strip(_lstripDash(_strip(line)));
        if (s.includes(':')) {
            const [key, , val] = _partition(s, ':');
            const k = _strip(key);
            if (_PROVENANCE_FIELDS.includes(k)) {
                out[k] = _strip(val);
            }
        }
    }
    return out;
}

/** Remove the provenance footer block from card text (for `purge`). */
export function strip_provenance_footer(text: string): string {
    if (!text.includes(PROVENANCE_START)) {
        return text;
    }
    const head = _splitOnce(text, PROVENANCE_START)[0];
    const tail = text.includes(PROVENANCE_END) ? _splitOnce(text, PROVENANCE_END)[1] : '';
    return _rstrip(head) + (_strip(tail) ? '\n' + _lstrip(tail) : '\n');
}

// ---------------------------------------------------------------------------
// CLI (used by the command surface + the linter; also handy for debugging)
// ---------------------------------------------------------------------------

const _DOC_FIRST_LINE =
    'File-first global knowledge-card layer — store path, config, origin-tier.';
const _PROG = 'knowledge_global';

export function main(argv: string[] | null = null): number {
    const args = argv ?? process.argv.slice(2);
    return _dispatch(args);
}

function _dispatch(argv: string[]): number {
    // argparse with subparsers (dest="cmd", not required).
    const positionals: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            _printMainHelp();
            process.exitCode = 0;
            return 0;
        }
        positionals.push(a);
    }

    const cmd = positionals[0];
    if (cmd === undefined) {
        _printMainHelp();
        return 1;
    }

    if (cmd === 'classify') {
        return _runClassify(positionals.slice(1));
    }
    if (cmd === 'store-path') {
        return _runStorePath(positionals.slice(1));
    }
    if (cmd === 'config') {
        return _runConfig(positionals.slice(1));
    }

    // Unknown subcommand → argparse error, exit code 2.
    _argparseError(
        `argument cmd: invalid choice: ${_pyRepr(cmd)} (choose from 'classify', 'store-path', 'config')`,
    );
    return 2;
}

function _runClassify(rest: string[]): number {
    const subPositionals: string[] = [];
    for (const a of rest) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(
                `usage: ${_PROG} classify [-h] source\n`,
            );
            process.exitCode = 0;
            return 0;
        }
        subPositionals.push(a);
    }
    if (subPositionals.length === 0) {
        _argparseError('the following arguments are required: source', `${_PROG} classify [-h] source`);
        return 2;
    }
    const source = subPositionals[0] as string;
    process.stdout.write(classify_tier(source) + '\n');
    return 0;
}

function _runStorePath(rest: string[]): number {
    for (const a of rest) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(`usage: ${_PROG} store-path [-h]\n`);
            process.exitCode = 0;
            return 0;
        }
    }
    process.stdout.write(global_store_dir() + '\n');
    return 0;
}

function _runConfig(rest: string[]): number {
    for (const a of rest) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(`usage: ${_PROG} config [-h]\n`);
            process.exitCode = 0;
            return 0;
        }
    }
    process.stdout.write(pyJsonDumps(load_global_sharing_config(), 2, true) + '\n');
    return 0;
}

function _printMainHelp(): void {
    // Mirror argparse's print_help() shape closely enough for usage lines;
    // the differential corpus does NOT byte-compare --help prose.
    process.stdout.write(
        `usage: ${_PROG} [-h] {classify,store-path,config} ...\n\n` +
            `${_DOC_FIRST_LINE}\n`,
    );
}

function _argparseError(message: string, usage = `${_PROG} [-h] {classify,store-path,config} ...`): void {
    process.stderr.write(`usage: ${usage}\n${_PROG}: error: ${message}\n`);
    process.exitCode = 2;
}

// ---------------------------------------------------------------------------
// helpers — Python string / dict / JSON compatibility
// ---------------------------------------------------------------------------

/** `isinstance(x, dict)` — a plain object, not array / null. */
function _is_plain_dict(value: SettingsValue): value is SettingsDict {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Python truthiness for the `bool(...)` cast in is_enabled. */
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
    if (_is_plain_dict(value)) {
        return Object.keys(value).length > 0;
    }
    return true;
}

/** Python `str.strip()`. */
function _strip(s: string): string {
    return _stripChars(s, /\s/);
}
function _lstrip(s: string): string {
    let i = 0;
    while (i < s.length && /\s/.test(s[i] as string)) {
        i += 1;
    }
    return s.slice(i);
}
function _rstrip(s: string): string {
    let j = s.length;
    while (j > 0 && /\s/.test(s[j - 1] as string)) {
        j -= 1;
    }
    return s.slice(0, j);
}
function _stripChars(s: string, re: RegExp): string {
    let i = 0;
    let j = s.length;
    while (i < j && re.test(s[i] as string)) {
        i += 1;
    }
    while (j > i && re.test(s[j - 1] as string)) {
        j -= 1;
    }
    return s.slice(i, j);
}

/** Python `s.lstrip("-")` — strip leading dashes. */
function _lstripDash(s: string): string {
    return s.replace(/^-+/, '');
}

/** Python `s.partition(sep)` → [before, sep, after] (after is '' if absent). */
function _partition(s: string, sep: string): [string, string, string] {
    const idx = s.indexOf(sep);
    if (idx < 0) {
        return [s, '', ''];
    }
    return [s.slice(0, idx), sep, s.slice(idx + sep.length)];
}

/** Python `s.split(sep, 1)` → [head, tail]; tail is '' when sep absent. */
function _splitOnce(s: string, sep: string): [string, string] {
    const idx = s.indexOf(sep);
    if (idx < 0) {
        return [s, ''];
    }
    return [s.slice(0, idx), s.slice(idx + sep.length)];
}

/** Mirror Python str.splitlines() for the provenance-block parse. */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const lines = text.split(/\r\n|\r|\n/);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
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

/**
 * `json.dumps(obj, indent=N, sort_keys=true)` byte-faithful: item separator
 * `,\n` + indent, key separator `": "`, `ensure_ascii=true` → non-ASCII
 * escaped. Integer-valued floats from DEFAULT_CONFIG are plain ints in
 * Python (`2`, `90`), so no PyFloat marker is needed here.
 */
export function pyJsonDumps(value: unknown, indent: number, sortKeys: boolean): string {
    return _escapeNonAscii(_dumpsIndent(value, indent, 0, sortKeys));
}

function _dumpsIndent(value: unknown, indent: number, depth: number, sortKeys: boolean): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? String(value) : value > 0 ? 'Infinity' : Number.isNaN(value) ? 'NaN' : '-Infinity';
    }
    if (typeof value === 'string') {
        return _jsonStr(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dumpsIndent(v, indent, depth + 1, sortKeys));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (_is_plain_dict(value)) {
        let keys = Object.keys(value);
        if (sortKeys) {
            keys = keys.sort();
        }
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map(
            (k) => `${pad}${_jsonStr(k)}: ${_dumpsIndent((value as SettingsDict)[k], indent, depth + 1, sortKeys)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStr(String(value));
}

function _jsonStr(s: string): string {
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
    // Mirror `raise SystemExit(main())`: the process exit code is main()'s
    // return value (help/error paths set process.exitCode AND return the code).
    process.exit(main());
}
