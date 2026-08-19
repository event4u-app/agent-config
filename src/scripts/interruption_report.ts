/**
 * interruption_report — road-to-user-out-of-the-loop Phase 0 Step 2.
 *
 * Reports the two axes the roadmap's Goal names and pre-registers as separate
 * claims, because a run can ask zero questions and still be slow:
 *
 *   CONTACT AXIS   asks per run, hand-backs per run, halts per run, and the
 *                  median user wait between an agent turn and the user's reply.
 *   WALL-CLOCK AXIS total elapsed per run versus agent working time — elapsed
 *                  minus the time the run spent waiting on a human.
 *
 * ── WHAT THIS REPORT REFUSES TO DO ────────────────────────────────────────
 *
 * The step specifies a 30-session window "matching the conformance window".
 * Measured on this tree the day it was written, the rolling history held
 * **5 sessions, all from one day** — the file is a rolling buffer, not an
 * archive, so 30 is a request rather than a guarantee.
 *
 * So the window is a REQUEST and `sessions_found` is reported next to it, with
 * an explicit `window_short` flag when fewer sessions exist than were asked
 * for. A baseline computed over 5 sessions and labelled "30" is exactly the
 * measurement-artifact-as-decision-input failure this repository has already
 * recorded once (`skill-usage-report.md` publishing "Active: 0"). A short
 * window is a real finding about retention; hiding it would make the number
 * look authoritative and the retention problem invisible.
 *
 * ── THE JOIN ──────────────────────────────────────────────────────────────
 *
 * Contacts come from `agents/runtime/state/interruptions.jsonl` (the Phase 0
 * Step 1 concern). Timestamps come from `agents/runtime/.agent-chat-history`.
 * They join on the session tag: the ledger writes `run_id` using
 * `derive_session_tag`, the same derivation that file writes as `s`.
 *
 * A run present in one source and not the other is reported, never silently
 * dropped — a ledger entry with no timestamps yields contact counts and a null
 * wall clock, and history with no ledger entry yields timing and a null contact
 * count. Dropping either would bias the medians in a direction nobody could see.
 *
 * ── SYNTHETIC USER TURNS ──────────────────────────────────────────────────
 *
 * The harness writes task notifications and system reminders into the USER
 * role. Counting those as "the user replied" would collapse every measured wait
 * to near zero and make the contact axis read as free. They are excluded by
 * marker, and the count of what was excluded is reported so the exclusion is
 * auditable rather than a silent filter.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SESSION_ID_LEN, derive_session_tag } from './chat_history.js';

export const DEFAULT_WINDOW = 30;

export interface LedgerRow {
    run_id: string;
    turn: number;
    kind: string;
    class: string;
    roadmap: string | null;
    at: string;
}

export interface HistoryTurn {
    session: string;
    role: 'user' | 'agent';
    ts: string;
    synthetic: boolean;
}

export interface RunReport {
    run_id: string;
    roadmap: string | null;
    /**
     * Contact counts, or `null` when this run has NO interruption-ledger
     * entry — a session predating the ledger, or one whose stop hook never
     * fired.
     *
     * R2 round 6, finding 8. These were built unconditionally from the ledger
     * rows, so an absent run emitted `asks: 0, contacts: 0, halts: 0` — while
     * this report's own note tells the reader such a run is "reported with the
     * missing axis null". The aggregate median already excluded them; the ROWS
     * did not, and a reader consuming rows would score an unmeasured run as
     * zero contacts. That is precisely the arithmetic falsification criterion
     * (3) of the pre-registered `user-out-of-loop-baseline` claim forbids —
     * "scoring an unmeasured run as zero contacts is the arithmetic that would
     * manufacture the result".
     */
    asks: number | null;
    handbacks: number | null;
    contacts: number | null;
    halts: number | null;
    elapsed_minutes: number | null;
    waiting_minutes: number | null;
    working_minutes: number | null;
    /** `engage` events for this run in `run-continuation.jsonl`. */
    reengagements: number;
    /** `halt-stall` events — the anti-stall rung firing, not the loop working. */
    stall_halts: number;
    /** Relaunches the supervisor has spent on this run. */
    relaunches: number;
    /** Decision memos this run wrote instead of contacting the user. */
    memos: number;
}

