#!/usr/bin/env tsx
/**
 * Advisory convergence verdict for every review loop in the census — the
 * shadow pilot of road-to-review-loops-that-converge, criterion D5.
 *
 * Over the trailing K adjacent visible rounds after round 1, first match wins:
 *
 *   - `insufficient-data` — fewer than K such rounds, a gap inside the window,
 *     or a loop none of whose findings carries a severity;
 *   - `diverging`  — new findings strictly increase across the window;
 *   - `converging` — no new high/critical finding outside `fix-introduced`, and
 *     new findings never increase from one round to the next (flat converges);
 *   - `stalled`    — no such severe finding, but at least one increase;
 *   - `active`     — otherwise (the window still raises severe findings).
 *
 * Per round, counts come from the merged reader classes where the ten longest
 * loops have them (they separate `fix-introduced`), else from a completion
 * review's findings table (every severe row counts: a table carries no origin).
 * Every finding a round raised counts as new, `re-raised` included. A
 * ratification loop without reader classes has no per-round severity. The
 * census round count is the horizon. A replay reads severity only from rounds
 * up to the one it replays.
 *
 * Advisory: it always exits 0 — an unreadable input prints
 * `review_convergence: unavailable` — and it is not a ratification mechanism
 * path, so it cannot change the ratification gate.
 *
 * Usage:
 *   ./scripts-run src/scripts/review_convergence                    verdict per census subject
 *   ./scripts-run src/scripts/review_convergence --subject <slug>   one subject
 *   ./scripts-run src/scripts/review_convergence --replay [--write] the replay artefact
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildCensus, LONG_LOOP, type CensusSubject, type LoopKind } from './review_loop_census.js';
import { INPUT_REL, mergeReaders, parseReaderReply, type ReaderOutput } from './review_loop_origins.js';

export const K = 3;
export const REPLAY_REL = 'agents/evidence/analysis/review-loop-replay-2026-11.md';
export const REPLAY_COMMAND = './scripts-run src/scripts/review_convergence --replay --write';

export type Verdict = 'insufficient-data' | 'diverging' | 'converging' | 'stalled' | 'active';
const STOP_VERDICTS: readonly Verdict[] = ['stalled', 'diverging'];

export interface SeriesRound {
    round: number;
    visible: boolean;
    newFindings: number;
    /** New high/critical findings outside `fix-introduced`. */
    severeNonFix: number;
    /** New high/critical findings, `fix-introduced` included. */
    severeAll: number;
}

export interface SevereFinding {
    round: number;
    severity: string;
    origin: string;
    text: string;
}

export interface Series {
    subject: string;
    kind: LoopKind;
    totalRounds: number;
    hasSeverity: boolean;
    /** First round whose findings carry a known severity; a replay never reads one from later. */
    severityFrom?: number;
    /** Rounds 2.., in order. */
    rounds: SeriesRound[];
    severeFindings?: SevereFinding[];
}

const SEVERE = new Set(['high', 'critical']);
const KNOWN_SEVERITY = new Set(['critical', 'high', 'medium', 'low']);

export function verdict(rounds: SeriesRound[], hasSeverity: boolean): Verdict {
    if (!hasSeverity || rounds.length < K) return 'insufficient-data';
    const w = rounds.slice(-K);
    const adjacent = w.every((r, i) => i === 0 || r.round === (w[i - 1]?.round ?? 0) + 1);
    if (!adjacent || w.some((r) => !r.visible)) return 'insufficient-data';
    const n = w.map((r) => r.newFindings);
    if (n.every((x, i) => i === 0 || x > (n[i - 1] ?? 0))) return 'diverging';
    if (w.every((r) => r.severeNonFix === 0)) {
        return n.every((x, i) => i === 0 || x <= (n[i - 1] ?? 0)) ? 'converging' : 'stalled';
    }
    return 'active';
}

