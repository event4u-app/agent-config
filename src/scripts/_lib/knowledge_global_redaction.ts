#!/usr/bin/env tsx
/**
 * Write-time redaction + tier gate for global knowledge-card sharing.
 *
 * TypeScript twin of `src/scripts/_lib/knowledge_global_redaction.py`
 * (ADR-200). Security-sensitive: the redaction patterns + replacements and
 * the tier gate are matched byte-for-byte against the Python original. The
 * public API and CLI contract mirror Python exactly — same exported
 * snake_case names, same `GateResult` shape + `summary()` text, same exit
 * codes and stdout. No behaviour changes.
 *
 * Structure-grounding v2, Phase 1 — the privacy crux (ADR-100 /
 * road-to-structure-grounding-v2). Before any project-local card may cross a
 * project boundary into the file-first global store, it passes this gate:
 *
 *   1. **Tier gate.** `public` / `vendor` are auto-eligible under default-on;
 *      `proprietary` (in-house DB / private API / client schemas) is
 *      **manual-only regardless of `enabled`** — the gate hard-codes it, so no
 *      client-A schema ever auto-leaks into client-B's session. A per-project
 *      `share-blocklist` opts individual sources out.
 *   2. **Redaction.** Runs the `low-impact-corpus-privacy-floor` pattern set
 *      (secrets, emails, project paths, internal hostnames, money, blocklisted
 *      field/table identifiers, long code) **plus** the `source-confidentiality`
 *      external-source denylist. On any hit it **halts and surfaces** — never
 *      silent-shares, never auto-rewrites (a soft rewrite would be a soft gate).
 *
 * The gate is a deterministic backstop the agent-in-the-loop promotion flow calls
 * before writing a global card; the Phase-4 linter re-runs the redaction scan on
 * committed global cards as the CI net.
 *
 * Pure, read-only. Exit codes (CLI): 0 = eligible/clean, 1 = blocked, 3 = error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
    redact_low_impact_entry,
} from '../ai_council/redact_low_impact_entry.js';
import type { RedactionViolation } from '../ai_council/redact_low_impact_entry.js';

const _ROOT = path.resolve(path.dirname(_thisFile()), '..', '..');
const _DENYLIST_PATH = path.join(_ROOT, 'scripts', 'external_sources_denylist.json');
// Per-project opt-out list — one source/card-name per line, `#` comments.
export const SHARE_BLOCKLIST_REL = path.join('agents', 'knowledge', '.share-blocklist');

/** Resolve this module's own file path (mirrors `Path(__file__)`). */
function _thisFile(): string {
    // import.meta.url → /…/src/scripts/_lib/knowledge_global_redaction.ts
    const url = new URL(import.meta.url);
    return decodeURIComponent(process.platform === 'win32' ? url.pathname.replace(/^\//, '') : url.pathname);
}

/** Outcome of the global-share gate for one card. */
export class GateResult {
    readonly eligible: boolean;
    readonly reason: string;
    readonly tier: string;
    readonly manual_only: boolean;
    readonly violations: readonly RedactionViolation[];

    constructor(
        eligible: boolean,
        reason: string,
        options: {
            tier?: string;
            manual_only?: boolean;
            violations?: readonly RedactionViolation[];
        } = {},
    ) {
        this.eligible = eligible;
        this.reason = reason;
        this.tier = options.tier ?? '';
        this.manual_only = options.manual_only ?? false;
        this.violations = options.violations ?? [];
    }

    summary(): string {
        const head = this.eligible ? 'eligible' : 'BLOCKED';
        const parts = this.violations.map((v) => `${v.category}: ${_pyRepr(v.snippet)}`);
        const tail = parts.length > 0 ? ' — ' + parts.join('; ') : '';
        return `global-share ${head} (tier=${this.tier || '?'}): ${this.reason}${tail}`;
    }
}

// ---------------------------------------------------------------------------
// Redaction scan (privacy floor + source-confidentiality)
// ---------------------------------------------------------------------------

/** External-source denylist regexes (source-confidentiality). Tolerant. */
function _load_denylist_patterns(): RegExp[] {
    let cfg: unknown;
    try {
        cfg = JSON.parse(fs.readFileSync(_DENYLIST_PATH, 'utf-8'));
    } catch {
        // missing denylist or invalid JSON
        return [];
    }
    const out: RegExp[] = [];
    const deny = _isPlainObject(cfg) ? cfg['deny'] : null;
    for (const raw of Array.isArray(deny) ? deny : []) {
        if (typeof raw !== 'string') {
            continue;
        }
        try {
            out.push(_compileIgnoreCase(raw));
        } catch {
            continue;
        }
    }
    return out;
}

/** Compile a Python `re` pattern as a JS RegExp with IGNORECASE + Unicode. */
function _compileIgnoreCase(pattern: string): RegExp {
    // Python `re.compile(raw, re.IGNORECASE)`; `\b` in the denylist patterns
    // is ASCII-word-boundary in Python's `re` for ASCII tokens — JS `\b` under
    // no `u` flag matches the same ASCII semantics. The denylist tokens are
    // ASCII source names, so a plain `i` flag is byte-faithful for `.search`.
    return new RegExp(pattern, 'i');
}

/**
 * Combined privacy-floor + source-confidentiality scan over `text`.
 *
 * Returns the list of violations (empty = clean). Reused by the Phase-4
 * linter as the CI net that redaction actually fired on committed cards.
 */
export function redaction_scan(
    text: string,
    options: {
        repo_root?: string | null;
        private_domains?: readonly string[];
        customer_names?: readonly string[];
        sql_identifiers?: readonly string[];
    } = {},
): RedactionViolation[] {
    const floor = redact_low_impact_entry(text, {
        repoRoot: options.repo_root ?? null,
        privateDomains: options.private_domains ?? [],
        customerNames: options.customer_names ?? [],
        sqlIdentifiers: options.sql_identifiers ?? [],
    });
    const violations: RedactionViolation[] = [...floor.violations];
    for (const rx of _load_denylist_patterns()) {
        rx.lastIndex = 0;
        const m = rx.exec(text);
        if (m) {
            violations.push({
                category: 'external_source',
                snippet: _pySliceHead(m[0], 40),
                note: 'source-confidentiality denylist',
            });
        }
    }
    return violations;
}

// ---------------------------------------------------------------------------
// Share-blocklist
// ---------------------------------------------------------------------------

/** Per-project opt-out: sources/card-names that must never go global. */
export function load_share_blocklist(project_root: string): Set<string> {
    const p = path.join(project_root, SHARE_BLOCKLIST_REL);
    let lines: string[];
    try {
        lines = _splitlines(fs.readFileSync(p, 'utf-8'));
    } catch {
        return new Set<string>();
    }
    const out = new Set<string>();
    for (const line of lines) {
        const s = _strip(line);
        if (s && !s.startsWith('#')) {
            out.add(s);
        }
    }
    return out;
}

function _is_blocklisted(source: string, card_name: string, blocklist: Set<string>): boolean {
    if (blocklist.size === 0) {
        return false;
    }
    if (blocklist.has(source) || blocklist.has(card_name)) {
        return true;
    }
    for (const b of blocklist) {
        if (b && (source.includes(b) || b === card_name)) {
            return true;
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/**
 * Decide whether a card may cross a project boundary into the global store.
 *
 * Order: blocklist → tier gate (proprietary is always manual-only) →
 * redaction (halt-and-surface on any hit). Auto-eligibility is the default-on
 * path; proprietary returns `manual_only=true` so a deliberate manual
 * promotion can still proceed past the auto gate with explicit operator intent.
 */
export function gate_card_for_global(
    text: string,
    options: {
        tier: string;
        source?: string;
        card_name?: string;
        allowed_tiers?: readonly string[];
        redaction_enabled?: boolean;
        halt_on_trigger?: boolean;
        blocklist?: Set<string> | null;
        repo_root?: string | null;
        private_domains?: readonly string[];
        customer_names?: readonly string[];
        sql_identifiers?: readonly string[];
    },
): GateResult {
    const tier = options.tier;
    const source = options.source ?? '';
    const card_name = options.card_name ?? '';
    const allowed = options.allowed_tiers ?? ['public', 'vendor'];
    const redaction_enabled = options.redaction_enabled ?? true;
    const halt_on_trigger = options.halt_on_trigger ?? true;
    const blocklist = options.blocklist ?? new Set<string>();

    if (_is_blocklisted(source, card_name, blocklist)) {
        return new GateResult(false, 'source opted out via share-blocklist', { tier });
    }

    if (tier === 'proprietary') {
        return new GateResult(
            false,
            'proprietary tier — manual-only, never auto-shared (default-off regardless of enabled)',
            { tier, manual_only: true },
        );
    }
    if (!allowed.includes(tier)) {
        return new GateResult(
            false,
            `tier '${tier}' not in allowed_tiers ${_pyReprList(_sorted(allowed))}`,
            { tier },
        );
    }

    if (redaction_enabled) {
        const violations = redaction_scan(text, {
            repo_root: options.repo_root ?? null,
            private_domains: options.private_domains ?? [],
            customer_names: options.customer_names ?? [],
            sql_identifiers: options.sql_identifiers ?? [],
        });
        if (violations.length > 0 && halt_on_trigger) {
            return new GateResult(
                false,
                'redaction halt — confidential pattern(s) found; rephrase or redact before sharing',
                { tier, violations },
            );
        }
    }

    return new GateResult(true, 'passed tier gate + redaction', { tier });
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const _PROG = 'knowledge_global_redaction';

export function main(argv: string[] | null = null): number {
    const args = argv ?? process.argv.slice(2);
    return _dispatch(args);
}

function _dispatch(argv: string[]): number {
    let card: string | null = null;
    let tier: string | null = null;
    let source = '';
    const usage = `${_PROG} [-h] --tier {public,vendor,proprietary} [--source SOURCE] card`;

    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(`usage: ${usage}\n`);
            process.exitCode = 0;
            return 0;
        } else if (a === '--tier') {
            tier = _checkChoice(argv[++i], ['public', 'vendor', 'proprietary'], '--tier', usage);
        } else if (a.startsWith('--tier=')) {
            tier = _checkChoice(a.slice('--tier='.length), ['public', 'vendor', 'proprietary'], '--tier', usage);
        } else if (a === '--source') {
            source = (argv[++i] ?? '') as string;
        } else if (a.startsWith('--source=')) {
            source = a.slice('--source='.length);
        } else if (a.startsWith('-')) {
            _argparseError(`unrecognized arguments: ${a}`, usage);
            return 2;
        } else if (card === null) {
            card = a;
        } else {
            _argparseError(`unrecognized arguments: ${a}`, usage);
            return 2;
        }
    }

    if (card === null) {
        _argparseError('the following arguments are required: card', usage);
        return 2;
    }
    if (tier === null) {
        _argparseError('the following arguments are required: --tier', usage);
        return 2;
    }

    let text: string;
    try {
        text = fs.readFileSync(card, 'utf-8');
    } catch (exc) {
        process.stderr.write(`cannot read ${card}: ${_osErrorStr(exc, card)}\n`);
        process.exitCode = 3;
        return 3;
    }

    const result = gate_card_for_global(text, {
        tier,
        source,
        card_name: path.basename(card),
    });
    process.stdout.write(result.summary() + '\n');
    const code = result.eligible ? 0 : 1;
    process.exitCode = code;
    return code;
}

function _checkChoice(value: string | undefined, choices: string[], flag: string, usage: string): string {
    if (value === undefined || !choices.includes(value)) {
        _argparseError(
            `argument ${flag}: invalid choice: ${_pyRepr(value ?? '')} (choose from ${choices.map((c) => _pyRepr(c)).join(', ')})`,
            usage,
        );
        // _argparseError sets exitCode 2; argparse aborts immediately.
        process.exit(process.exitCode ?? 2);
    }
    return value;
}

function _argparseError(message: string, usage: string): void {
    process.stderr.write(`usage: ${usage}\n${_PROG}: error: ${message}\n`);
    process.exitCode = 2;
}

/** Mirror Python `OSError`'s `str(exc)` for the read-failure message. */
function _osErrorStr(exc: unknown, p: string): string {
    if (exc && typeof exc === 'object' && 'code' in exc) {
        const e = exc as NodeJS.ErrnoException;
        // Approximate Python's `[Errno N] strerror: 'path'` shape. The exact
        // strerror differs per platform; the differential corpus avoids the
        // read-error path or normalizes it inline.
        return String(e.message ?? e.code ?? exc);
    }
    void p;
    return String(exc);
}

// ---------------------------------------------------------------------------
// helpers — Python compatibility
// ---------------------------------------------------------------------------

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Slice the first `n` code points (Python `s[:n]`). */
function _pySliceHead(s: string, n: number): string {
    let out = '';
    let i = 0;
    for (const ch of s) {
        if (i >= n) {
            break;
        }
        out += ch;
        i += 1;
    }
    return out;
}

function _strip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

/** Mirror Python str.splitlines(). */
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

/** Python `sorted(list)` for string tiers. */
function _sorted(xs: readonly string[]): string[] {
    return [...xs].sort();
}

/** Mirror `repr(list_of_str)` → `['a', 'b']`. */
function _pyReprList(xs: readonly string[]): string {
    return `[${xs.map((x) => _pyRepr(x)).join(', ')}]`;
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

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    // Mirror `raise SystemExit(main())`.
    process.exit(main());
}
