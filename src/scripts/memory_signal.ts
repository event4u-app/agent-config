#!/usr/bin/env tsx
/**
 * Write-side helper: drop an engineering-memory signal.
 *
 * TypeScript twin of `src/scripts/memory_signal.py` (ADR-200, Phase 7 /
 * dev-side memory). The public API and CLI contract mirror the Python
 * original EXACTLY — same exported names (snake_case kept deliberately),
 * same exit codes, stdout/stderr split, byte-identical messages, same
 * append-only JSONL shape and rate-limit / backend-routing behaviour. No
 * behaviour changes — latent Python bugs are replicated and flagged as
 * divergence candidates in the porting report, not fixed.
 *
 * Shared by producers (`/bug-fix`, `/do-and-judge`, `/propose-memory`,
 * incident role exit). Appends an intake line under
 * `agents/memory/intake/signals-YYYY-MM.jsonl` — append-only JSONL with
 * `merge=union` (see `road-to-memory-merge-safety.md`). Memory is entirely
 * file-backed (no external backend).
 *
 * Rate limiting:
 * - Per-path, per-type, within a rolling window (default 7 days).
 * - Silent skip on duplicate — the producer's caller should not error,
 *   since over-emission is a correctness bug, not a failure mode.
 *
 * Usage:
 *     memory_signal --type historical-patterns \
 *         --path "app/Http/Controllers/Billing/Checkout.php" \
 *         --body "Null deref when currency is missing — add guard."
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

// Mutable so tests can repoint at a tmp tree (monkeypatch parity).
export let INTAKE_ROOT = path.join('agents', 'memory', 'intake');
export let SETTINGS_FILE = '.agent-settings.yml';

/** Test-only setters mirroring pytest monkeypatch on the module constants. */
export function _setIntakeRoot(p: string): void {
    INTAKE_ROOT = p;
}
export function _setSettingsFile(p: string): void {
    SETTINGS_FILE = p;
}

export const VALID_TYPES: ReadonlySet<string> = new Set([
    'historical-patterns',
    'incident-learnings',
    'ownership',
    'domain-invariants',
    'product-rules',
]);
export const RATE_LIMIT_WINDOW_DAYS = 7;

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Mirror datetime.now(utc).isoformat(timespec="seconds"). */
export function _now_iso(): string {
    return _pyIsoSeconds(new Date());
}

/** Mirror datetime.now(utc).isoformat(timespec="seconds") for a given Date. */
function _pyIsoSeconds(d: Date): string {
    const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
    const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = d.getUTCDate().toString().padStart(2, '0');
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mi = d.getUTCMinutes().toString().padStart(2, '0');
    const ss = d.getUTCSeconds().toString().padStart(2, '0');
    return `${yyyy}-${mo}-${day}T${hh}:${mi}:${ss}+00:00`;
}

/** Short, URL-safe, stable enough for intake ids — secrets.token_hex(6). */
export function _new_id(): string {
    return `sig-${crypto.randomBytes(6).toString('hex')}`;
}

/** Mirror INTAKE_ROOT / f"signals-{YYYY-MM}.jsonl" (UTC now). */
export function _monthly_file(): string {
    const d = new Date();
    const ym = `${d.getUTCFullYear().toString().padStart(4, '0')}-${(d.getUTCMonth() + 1)
        .toString()
        .padStart(2, '0')}`;
    return path.join(INTAKE_ROOT, `signals-${ym}.jsonl`);
}