export interface Report {
    window_requested: number;
    sessions_found: number;
    window_short: boolean;
    synthetic_user_turns_excluded: number;
    runs: RunReport[];
    median_contacts_per_run: number | null;
    median_user_wait_minutes: number | null;
    median_elapsed_minutes: number | null;
    median_working_minutes: number | null;
    /** Phase 5.0 — the autonomy axis. */
    median_reengagements_per_run: number | null;
    /** Share of runs whose loop hit the stall rung. `null` with no runs. */
    stall_halt_rate: number | null;
    median_relaunches_per_run: number | null;
    median_memos_per_run: number | null;
    notes: string[];
}

/**
 * A user-role entry the harness produced, not the human. Matched on the markers
 * the harness actually emits; anything else counts as a real reply.
 */
const SYNTHETIC_MARKERS = [
    '<task-notification>',
    '<system-reminder>',
    '<local-command-caveat>',
    '<command-name>',
];

export function isSyntheticUserText(text: string): boolean {
    return SYNTHETIC_MARKERS.some((m) => text.includes(m));
}

/**
 * Look one run's value up in a source keyed differently from the ledger.
 *
 * R2 review, finding 2. Three producers write three key spaces for the same
 * run and the report joined them with exact lookups, so `reengagements`,
 * `stall_halts`, `stall_halt_rate` and `relaunches` read 0 / 0 % for every
 * real run while the data sat on disk:
 *
 *   - the interruption ledger  `derive_session_tag(id)`  = 16 hex
 *   - run-continuation.jsonl   `deriveSessionKey(id)`    = 32 hex
 *   - supervise-relaunches     the RAW `session_id`
 *
 * A zero meaning "no instrument" and a zero meaning "the key did not match"
 * are indistinguishable in the output, and this report prints an explicit
 * NO INSTRUMENT for two other axes precisely to avoid the first — so a silent
 * second kind was the worse failure.
 *
 * Resolution is EXACT-FIRST and lives here rather than in the readers: a
 * reader that rewrote its own keys would have to guess what an unrecognised
 * string means, and guessing "hash it" turns a would-have-matched key into a
 * guaranteed miss. The readers keep reporting what is on disk; the join owns
 * the reconciliation, because only the join knows the ledger id it is
 * looking for.
 *
 * The 32-hex key is a prefix-extension of the 16-hex tag ONLY because a
 * session id carries no whitespace for `fingerprint` to normalise away.
 * `interruption_report.test.ts` pins that equivalence rather than assuming it.
 */
export function lookupByRunId<T>(
    source: ReadonlyMap<string, T> | Readonly<Record<string, T>>,
    runId: string,
): T | undefined {
    const get = (k: string): T | undefined =>
        source instanceof Map ? source.get(k) : (source as Record<string, T>)[k];
    // 1. The key as the ledger spells it. Covers a source that already agrees,
    //    and every fixture that writes one id everywhere.
    const exact = get(runId);
    if (exact !== undefined) return exact;
    // 2. A 32-hex continuation key whose first SESSION_ID_LEN chars are this tag.
    const keys: string[] = source instanceof Map ? [...source.keys()] : Object.keys(source);
    for (const k of keys) {
        if (k.length === 32 && /^[0-9a-f]+$/.test(k) && k.slice(0, SESSION_ID_LEN) === runId) {
            return get(k);
        }
    }
    // 3. A raw session id that hashes to this tag.
    for (const k of keys) {
        if (derive_session_tag(k) === runId) return get(k);
    }
    return undefined;
}

/**
 * Phase 5.0 — the autonomy axis, from three runtime sources.
 *
 * Each reader is best-effort and returns an empty map on any failure. That is
 * correct rather than lenient: a run that predates the mechanism genuinely had
 * zero re-engagements, and refusing to report the other axes because one
 * source is absent would make the whole report unavailable on a fresh install.
 */