export function seriesFor(s: CensusSubject, reader: ReaderOutput | undefined): Series {
    const out: Series = { subject: s.subject, kind: s.kind, totalRounds: s.rounds, hasSeverity: false, rounds: [], severeFindings: [] };
    const sawSeverity = (round: number): void => {
        out.hasSeverity = true;
        if (out.severityFrom === undefined || round < out.severityFrom) out.severityFrom = round;
    };
    const readerRounds = new Map((reader?.rounds ?? []).map((r) => [r.round, r]));
    const tableRounds = new Map(s.kind === 'completion-review' ? s.roundList.map((r) => [r.round, r.findings]) : []);
    for (const f of tableRounds.get(1) ?? []) if (KNOWN_SEVERITY.has(f.severity)) sawSeverity(1);
    // The census round count is the horizon: a reader reply never extends it.
    for (let n = 2; n <= s.rounds; n++) {
        const r = readerRounds.get(n);
        if (r !== undefined && r.visible) {
            let severeNonFix = 0;
            let severeAll = 0;
            for (const f of r.findings) {
                const sev = f.severity.toLowerCase();
                if (KNOWN_SEVERITY.has(sev)) sawSeverity(n);
                if (!SEVERE.has(sev)) continue;
                severeAll++;
                if (f.class !== 'fix-introduced') severeNonFix++;
                out.severeFindings!.push({ round: n, severity: sev, origin: f.class, text: f.summary });
            }
            out.rounds.push({ round: n, visible: true, newFindings: r.findings.length, severeNonFix, severeAll });
            continue;
        }
        // Per-round fallback: a completion review's own table, where the readers did not cover the round.
        const rows = tableRounds.get(n);
        if (rows === undefined || rows === null) {
            out.rounds.push({ round: n, visible: false, newFindings: 0, severeNonFix: 0, severeAll: 0 });
            continue;
        }
        let severe = 0;
        for (const f of rows) {
            if (KNOWN_SEVERITY.has(f.severity)) sawSeverity(n);
            if (!SEVERE.has(f.severity)) continue;
            severe++;
            out.severeFindings!.push({ round: n, severity: f.severity, origin: 'table', text: f.text });
        }
        out.rounds.push({ round: n, visible: true, newFindings: rows.length, severeNonFix: severe, severeAll: severe });
    }
    return out;
}

export interface ReplayRow {
    subject: string;
    kind: LoopKind;
    totalRounds: number;
    stopRound: number | null;
    stopVerdict: Verdict | null;
    roundsSaved: number;
    /** Rounds after the stop that are visible in the record; the severe counts cover only these. */
    visibleAfter: number;
    severeAfter: number;
    severeNonFixAfter: number;
    finalVerdict: Verdict;
}

/** Whether a prefix ending at `round` already carries a severity — never a later round's. */
function severityKnownAt(s: Series, round: number): boolean {
    return s.severityFrom === undefined ? s.hasSeverity : s.severityFrom <= round;
}

export function replaySubject(s: Series): ReplayRow {
    let stopRound: number | null = null;
    let stopVerdict: Verdict | null = null;
    for (let i = 1; i <= s.rounds.length; i++) {
        const last = s.rounds[i - 1]?.round ?? 0;
        const v = verdict(s.rounds.slice(0, i), severityKnownAt(s, last));
        if (STOP_VERDICTS.includes(v)) {
            stopRound = last;
            stopVerdict = v;
            break;
        }
    }
    const after = stopRound === null ? [] : s.rounds.filter((r) => r.round > stopRound!);
    return {
        subject: s.subject,
        kind: s.kind,
        totalRounds: s.totalRounds,
        stopRound,
        stopVerdict,
        roundsSaved: stopRound === null ? 0 : Math.max(0, s.totalRounds - stopRound),
        visibleAfter: after.filter((r) => r.visible).length,
        severeAfter: after.reduce((x, r) => x + r.severeAll, 0),
        severeNonFixAfter: after.reduce((x, r) => x + r.severeNonFix, 0),
        finalVerdict: verdict(s.rounds, s.hasSeverity),
    };
}

// --- I/O -------------------------------------------------------------------

function loadReaders(root: string): Map<string, ReaderOutput> {
    const dir = path.join(root, INPUT_REL);
    const out = new Map<string, ReaderOutput>();
    if (!fs.existsSync(dir)) return out;
    const read = (name: string): ReaderOutput | null => {
        const abs = path.join(dir, name);
        return fs.existsSync(abs) ? parseReaderReply(fs.readFileSync(abs, 'utf-8')) : null;
    };
    for (const name of fs.readdirSync(dir).sort()) {
        const m = /^reader-a-(.+)\.json$/.exec(name);
        if (!m) continue;
        const slug = m[1] ?? '';
        const a = read(name);
        const b = read(`reader-b-${slug}.json`);
        if (a === null || b === null) continue;
        out.set(slug, mergeReaders(a, b, read(`adjudicator-${slug}.json`)));
    }
    return out;
}

export function allSeries(root: string): Series[] {
    const readers = loadReaders(root);
    return buildCensus(root).subjects.map((s) => seriesFor(s, readers.get(s.subject)));
}