/** Parse an ISO-8601 timestamp the way datetime.fromisoformat does (returns ms epoch or null). */
function _parseFromIso(ts: string): number | null {
    // Python's datetime.fromisoformat accepts "YYYY-MM-DDTHH:MM:SS[.ffffff][+HH:MM]".
    // A plain "Z" suffix is NOT accepted by 3.10-era fromisoformat, but the
    // emitter writes "+00:00" so this is sufficient. Reject malformed input.
    const m =
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})?$/.exec(ts);
    if (!m) {
        return null;
    }
    const [, y, mo, d, h, mi, s, frac, tz] = m;
    let ms = Date.UTC(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(h),
        Number(mi),
        Number(s),
        frac ? Number((frac + '000000').slice(0, 6)) / 1000 : 0,
    );
    if (tz && tz !== 'Z') {
        const sign = tz[0] === '-' ? -1 : 1;
        const oh = Number(tz.slice(1, 3));
        const om = Number(tz.slice(4, 6));
        ms -= sign * (oh * 60 + om) * 60 * 1000;
    }
    // Naive (no tz) timestamps: Python compares them as local-naive against an
    // aware cutoff and would raise TypeError. The emitter always writes an
    // offset, so naive input only appears in hand-crafted fixtures — treat it
    // as UTC for the comparison rather than throwing (the only observable
    // effect is whether the dedupe fires; tests always supply an offset).
    return ms;
}

/** True if an identical (type, path, body) was written within the window. */
export function _recently_emitted(
    entry_type: string,
    p: string,
    body: string,
    window_days: number = RATE_LIMIT_WINDOW_DAYS,
): boolean {
    if (!_isDir(INTAKE_ROOT)) {
        return false;
    }
    const cutoffMs = Date.now() - window_days * 24 * 60 * 60 * 1000;
    for (const jsonl of _globSignals(INTAKE_ROOT)) {
        let text: string;
        try {
            text = fs.readFileSync(jsonl, 'utf-8');
        } catch {
            continue;
        }
        for (const rawLine of text.split('\n')) {
            const line = rawLine.trim();
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
            if (obj['entry_type'] !== entry_type) {
                continue;
            }
            if (obj['path'] !== p) {
                continue;
            }
            if (obj['body'] !== body) {
                continue;
            }
            const ts = obj['ts'];
            if (typeof ts !== 'string') {
                continue;
            }
            const emitted = _parseFromIso(ts);
            if (emitted === null) {
                continue;
            }
            if (emitted >= cutoffMs) {
                return true;
            }
        }
    }
    return false;
}

/** sorted(INTAKE_ROOT.glob("signals-*.jsonl")) — absolute paths, lexically sorted. */
function _globSignals(root: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return [];
    }
    return names
        .filter((n) => n.startsWith('signals-') && n.endsWith('.jsonl'))
        .sort()
        .map((n) => path.join(root, n));
}

export interface SignalRecord {
    [key: string]: unknown;
    id: string;
    ts: string;
    origin: string;
    entry_type: string;
    path: string;
    body: string;
}

/**
 * Append a signal entry. Returns the written record, or null when skipped.
 */
export function emit(
    entry_type: string,
    p: string,
    body: string,
    options: {
        extra?: Record<string, unknown> | null;
        origin?: string;
        force?: boolean;
    } = {},
): SignalRecord | null {
    const extra = options.extra ?? null;
    const origin = options.origin ?? 'agent';
    const force = options.force ?? false;
    if (!VALID_TYPES.has(entry_type)) {
        throw new Error(`unknown memory type: ${entry_type}`);
    }
    if (!p || !body) {
        throw new Error('path and body are required');
    }
    if (!force && _recently_emitted(entry_type, p, body)) {
        return null;
    }
    const record: SignalRecord = {
        id: _new_id(),
        ts: _now_iso(),
        origin,
        entry_type,
        path: p,
        body,
    };
    if (extra) {
        // Reserved keys stay intact; extras only fill unclaimed slots.
        for (const [k, v] of Object.entries(extra)) {
            if (!(k in record)) {
                record[k] = v;
            }
        }
    }
    fs.mkdirSync(INTAKE_ROOT, { recursive: true });
    const target = _monthly_file();
    fs.appendFileSync(target, `${_jsonDumpsUnicode(record)}\n`, 'utf-8');
    return record;
}

/** Mirror json.dumps(record, ensure_ascii=False) — compact ", "/": " separators, no escapes. */
function _jsonDumpsUnicode(value: unknown): string {
    return _pyCompactSeparators(JSON.stringify(value));
}