export function readContinuationEvents(
    root: string,
): Map<string, { engage: number; stall: number }> {
    const out = new Map<string, { engage: number; stall: number }>();
    let text: string;
    try {
        text = fs.readFileSync(
            path.join(root, 'agents', 'runtime', 'state', 'run-continuation.jsonl'),
            'utf-8',
        );
    } catch {
        return out;
    }
    for (const line of text.split('\n')) {
        if (line.trim() === '') continue;
        let rec: unknown;
        try {
            rec = JSON.parse(line);
        } catch {
            continue;
        }
        if (rec === null || typeof rec !== 'object' || Array.isArray(rec)) continue;
        const o = rec as Record<string, unknown>;
        const id = o['run_id'];
        const ev = o['event'];
        if (typeof id !== 'string' || typeof ev !== 'string') continue;
        const cur = out.get(id) ?? { engage: 0, stall: 0 };
        if (ev === 'engage') cur.engage += 1;
        else if (ev === 'halt-stall') cur.stall += 1;
        out.set(id, cur);
    }
    return out;
}

export function readRelaunchLedger(root: string): Record<string, number> {
    try {
        const raw: unknown = JSON.parse(
            fs.readFileSync(
                path.join(root, 'agents', 'runtime', 'state', 'supervise-relaunches.json'),
                'utf-8',
            ),
        );
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
        }
        return out;
    } catch {
        return {};
    }
}

export function readMemoCounts(root: string): Record<string, number> {
    const base = path.join(root, 'agents', 'runtime', 'state', 'decisions');
    const out: Record<string, number> = {};
    let runs: string[];
    try {
        runs = fs.readdirSync(base);
    } catch {
        return out;
    }
    for (const run of runs) {
        try {
            out[run] = fs
                .readdirSync(path.join(base, run))
                .filter((n) => /^\d{3}\.md$/.test(n)).length;
        } catch {
            // a file where a directory was expected — not a run
        }
    }
    return out;
}

export function median(values: readonly number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function readLedger(root: string): LedgerRow[] {
    const file = path.join(root, 'agents', 'runtime', 'state', 'interruptions.jsonl');
    let raw: string;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch {
        return [];
    }
    const out: LedgerRow[] = [];
    for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try {
            const o: unknown = JSON.parse(line);
            if (o === null || typeof o !== 'object') continue;
            const r = o as Record<string, unknown>;
            if (typeof r['run_id'] !== 'string') continue;
            out.push({
                run_id: r['run_id'],
                turn: typeof r['turn'] === 'number' ? r['turn'] : 0,
                kind: typeof r['kind'] === 'string' ? r['kind'] : 'none',
                class: typeof r['class'] === 'string' ? r['class'] : 'none',
                roadmap: typeof r['roadmap'] === 'string' ? r['roadmap'] : null,
                at: typeof r['at'] === 'string' ? r['at'] : '',
            });
        } catch {
            // A corrupt line is one lost observation, never a failed report.
        }
    }
    return out;
}

export function readHistory(root: string): { turns: HistoryTurn[]; synthetic: number } {
    const file = process.env['AGENT_CHAT_HISTORY_FILE'] || path.join(root, 'agents', 'runtime', '.agent-chat-history');
    let raw: string;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch {
        return { turns: [], synthetic: 0 };
    }
    const turns: HistoryTurn[] = [];
    let synthetic = 0;
    for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try {
            const o: unknown = JSON.parse(line);
            if (o === null || typeof o !== 'object') continue;
            const r = o as Record<string, unknown>;
            const t = r['t'];
            if (t !== 'user' && t !== 'agent') continue;
            const session = typeof r['s'] === 'string' ? r['s'] : '';
            const ts = typeof r['ts'] === 'string' ? r['ts'] : '';
            if (!session || !ts) continue;
            const text = typeof r['text'] === 'string' ? r['text'] : '';
            const isSynthetic = t === 'user' && isSyntheticUserText(text);
            if (isSynthetic) synthetic += 1;
            turns.push({ session, role: t, ts, synthetic: isSynthetic });
        } catch {
            // Same reasoning as the ledger: one bad line is not a failed report.
        }
    }
    return { turns, synthetic };
}

const MINUTE_MS = 60_000;

function minutesBetween(a: string, b: string): number | null {
    const ta = Date.parse(a);
    const tb = Date.parse(b);
    if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
    return (tb - ta) / MINUTE_MS;
}