const cell = (t: string): string =>
    t.replace(/[|[\]`!]/g, (c) => `\\${c}`).replace(/</g, '&lt;').replace(/\s+/g, ' ').trim().slice(0, 160);

export function renderReplay(root: string): string {
    const series = allSeries(root).filter((s) => s.totalRounds >= LONG_LOOP);
    const rows = series.map(replaySubject);
    const out: string[] = [];
    out.push('# Review-loop replay — where the convergence criterion would have stopped');
    out.push('');
    out.push('<!-- evidence-type: analysis -->');
    out.push('');
    out.push(`Generated by \`${REPLAY_COMMAND}\`. Do not edit by hand — re-run the command.`);
    out.push('');
    out.push(`Criterion D5 of \`road-to-review-loops-that-converge\` (K = ${K}): the stop is the first round whose`);
    out.push('verdict over the rounds so far reads `stalled` or `diverging`. "Severe after" counts new');
    out.push('high/critical findings raised after the stop round (`fix-introduced` included); "non-fix"');
    out.push('excludes them. Completion-review tables carry no origin, so there both columns count every');
    out.push('severe row. Both cover only the "Visible after" rounds; a round missing from the record adds');
    out.push('nothing. A ratification loop without reader classes has no per-round severity and reads');
    out.push('`insufficient-data` — it never stops, and its cost column is empty rather than zero.');
    out.push('');
    out.push('| Subject | Kind | Rounds | Stop round | Stop verdict | Rounds saved | Visible after | Severe after | Severe after (non-fix) | Final verdict |');
    out.push('|---|---|---:|---:|---|---:|---:|---:|---:|---|');
    for (const r of rows) {
        const noData = series.find((s) => s.subject === r.subject)?.hasSeverity === false;
        out.push(
            `| \`${r.subject}\` | ${r.kind} | ${r.totalRounds} | ${r.stopRound ?? '—'} | ${r.stopVerdict ?? '—'} | ${r.roundsSaved} | ${r.visibleAfter} | ${noData ? '—' : r.severeAfter} | ${noData ? '—' : r.severeNonFixAfter} | ${r.finalVerdict} |`,
        );
    }
    const measured = rows.filter((r) => series.find((s) => s.subject === r.subject)?.hasSeverity);
    const stopped = measured.filter((r) => r.stopRound !== null);
    const sum = (xs: ReplayRow[], f: (r: ReplayRow) => number): number => xs.reduce((x, r) => x + f(r), 0);
    out.push(
        `| **pooled** | ${rows.length} loops, ${measured.length} with severity | ${sum(measured, (r) => r.totalRounds)} | ${stopped.length} stopped | — | ${sum(stopped, (r) => r.roundsSaved)} | ${sum(stopped, (r) => r.visibleAfter)} | ${sum(stopped, (r) => r.severeAfter)} | ${sum(stopped, (r) => r.severeNonFixAfter)} | — |`,
    );
    out.push('');
    out.push('## Severe findings raised after the stop');
    out.push('');
    out.push('| Subject | Round | Severity | Origin | Finding |');
    out.push('|---|---:|---|---|---|');
    let listed = 0;
    for (const r of stopped) {
        const s = series.find((x) => x.subject === r.subject);
        for (const f of s?.severeFindings ?? []) {
            if (f.round <= (r.stopRound ?? Infinity)) continue;
            out.push(`| \`${r.subject}\` | ${f.round} | ${f.severity} | ${f.origin} | ${cell(f.text)} |`);
            listed++;
        }
    }
    if (listed === 0) out.push('| — | | | | none |');
    out.push('');
    return out.join('\n');
}

function repoRoot(): string {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function main(argv: string[], write: (s: string) => void = (s) => process.stdout.write(s)): number {
    try {
        return run(argv, write);
    } catch (e) {
        write(`review_convergence: unavailable — ${e instanceof Error ? e.message : String(e)}\n`);
        return 0;
    }
}

function run(argv: string[], write: (s: string) => void): number {
    const ri = argv.indexOf('--root');
    const root = ri >= 0 && argv[ri + 1] !== undefined ? path.resolve(argv[ri + 1]!) : repoRoot();
    if (argv.includes('--replay')) {
        const text = renderReplay(root);
        if (argv.includes('--write')) {
            fs.mkdirSync(path.dirname(path.join(root, REPLAY_REL)), { recursive: true });
            fs.writeFileSync(path.join(root, REPLAY_REL), text, 'utf-8');
            write(`wrote ${REPLAY_REL}\n`);
        } else {
            write(text);
        }
        return 0;
    }
    const si = argv.indexOf('--subject');
    const only = si >= 0 ? argv[si + 1] : undefined;
    if (si >= 0 && (only === undefined || only.startsWith('--'))) {
        write('review_convergence: --subject needs a slug\n');
        return 0;
    }
    const series = allSeries(root).filter((s) => only === undefined || s.subject === only);
    if (series.length === 0) {
        write(`review_convergence: no census subject named ${only ?? '(none)'} — insufficient-data\n`);
        return 0;
    }
    for (const s of series) write(`${s.subject}\t${s.kind}\t${s.totalRounds}\t${verdict(s.rounds, s.hasSeverity)}\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