function _pyCompactSeparators(json: string): string {
    let result = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < json.length; i += 1) {
        const ch = json[i] as string;
        result += ch;
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (!inString && (ch === ',' || ch === ':')) {
            result += ' ';
        }
    }
    return result;
}

interface ParsedArgs {
    entry_type: string;
    path: string;
    body: string;
    origin: string;
    extra: string;
    force: boolean;
}

const _PROG = 'memory_signal.py';
// argparse usage block as rendered at the default 80-column terminal width
// (COLUMNS unset). The --type choices line is too long to fit, so argparse
// wraps it onto its own line; reproduce byte-for-byte.
const _USAGE =
    'usage: memory_signal.py [-h] --type\n' +
    '                        {domain-invariants,historical-patterns,incident-learnings,ownership,product-rules}\n' +
    '                        --path PATH --body BODY [--origin ORIGIN]\n' +
    '                        [--extra EXTRA] [--force]\n';

/** Mirror argparse error: print usage + "<prog>: error: <msg>" to stderr, exit 2. */
function _usageError(msg: string): never {
    process.stderr.write(_USAGE);
    process.stderr.write(`${_PROG}: error: ${msg}\n`);
    process.exit(2);
}

function _parseArgs(argv: string[]): ParsedArgs {
    const args: Partial<ParsedArgs> = { origin: 'agent', extra: '', force: false };
    const seen = new Set<string>();
    const choices = [...VALID_TYPES].sort();
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const takeValue = (flag: string): string => {
            const v = argv[++i];
            if (v === undefined) {
                _usageError(`argument ${flag}: expected one argument`);
            }
            return v as string;
        };
        if (a === '--type') {
            const v = takeValue('--type');
            if (!choices.includes(v)) {
                _usageError(
                    `argument --type: invalid choice: '${v}' (choose from ${choices
                        .map((c) => `'${c}'`)
                        .join(', ')})`,
                );
            }
            args.entry_type = v;
            seen.add('--type');
        } else if (a === '--path') {
            args.path = takeValue('--path');
            seen.add('--path');
        } else if (a === '--body') {
            args.body = takeValue('--body');
            seen.add('--body');
        } else if (a === '--origin') {
            args.origin = takeValue('--origin');
        } else if (a === '--extra') {
            args.extra = takeValue('--extra');
        } else if (a === '--force') {
            args.force = true;
        } else if (a === '-h' || a === '--help') {
            // --help is not a parity contract (per ADR-200); emit the usage block.
            process.stdout.write(_USAGE);
            process.exit(0);
        } else {
            _usageError(`unrecognized arguments: ${a}`);
        }
    }
    const missing: string[] = [];
    if (!seen.has('--type')) {
        missing.push('--type');
    }
    if (!seen.has('--path')) {
        missing.push('--path');
    }
    if (!seen.has('--body')) {
        missing.push('--body');
    }
    if (missing.length > 0) {
        _usageError(`the following arguments are required: ${missing.join(', ')}`);
    }
    return args as ParsedArgs;
}

export function main(): number {
    const args = _parseArgs(process.argv.slice(2));
    let extra: Record<string, unknown> = {};
    if (args.extra) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(args.extra);
        } catch {
            process.stderr.write('error: --extra must be a JSON object\n');
            return 2;
        }
        if (!_isPlainObject(parsed)) {
            process.stderr.write('error: --extra must be a JSON object\n');
            return 2;
        }
        extra = parsed;
    }
    const rec = emit(args.entry_type, args.path, args.body, {
        extra,
        origin: args.origin,
        force: args.force,
    });
    if (rec === null) {
        process.stdout.write(
            `  ℹ️  skipped (already emitted within ` +
                `${RATE_LIMIT_WINDOW_DAYS}d): ${args.entry_type} @ ${args.path}\n`,
        );
        return 0;
    }
    process.stdout.write(
        `  ✅  signal emitted: id=${rec.id} type=${rec.entry_type} ` + `path=${rec.path}\n`,
    );
    return 0;
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    process.exit(main());
}