/**
 * Per-session wait gaps: an agent turn followed by a REAL user turn. Synthetic
 * user entries are skipped rather than treated as replies, so a run the harness
 * woke up four times still shows the one human wait it actually had.
 */
export function waitGaps(turns: readonly HistoryTurn[]): number[] {
    const gaps: number[] = [];
    let lastAgentTs: string | null = null;
    for (const turn of turns) {
        if (turn.role === 'agent') {
            lastAgentTs = turn.ts;
            continue;
        }
        if (turn.synthetic) continue;
        if (lastAgentTs === null) continue;
        const gap = minutesBetween(lastAgentTs, turn.ts);
        if (gap !== null && gap >= 0) gaps.push(gap);
        lastAgentTs = null;
    }
    return gaps;
}

export function buildReport(root: string, windowRequested: number): Report {
    const ledger = readLedger(root);
    const { turns, synthetic } = readHistory(root);

    const bySession = new Map<string, HistoryTurn[]>();
    for (const turn of turns) {
        const list = bySession.get(turn.session);
        if (list) list.push(turn);
        else bySession.set(turn.session, [turn]);
    }
    for (const list of bySession.values()) list.sort((a, b) => a.ts.localeCompare(b.ts));

    // Newest sessions first, capped at the requested window. Ordering is by the
    // session's LAST turn, so a long-running session that started earliest is
    // still current.
    const ordered = [...bySession.entries()].sort((a, b) => {
        const la = a[1][a[1].length - 1]?.ts ?? '';
        const lb = b[1][b[1].length - 1]?.ts ?? '';
        return lb.localeCompare(la);
    });
    const windowed = ordered.slice(0, windowRequested);
    const windowedIds = new Set(windowed.map(([id]) => id));

    const ledgerRuns = new Set(ledger.map((r) => r.run_id));
    const runIds = new Set<string>([...windowedIds]);
    // A ledger run with no history is still a run; it contributes contacts and a
    // null wall clock rather than disappearing from the denominator.
    for (const id of ledgerRuns) if (!windowedIds.has(id)) runIds.add(id);

    // Phase 5.0 sources. All three are gitignored runtime state, all three are
    // read best-effort, and an absent one yields zeros rather than an error —
    // a run predating the mechanism genuinely had zero re-engagements.
    const continuation = readContinuationEvents(root);
    const relaunches = readRelaunchLedger(root);
    const memosByRun = readMemoCounts(root);

    const allGaps: number[] = [];
    const runs: RunReport[] = [];

    for (const runId of runIds) {
        const rows = ledger.filter((r) => r.run_id === runId);
        const contacts = rows.filter((r) => r.kind !== 'none');
        const asks = contacts.filter((r) => r.kind === 'ask').length;
        const handbacks = contacts.filter((r) => r.kind === 'handback').length;

        // A halt is a contact on the run's LAST recorded turn: the run stopped
        // there and did not resume inside this window. Every other contact was
        // answered and the run continued, which is a different, cheaper event.
        const maxTurn = rows.reduce((m, r) => Math.max(m, r.turn), -1);
        const halts = contacts.filter((r) => r.turn === maxTurn).length;

        const sessionTurns = bySession.get(runId) ?? [];
        const gaps = waitGaps(sessionTurns);
        allGaps.push(...gaps);

        let elapsed: number | null = null;
        let waiting: number | null = null;
        let working: number | null = null;
        if (sessionTurns.length >= 2) {
            elapsed = minutesBetween(sessionTurns[0]!.ts, sessionTurns[sessionTurns.length - 1]!.ts);
            waiting = gaps.reduce((a, b) => a + b, 0);
            if (elapsed !== null) working = Math.max(0, elapsed - waiting);
        }

        const cont = lookupByRunId(continuation, runId) ?? { engage: 0, stall: 0 };
        const inLedger = ledgerRuns.has(runId);
        runs.push({
            run_id: runId,
            roadmap: rows.find((r) => r.roadmap !== null)?.roadmap ?? null,
            // `null`, not 0, when this run is absent from the ledger — see
            // the field docs above and falsification criterion (3).
            asks: inLedger ? asks : null,
            handbacks: inLedger ? handbacks : null,
            contacts: inLedger ? contacts.length : null,
            halts: inLedger ? halts : null,
            elapsed_minutes: elapsed,
            waiting_minutes: waiting,
            working_minutes: working,
            reengagements: cont.engage,
            stall_halts: cont.stall,
            // By ROADMAP, not by run id: the relaunch ledger is keyed on the
            // roadmap slug so its per-run cap survives the new session id a
            // relaunch produces (see `run_supervise.RelaunchLedger`). Joining
            // it on the run id would read 0 for every run — the same
            // permanent-zero shape finding 2 fixed one source over.
            relaunches: (rows.find((r) => r.roadmap !== null)?.roadmap ?? null) === null
                ? 0
                : (relaunches[rows.find((r) => r.roadmap !== null)?.roadmap as string] ?? 0),
            memos: lookupByRunId(memosByRun, runId) ?? 0,
        });
    }

    runs.sort((a, b) => a.run_id.localeCompare(b.run_id));

    const notes: string[] = [];
    if (ledger.length === 0) {
        notes.push(
            'interruptions.jsonl is empty or absent — the contact axis has no observations yet. ' +
                'The Phase 0 concern records on `stop`; a baseline needs sessions to have run since it landed.',
        );
    }
    if (bySession.size === 0) {
        notes.push('no chat history with session tags — the wall-clock axis has no observations.');
    }
    const runsWithLedger = runs.filter((r) => ledgerRuns.has(r.run_id)).length;
    if (runsWithLedger < runs.length) {
        notes.push(
            `${runs.length - runsWithLedger} run(s) in the window have timing but no ledger entry ` +
                '— reported with null contact counts rather than as zero contacts.',
        );
    }

    return {
        window_requested: windowRequested,
        sessions_found: bySession.size,
        window_short: bySession.size < windowRequested,
        synthetic_user_turns_excluded: synthetic,
        runs,
        notes,
        median_contacts_per_run: median(
            runs
                .filter((r) => ledgerRuns.has(r.run_id))
                .map((r) => r.contacts)
                .filter((v): v is number => v !== null),
        ),
        median_user_wait_minutes: median(allGaps),
        median_elapsed_minutes: median(
            runs.map((r) => r.elapsed_minutes).filter((v): v is number => v !== null),
        ),
        median_working_minutes: median(
            runs.map((r) => r.working_minutes).filter((v): v is number => v !== null),
        ),
        median_reengagements_per_run: median(runs.map((r) => r.reengagements)),
        // A RATE, not a count: the question is what share of runs hit the
        // anti-stall rung, and a raw count would rise with the window size and
        // read as a regression when nothing changed.
        stall_halt_rate:
            runs.length === 0 ? null : runs.filter((r) => r.stall_halts > 0).length / runs.length,
        median_relaunches_per_run: median(runs.map((r) => r.relaunches)),
        median_memos_per_run: median(runs.map((r) => r.memos)),
    };
}

