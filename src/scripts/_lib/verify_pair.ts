/**
 * The red-before-green pair for one command, as data — and whether its clause
 * can prove behavior at all.
 *
 * Pure: no fs, no spawn, no clock. Order comes from the array, exactly as in
 * `hasRedThenGreen`: the recorder appends, so index order is run order, and
 * `red_at` / `green_at` are indices into the records handed in.
 *
 * A green with no earlier red is `red: 'unseen'` — not a failure, a fact: the
 * check was never observed saying no, so its sensitivity is unknown.
 */
import { classifyRun } from './verification_evidence.js';

export interface VerifyPair {
    readonly cmd: string;
    readonly red: 'seen' | 'unseen';
    /** Index of the latest red before the green (or of the latest red, with no green). */
    readonly red_at: number | null;
    /** Index of the latest green, or `null` when nothing passed. */
    readonly green_at: number | null;
}

export type ClauseClass = 'wiring' | 'behavior';

const norm = (cmd: string): string => cmd.trim().replace(/\s+/g, ' ');

function commandOf(raw: unknown): string | null {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const c = (raw as Record<string, unknown>)['command'];
    return typeof c === 'string' ? norm(c) : null;
}

function field(raw: unknown, key: string): unknown {
    return (raw as Record<string, unknown>)[key];
}

/** The run said no: a parsed failure, or a non-zero exit that was not a kill. */
function isRed(raw: unknown): boolean {
    if (field(raw, 'interrupted') === true) return false;
    const verdict = classifyRun(raw);
    if (verdict.kind === 'FAIL_EVIDENCE') return true;
    const exit = field(raw, 'exit_code');
    return typeof exit === 'number' && exit !== 0 && exit < 128;
}

/** The run said yes: exit 0 that the classifier does not read as empty or unloaded. */
function isGreen(raw: unknown): boolean {
    if (field(raw, 'interrupted') === true || field(raw, 'exit_code') !== 0) return false;
    const verdict = classifyRun(raw);
    if (verdict.kind === 'FAIL_EVIDENCE') return false;
    return !(
        verdict.kind === 'INVALID_RUN'
        && (verdict.reason === 'zero_tests_discovered' || verdict.reason === 'fixture_or_load_failure')
    );
}

/** Build the pair for `cmd` from ordered run records; other commands' records are ignored. */
export function pairOf(cmd: string, records: readonly unknown[]): VerifyPair {
    const want = norm(cmd);
    let greenAt: number | null = null;
    for (let i = records.length - 1; i >= 0; i -= 1) {
        if (commandOf(records[i]) === want && isGreen(records[i])) {
            greenAt = i;
            break;
        }
    }
    const before = greenAt ?? records.length;
    let redAt: number | null = null;
    for (let i = before - 1; i >= 0; i -= 1) {
        if (commandOf(records[i]) === want && isRed(records[i])) {
            redAt = i;
            break;
        }
    }
    return { cmd, red: redAt === null ? 'unseen' : 'seen', red_at: redAt, green_at: greenAt };
}

/** Presence-only shapes: `ls`, `test -f/-e/-d/-s`, and `grep -c/-q/-l` over a route, menu, registry or manifest file. */
const LISTING_TARGET_RE = /route|menu|registry|manifest/i;

/** `wiring` when the clause can only prove that something exists, never that it works. */
export function classifyClause(cmd: string): ClauseClass {
    const tokens = norm(cmd).split(' ');
    const head = tokens[0] ?? '';
    if (head === 'ls') return 'wiring';
    if (head === 'test' && /^-[efds]$/.test(tokens[1] ?? '')) return 'wiring';
    if (head === 'grep') {
        const flags = tokens.filter((t) => /^-[A-Za-z]+$/.test(t)).join('');
        const target = tokens[tokens.length - 1] ?? '';
        if (/[cql]/.test(flags) && LISTING_TARGET_RE.test(target)) return 'wiring';
    }
    return 'behavior';
}
