/**
 * The extraction gate: the bench moves out of this repository into its own app
 * only when at least two of five criteria hold and the owner agrees.
 *
 *   G1 external demand          — a documented request (state file)
 *   G2 rival-dominated engine   — ≥ 50 % of engine commits in the window touch a rival
 *   G3 licence conflict         — a needed part may not live in this repository (state file)
 *   G4 CI burden                — ≥ 10 % of failed CI runs come from a bench workflow
 *   G5 public ranking wanted    — an owner decision (state file)
 *
 * G2 and G4 are measured here; G1, G3 and G5 are recorded facts in
 * `internal/bench/extraction-gate.json`. Anything not measurable reads
 * `unknown`, never `no`.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const STATE_FILE = path.join(REPO_ROOT, 'internal', 'bench', 'extraction-gate.json');
const ENGINE_PATHS = ['internal/bench'];
const RIVAL_RE = /(^|\/)rivals?[-/]/i;
const BENCH_WORKFLOW_RE = /bench/i;
const G2_MIN = 0.5;
const G4_MIN = 0.1;
const WINDOW_DAYS = 90;

export interface StateEntry {
    holds: boolean | null;
    note: string;
}
export type GateState = Record<'G1' | 'G3' | 'G5', StateEntry>;

export interface GateRow {
    id: string;
    criterion: string;
    current: string;
    holds: boolean | null;
}

/** G2: engine commits touching a rival path, over all engine commits. */
export function rivalShare(commits: readonly (readonly string[])[]): { rival: number; total: number } {
    return { rival: commits.filter((files) => files.some((f) => RIVAL_RE.test(f))).length, total: commits.length };
}

/** G4: failed runs of a bench workflow, over all failed runs. */
export function benchRedShare(runs: readonly { name: string; conclusion: string | null }[]): { bench: number; red: number } {
    const red = runs.filter((r) => r.conclusion === 'failure');
    return { bench: red.filter((r) => BENCH_WORKFLOW_RE.test(r.name)).length, red: red.length };
}

const pct = (n: number, d: number): string => `${Math.round((100 * n) / d)} %`;

export function gateRows(input: {
    rival: { rival: number; total: number };
    red: { bench: number; red: number } | null;
    state: GateState;
}): GateRow[] {
    const { rival, red, state } = input;
    return [
        { id: 'G1', criterion: 'External demand: someone else wants their package measured or contributes', current: state.G1.note, holds: state.G1.holds },
        {
            id: 'G2',
            criterion: `Rival-dominated engine: ≥ ${G2_MIN * 100} % of engine commits in ${WINDOW_DAYS} days touch a rival`,
            current: rival.total === 0 ? 'no engine commits in the window' : `${rival.rival} of ${rival.total} engine commits (${pct(rival.rival, rival.total)})`,
            holds: rival.total === 0 ? null : rival.rival / rival.total >= G2_MIN,
        },
        { id: 'G3', criterion: 'License conflict: a needed part may not live in this repository', current: state.G3.note, holds: state.G3.holds },
        {
            id: 'G4',
            criterion: `CI burden: ≥ ${G4_MIN * 100} % of failed CI runs in ${WINDOW_DAYS} days come from a bench workflow`,
            current: red === null ? 'CI statistics unavailable' : red.red === 0 ? 'no failed runs in the window' : `${red.bench} of ${red.red} failed runs (${pct(red.bench, red.red)})`,
            holds: red === null || red.red === 0 ? null : red.bench / red.red >= G4_MIN,
        },
        { id: 'G5', criterion: 'A public, neutral ranking is wanted (owner decision)', current: state.G5.note, holds: state.G5.holds },
    ];
}

export function gateVerdict(rows: readonly GateRow[], ownerAgrees: boolean): string {
    const held = rows.filter((r) => r.holds === true).length;
    const unknown = rows.filter((r) => r.holds === null).length;
    const tail = unknown > 0 ? `, ${unknown} unknown` : '';
    if (held >= 2 && ownerAgrees) return `extract — ${held} of ${rows.length} hold and the owner agreed`;
    if (held >= 2) return `stay — ${held} of ${rows.length} hold; the owner has not agreed${tail}`;
    return `stay — ${held} of ${rows.length} hold, 2 needed${tail}`;
}

export function renderGate(rows: readonly GateRow[], ownerAgrees: boolean): string {
    const mark = (h: boolean | null): string => (h === null ? 'unknown' : h ? 'yes' : 'no');
    return [
        '| ID | Criterion | Current state | Holds |',
        '|---|---|---|---|',
        ...rows.map((r) => `| ${r.id} | ${r.criterion} | ${r.current} | ${mark(r.holds)} |`),
        '',
        `**Verdict:** ${gateVerdict(rows, ownerAgrees)}`,
        '',
    ].join('\n');
}

function engineCommits(): string[][] {
    const r = spawnSync('git', ['log', `--since=${WINDOW_DAYS}.days`, '--no-merges', '--name-only', '--format=format:@@', '--', ...ENGINE_PATHS], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
    });
    if (r.status !== 0) return [];
    return r.stdout
        .split('@@')
        .map((block) => block.split('\n').filter((l) => l.trim() !== ''))
        .filter((files) => files.length > 0);
}

function ciRuns(): { name: string; conclusion: string | null }[] | null {
    const since = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
    const r = spawnSync('gh', ['run', 'list', '--limit', '1000', '--created', `>=${since}`, '--json', 'name,conclusion'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
    });
    if (r.status !== 0) return null;
    return JSON.parse(r.stdout) as { name: string; conclusion: string | null }[];
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as GateState & { owner_agrees: boolean };
    const runs = argv.includes('--no-ci') ? null : ciRuns();
    const rows = gateRows({ rival: rivalShare(engineCommits()), red: runs === null ? null : benchRedShare(runs), state });
    if (argv.includes('--json')) process.stdout.write(`${JSON.stringify({ rows, verdict: gateVerdict(rows, state.owner_agrees) }, null, 2)}\n`);
    else process.stdout.write(renderGate(rows, state.owner_agrees));
    return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
    process.exitCode = main();
}