function fmt(v: number | null, unit = ''): string {
    return v === null ? 'n/a' : `${Math.round(v * 10) / 10}${unit}`;
}

export function renderText(report: Report): string {
    const lines: string[] = [];
    lines.push('interruption_report — road-to-user-out-of-the-loop Phase 0');
    lines.push('');
    lines.push(
        `window: ${report.sessions_found} session(s) found / ${report.window_requested} requested` +
            (report.window_short ? '   ⚠️  SHORT WINDOW — see notes' : ''),
    );
    lines.push(`synthetic user turns excluded: ${report.synthetic_user_turns_excluded}`);
    lines.push('');
    lines.push('CONTACT AXIS');
    lines.push(`  median contacts per run:   ${fmt(report.median_contacts_per_run)}`);
    lines.push(`  median user wait:          ${fmt(report.median_user_wait_minutes, ' min')}`);
    lines.push('');
    lines.push('WALL-CLOCK AXIS');
    lines.push(`  median elapsed per run:    ${fmt(report.median_elapsed_minutes, ' min')}`);
    lines.push(`  median agent working time: ${fmt(report.median_working_minutes, ' min')}`);
    lines.push('');
    lines.push('AUTONOMY AXIS (Phase 5.0)');
    lines.push(`  median re-engagements:     ${fmt(report.median_reengagements_per_run)}`);
    lines.push(
        `  stall-halt rate:           ${
            report.stall_halt_rate === null
                ? 'n/a'
                : `${Math.round(report.stall_halt_rate * 1000) / 10}%`
        }`,
    );
    lines.push(`  median relaunches per run: ${fmt(report.median_relaunches_per_run)}`);
    lines.push(`  median memos per run:      ${fmt(report.median_memos_per_run)}`);
    // Two axes the roadmap names and this instrument CANNOT report. Stated as
    // no-instrument rather than printed as 0, because a zero here would read
    // as "measured, and it is zero" — the exact confusion between an absent
    // record and an absent event that this suite records elsewhere.
    lines.push('  unattended-vs-attended rework: NO INSTRUMENT — the unattended lane cannot run');
    lines.push('    yet (the spawn is unbuilt and the budget defaults to disabled). The threshold');
    lines.push('    is pre-registered as `unattended-demotion-gate` in docs/CLAIMS.md.');
    lines.push('  memo revisit rate:            NO INSTRUMENT — a memo carries no revisit marker,');
    lines.push('    so a revisited decision is indistinguishable from one nobody reopened.');
    lines.push('');
    lines.push(`runs: ${report.runs.length}`);
    for (const run of report.runs) {
        lines.push(
            `  ${run.run_id}  asks=${run.asks} handbacks=${run.handbacks} halts=${run.halts}` +
                `  elapsed=${fmt(run.elapsed_minutes)} working=${fmt(run.working_minutes)}` +
                `  re=${run.reengagements} stall=${run.stall_halts} relaunch=${run.relaunches} memo=${run.memos}` +
                `  roadmap=${run.roadmap ?? '-'}`,
        );
    }
    if (report.window_short) {
        lines.push('');
        lines.push(
            'SHORT WINDOW — the rolling chat history is a buffer, not an archive. The number ' +
                'above is computed over the sessions that exist, and is labelled with that count ' +
                'rather than with the requested window. Do not cite it as an N-session baseline.',
        );
    }
    for (const note of report.notes) {
        lines.push('');
        lines.push(`note: ${note}`);
    }
    return lines.join('\n');
}

