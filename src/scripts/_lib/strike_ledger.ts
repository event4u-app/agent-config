/**
 * The strike ledger — the counter the fix-loop ladder never had.
 *
 * `execution.fix_loop_max` and its three bands live in prose; until this file
 * nothing counted an attempt. Red runs were recorded per TURN and cleared at the
 * next prompt, so "it still fails" after a turn or a compact restarted at zero
 * and band 2 ("repeating the approach is the same attempt again") was not
 * observable. The ledger reads the run the verification recorder already
 * captured — one capture, two readers — and keeps, per agent and target, how
 * many consecutive attempts ended on the same failure.
 *
 * SHADOW. Nothing here reaches the model; the ledger is read by tests until a
 * measured shadow window decides whether it may speak at a band boundary.
 *
 * PRIVACY BY SHAPE. An entry holds hashes, counts, a verdict word, a timestamp
 * and a host name. The recorder keeps 4 KiB output tails per run; a file that
 * outlives the session must not inherit them, so no field here can hold text
 * from a run. Agent ids and commands are PSEUDONYMISED by a truncated hash, not
 * anonymised: someone holding a candidate id can recompute its key.
 *
 * BOUNDED. Entries and per-agent edit counters both expire after the TTL, and
 * each map is capped (oldest dropped first), so the file the recorder parses
 * and rewrites on its hot path cannot grow with the number of subagents.
 */
import { createHash } from 'node:crypto';

import { classifyRun, type InvalidRunReason, type RunRecord } from './verification_evidence.js';

export const STRIKE_LEDGER_FILE = 'agents/state/strike-ledger.json';
/** Entries untouched for longer than this are dropped: a stale streak is not an attempt. */
export const STRIKE_TTL_DAYS = 7;

export type StrikeVerdict = 'NEW' | 'SAME' | 'FIXED' | 'FLAKY';

export interface StrikeEntry {
    /** Failure signature of the last red run, or null after a green one. */
    readonly sig: string | null;
    /**
     * Red runs on one signature: the first observed red is the baseline strike
     * (1), and each later red counts only when this agent edited before it.
     */
    readonly streak: number;
    readonly verdict: StrikeVerdict;
    /** This agent's edit counter when this target last ran. */
    readonly at_edit: number;
    /** The last run was green with no edit since the red before it. */
    readonly green_without_edit: boolean;
    readonly last_at: string;
    readonly platform: string;
    /** `agentKey` of the agent this entry counts for — ties it to its edit counter. */
    readonly agent: string;
}

/**
 * An attempt is an edit the attempting agent made, then a run. Edits are
 * counted per agent: a parallel subagent's edit in the shared tree may well
 * change this agent's result, but it is not this agent's attempt, and counting
 * it would raise a streak on a signature the agent never worked on.
 */
export interface EditCounter {
    readonly n: number;
    readonly last_at: string;
}

export interface StrikeLedger {
    readonly version: 1;
    /** Monotonic count of edit-tool calls per agent. Keys are agent hashes. */
    readonly edits: Readonly<Record<string, EditCounter>>;
    readonly entries: Readonly<Record<string, StrikeEntry>>;
}

/**
 * Size bounds. Entries: at most MAX_ENTRIES, oldest dropped first. Edit
 * counters: every agent that owns a surviving entry keeps its counter — an
 * entry's `at_edit` is a position on that counter, so evicting the counter
 * while the entry lives would restart it below the baseline and hide the next
 * attempts — plus at most MAX_IDLE_AGENTS counters with no entry. So the file
 * holds at most MAX_ENTRIES + MAX_IDLE_AGENTS counters.
 */
export const MAX_ENTRIES = 256;
export const MAX_IDLE_AGENTS = 64;

export function emptyLedger(): StrikeLedger {
    return { version: 1, edits: {}, entries: {} };
}

/** The ledger key for an agent — hashed, so no agent id is stored as text. */
export function agentKey(agent: string): string {
    return sha(`agent\n${agent}`);
}

function editsOf(ledger: StrikeLedger, agent: string): number {
    return ledger.edits[agentKey(agent)]?.n ?? 0;
}

/** Reasons that mean the run executed and failed, as opposed to an instrument gap. */
const RED_REASONS: ReadonlySet<InvalidRunReason> = new Set<InvalidRunReason>([
    'nonzero_exit_without_test_failure',
    'fixture_or_load_failure',
    'timeout_or_killed',
]);

/** `red`, `green`, or null when the run says nothing about the tree. */
export function runOutcome(run: RunRecord): 'red' | 'green' | null {
    const v = classifyRun(run);
    if (v.kind === 'PASS_EVIDENCE_OK') return 'green';
    if (v.kind === 'FAIL_EVIDENCE') return 'red';
    return RED_REASONS.has(v.reason) ? 'red' : null;
}