const USAGE = `usage: interruption_report [--window N] [--json] [--root PATH]

Reports the two axes road-to-user-out-of-the-loop pre-registers:
  contact axis     asks / hand-backs / halts per run, median user wait
  wall-clock axis  elapsed per run versus agent working time

  --window N   sessions to include, newest first (default ${DEFAULT_WINDOW}).
               A REQUEST, not a guarantee: the chat history is a rolling
               buffer, so the report states how many sessions it actually
               found and flags a short window rather than mislabelling it.
  --json       machine-readable output.
  --root PATH  repository root (default: cwd).
`;

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(USAGE);
        return 0;
    }
    let windowRequested = DEFAULT_WINDOW;
    let root = process.cwd();
    let asJson = false;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--json') {
            asJson = true;
        } else if (arg === '--window') {
            const raw = argv[i + 1];
            const parsed = Number(raw);
            if (raw === undefined || !Number.isFinite(parsed) || parsed <= 0) {
                process.stderr.write(`interruption_report: --window needs a positive number\n`);
                return 2;
            }
            windowRequested = Math.floor(parsed);
            i += 1;
        } else if (arg === '--root') {
            const raw = argv[i + 1];
            if (raw === undefined) {
                process.stderr.write('interruption_report: --root needs a path\n');
                return 2;
            }
            root = raw;
            i += 1;
        } else {
            process.stderr.write(`interruption_report: unknown argument '${String(arg)}'\n`);
            process.stderr.write(USAGE);
            return 2;
        }
    }

    const report = buildReport(root, windowRequested);
    process.stdout.write(asJson ? `${JSON.stringify(report, null, 2)}\n` : `${renderText(report)}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // Symlinked invocation (an installed projection, or macOS /var → /private/var):
    // import.meta.url is the real path while argv[1] keeps the symlink, so the raw
    // URLs differ and the CLI would silently no-op. Compare realpaths.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