const FAILURE_LINE = /\b(fail(ed|ure|ing)?|error|assert\w*|panic|exception)\b|[×✗✖]/i;
const MAX_SIG_LINES = 20;

/**
 * One output line with everything that varies between two runs of the same
 * failure removed: durations, timestamps, hex addresses, temp paths, and
 * line/column positions (which drift whenever the file is edited above them).
 */
export function normaliseFailureLine(line: string): string {
    return line
        .replace(/\x1b\[[0-9;]*m/g, '')
        .replace(/\b\d{4}-\d{2}-\d{2}[T ][\d:.]+Z?\b/g, '<ts>')
        .replace(/\b\d{1,2}:\d{2}:\d{2}(\.\d+)?\b/g, '<ts>')
        .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
        .replace(/(\/(private\/)?(tmp|var\/folders)\/|[A-Za-z]:\\Temp\\)\S*/gi, '<tmp>')
        .replace(/\b\d+(\.\d+)?\s?(ms|s|sec|seconds|m|min)\b/gi, '<dur>')
        .replace(/([\w.-]+\.\w+)[:(]\d+([:,]\d+)?\)?/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * The failure signature: runner plus the normalised failure-bearing lines.
 *
 * Two runs share a signature when the same targets fail the same way; a
 * different failing test, a different error code, or a different failure count
 * gives a different one.
 */
export function failureSignature(run: RunRecord): string {
    const text = `${run.stdout_tail ?? ''}\n${run.stderr_tail ?? ''}`;
    const lines = [
        ...new Set(
            text
                .split('\n')
                .filter((l) => FAILURE_LINE.test(l))
                .map(normaliseFailureLine)
                .filter((l) => l.length > 0),
        ),
    ].slice(0, MAX_SIG_LINES);
    const basis = lines.length > 0 ? lines.join('\n') : `exit:${String(run.exit_code)}`;
    return sha(`${run.runner ?? ''}\n${basis}`);
}

/**
 * The target a run attempts: agent plus the command exactly as it ran. Never
 * the recorder's 512-char copy and never whitespace-normalised — two commands
 * that differ only past the cut or inside a quoted argument are two targets.
 */
export function targetKey(agent: string, command: string): string {
    return sha(`${agent}\n${command}`);
}

/** Count one edit-tool call by `agent`. */
export function recordEdit(ledger: StrikeLedger, agent: string, now: string): StrikeLedger {
    const k = agentKey(agent);
    const n = (ledger.edits[k]?.n ?? 0) + 1;
    return { ...ledger, edits: { ...ledger.edits, [k]: { n, last_at: now } } };
}

export interface ObserveContext {
    readonly agent: string;
    readonly now: string;
    readonly platform: string;
    /** The command as it ran, before any truncation; defaults to the record's. */
    readonly command?: string;
}

/**
 * Fold one recorded run into the ledger.
 *
 * Returns the ledger unchanged for a run that says nothing about the tree
 * (an instrument gap or a non-verifying command), so a gap never resets a streak.
 */
export function observeRun(
    ledger: StrikeLedger,
    run: RunRecord,
    ctx: ObserveContext,
): { ledger: StrikeLedger; verdict: StrikeVerdict | null } {
    const outcome = runOutcome(run);
    if (outcome === null) return { ledger, verdict: null };

    const key = targetKey(ctx.agent, ctx.command ?? run.command);
    const prev = ledger.entries[key];
    const myEdits = editsOf(ledger, ctx.agent);
    const edited = prev === undefined || myEdits > prev.at_edit;
    const base = { at_edit: myEdits, last_at: ctx.now, platform: ctx.platform, agent: agentKey(ctx.agent) };

    let next: StrikeEntry;
    if (outcome === 'green') {
        // Green with nothing changed since a red: the red may come back, so its
        // signature and streak stay and a returning red reads FLAKY.
        const keep = prev !== undefined && prev.sig !== null && !edited;
        next = keep
            ? { ...base, sig: prev.sig, streak: prev.streak, verdict: 'FIXED', green_without_edit: true }
            : { ...base, sig: null, streak: 0, verdict: 'FIXED', green_without_edit: false };
    } else {
        const sig = failureSignature(run);
        if (prev !== undefined && prev.green_without_edit && !edited && prev.sig === sig) {
            next = { ...base, sig, streak: prev.streak, verdict: 'FLAKY', green_without_edit: false };
        } else if (prev !== undefined && prev.sig === sig) {
            // A re-run with no edit between is not a new attempt.
            next = { ...base, sig, streak: edited ? prev.streak + 1 : prev.streak, verdict: 'SAME', green_without_edit: false };
        } else {
            next = { ...base, sig, streak: 1, verdict: 'NEW', green_without_edit: false };
        }
    }
    return {
        ledger: { ...ledger, entries: { ...ledger.entries, [key]: next } },
        verdict: next.verdict,
    };
}

/** The newest `max` of a map keyed by anything with a `last_at`, all within the TTL. */
function keepRecent<T extends { readonly last_at: string }>(
    map: Readonly<Record<string, T>>,
    cutoff: number,
    max: number,
): Record<string, T> {
    return Object.fromEntries(
        Object.entries(map)
            .map(([k, v]) => [k, v, Date.parse(v.last_at)] as const)
            .filter(([, , t]) => Number.isFinite(t) && t >= cutoff)
            .sort((a, b) => b[2] - a[2])
            .slice(0, max)
            .map(([k, v]) => [k, v]),
    );
}

/**
 * Drop entries untouched for longer than the TTL and cap them; then keep every
 * edit counter a surviving entry depends on, and at most MAX_IDLE_AGENTS of the
 * rest, within the TTL. Run BEFORE an event is folded in, so an expired streak
 * cannot be revived, and again on the completed ledger, so the bounds hold for
 * what is written.
 */
export function pruneLedger(ledger: StrikeLedger, now: string, ttlDays = STRIKE_TTL_DAYS): StrikeLedger {
    const cutoff = Date.parse(now) - ttlDays * 86_400_000;
    const entries = keepRecent(ledger.entries, cutoff, MAX_ENTRIES);
    const owners = new Set(Object.values(entries).map((e) => e.agent));
    const owned = Object.fromEntries(Object.entries(ledger.edits).filter(([k]) => owners.has(k)));
    const idle = keepRecent(
        Object.fromEntries(Object.entries(ledger.edits).filter(([k]) => !owners.has(k))),
        cutoff,
        MAX_IDLE_AGENTS,
    );
    return { ...ledger, edits: { ...owned, ...idle }, entries };
}

const HASH = /^[0-9a-f]{16}$/;
const VERDICTS: ReadonlySet<string> = new Set(['NEW', 'SAME', 'FIXED', 'FLAKY']);
export const PLATFORM = /^[a-z0-9_-]{1,32}$/i;
const validTime = (v: unknown): v is string =>
    typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v));
const count = (v: unknown): number | null =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;

/** One persisted entry rebuilt from its allowlisted fields, or null when any is invalid. */
function coerceEntry(raw: unknown): StrikeEntry | null {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    const sig = r['sig'];
    const streak = count(r['streak']);
    const atEdit = count(r['at_edit']);
    const verdict = r['verdict'];
    const lastAt = r['last_at'];
    const platform = r['platform'];
    if (!(sig === null || (typeof sig === 'string' && HASH.test(sig)))) return null;
    if (streak === null || atEdit === null) return null;
    if (typeof verdict !== 'string' || !VERDICTS.has(verdict)) return null;
    if (typeof r['green_without_edit'] !== 'boolean') return null;
    if (!validTime(lastAt)) return null;
    if (typeof platform !== 'string' || !PLATFORM.test(platform)) return null;
    const agent = r['agent'];
    if (typeof agent !== 'string' || !HASH.test(agent)) return null;
    return {
        agent,
        sig,
        streak,
        verdict: verdict as StrikeVerdict,
        at_edit: atEdit,
        green_without_edit: r['green_without_edit'] as boolean,
        last_at: lastAt,
        platform,
    };
}

/**
 * Read whatever is on disk into a ledger. Every entry is REBUILT from its
 * allowlisted fields and an invalid one is dropped, so a file that gained text
 * by any route — corruption, a hand edit, a future bug — cannot carry it
 * forward through the next write.
 */
export function coerceLedger(raw: unknown): StrikeLedger {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return emptyLedger();
    const r = raw as Record<string, unknown>;
    const edits: Record<string, EditCounter> = {};
    const rawEdits = r['edits'];
    if (typeof rawEdits === 'object' && rawEdits !== null && !Array.isArray(rawEdits)) {
        for (const [k, v] of Object.entries(rawEdits)) {
            if (!HASH.test(k) || typeof v !== 'object' || v === null || Array.isArray(v)) continue;
            const n = count((v as Record<string, unknown>)['n']);
            const at = (v as Record<string, unknown>)['last_at'];
            if (n !== null && validTime(at)) edits[k] = { n, last_at: at };
        }
    }
    const entries: Record<string, StrikeEntry> = {};
    const rawEntries = r['entries'];
    if (typeof rawEntries === 'object' && rawEntries !== null && !Array.isArray(rawEntries)) {
        for (const [k, v] of Object.entries(rawEntries)) {
            const e = coerceEntry(v);
            if (HASH.test(k) && e !== null) entries[k] = e;
        }
    }
    return { version: 1, edits, entries };
}

function sha(text: string): string {
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
}
