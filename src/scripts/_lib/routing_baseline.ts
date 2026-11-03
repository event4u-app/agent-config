/**
 * The routing baseline: selection, ingestion, floors and regression states.
 *
 * `road-to-routing-assurance-live-floors` 0.2, 0.4 and 5.3. Every function here
 * is pure over its inputs so the protocol's rules are executable rather than
 * described: the selection a protocol freezes is `selectBaseline`, the floor
 * rule `docs/contracts/routing-assurance-metrics.md` registers is `deriveFloors`,
 * and the three regression states are `classifyRow`.
 *
 * ```
 * NOTHING HERE CHOOSES. EVERY CHOICE IS AN ARGUMENT THE PROTOCOL FIXES.
 * AN INFRASTRUCTURE FAILURE IS UNKNOWN — NEVER A MISS, NEVER A PASS.
 * ```
 */

import { createHash } from 'node:crypto';

import type { LabelledQuery } from '../compile_trigger_evals.js';

export function sha256(s: string): string {
    return createHash('sha256').update(s).digest('hex');
}

/**
 * The deterministic baseline selection.
 *
 * Positives only, because the registered floors are recall floors. Per unit,
 * the positive whose `sha256(skill + "\0" + id)` is smallest; units ordered by
 * `sha256(skill)` and the first `units` kept. Hash order rather than alphabet
 * order, so a run cut short by its cost ceiling loses a sample of units rather
 * than the tail of the alphabet.
 */
export function selectBaseline(queries: readonly LabelledQuery[], units: number, perUnit = 1): LabelledQuery[] {
    if (!Number.isInteger(units) || units < 1) throw new Error('selectBaseline: units must be a positive integer');
    if (!Number.isInteger(perUnit) || perUnit < 1) throw new Error('selectBaseline: perUnit must be a positive integer');
    const bySkill = new Map<string, LabelledQuery[]>();
    for (const q of queries) {
        if (!q.trigger) continue;
        const list = bySkill.get(q.skill) ?? [];
        list.push(q);
        bySkill.set(q.skill, list);
    }
    const skills = [...bySkill.keys()].sort((a, b) => (sha256(a) < sha256(b) ? -1 : 1)).slice(0, units);
    const out: LabelledQuery[] = [];
    for (const skill of skills) {
        const ranked = [...(bySkill.get(skill) as LabelledQuery[])].sort((a, b) =>
            sha256(`${a.skill}\0${a.id}`) < sha256(`${b.skill}\0${b.id}`) ? -1 : 1,
        );
        out.push(...ranked.slice(0, perUnit));
    }
    return out;
}

/** One run as the host's `--json` aggregate reports it — only the fields read. */
interface HostRun {
    passed?: unknown;
    error?: unknown;
    costUsd?: unknown;
    tracePath?: unknown;
}
interface HostCase {
    name?: unknown;
    promptMarkdown?: unknown;
    arms?: { with?: unknown };
}

/** The verdict of one case: fired, did not fire, or the instrument failed. */
export type CaseVerdict = 'fired' | 'not-fired' | 'unknown';

export interface CaseRow {
    /** The case directory name, `<rank>-<skill>-<id>`. */
    case: string;
    skill: string;
    query_sha256: string;
    verdict: CaseVerdict;
    cost_usd: number;
    /** Skill names the run actually invoked, from its trace; null when unread. */
    invoked: string[] | null;
}

export interface UnitRow {
    unit: string;
    /** Non-UNKNOWN runs. A unit with 0 has no recall and gets no floor. */
    n: number;
    fired: number;
    unknown: number;
    recall: number | null;
}

/**
 * Read the host aggregate into case rows. `skillOf` maps a case name to its
 * unit (the plan written at selection time is the authority, not the name).
 * `invokedOf` reads a trace path into invoked skill names, or null.
 */
export function ingestCases(
    aggregate: unknown,
    skillOf: (caseName: string) => string | undefined,
    invokedOf: (tracePath: string) => string[] | null = () => null,
): CaseRow[] {
    const cases = (aggregate as { cases?: unknown }).cases;
    if (!Array.isArray(cases)) throw new Error('ingestCases: the aggregate has no cases[]');
    const rows: CaseRow[] = [];
    for (const raw of cases as HostCase[]) {
        const name = typeof raw.name === 'string' ? raw.name : '';
        const skill = skillOf(name);
        if (skill === undefined) throw new Error(`ingestCases: case ${name} is not in the plan`);
        const runs = Array.isArray(raw.arms?.with) ? (raw.arms.with as HostRun[]) : [];
        for (const run of runs) {
            const failed = run.error !== null && run.error !== undefined;
            rows.push({
                case: name,
                skill,
                query_sha256: sha256(typeof raw.promptMarkdown === 'string' ? raw.promptMarkdown : ''),
                verdict: failed ? 'unknown' : run.passed === true ? 'fired' : 'not-fired',
                cost_usd: typeof run.costUsd === 'number' ? run.costUsd : 0,
                invoked: typeof run.tracePath === 'string' ? invokedOf(run.tracePath) : null,
            });
        }
    }
    return rows;
}

/** Per-unit recall over case rows; UNKNOWN runs are counted apart, never as misses. */
export function unitRows(rows: readonly CaseRow[]): UnitRow[] {
    const by = new Map<string, UnitRow>();
    for (const r of rows) {
        const u = by.get(r.skill) ?? { unit: r.skill, n: 0, fired: 0, unknown: 0, recall: null };
        if (r.verdict === 'unknown') u.unknown += 1;
        else {
            u.n += 1;
            if (r.verdict === 'fired') u.fired += 1;
        }
        by.set(r.skill, u);
    }
    for (const u of by.values()) u.recall = u.n === 0 ? null : u.fired / u.n;
    return [...by.values()].sort((a, b) => (a.unit < b.unit ? -1 : 1));
}

/** Skill names a host trace shows invoked through the Skill tool, namespace stripped. */
export function invokedFromTrace(jsonl: string): string[] {
    const out: string[] = [];
    for (const line of jsonl.split('\n')) {
        if (line.trim() === '') continue;
        let o: unknown;
        try {
            o = JSON.parse(line);
        } catch {
            continue;
        }
        const msg = (o as { type?: unknown; message?: { content?: unknown } }).message;
        if ((o as { type?: unknown }).type !== 'assistant' || !Array.isArray(msg?.content)) continue;
        for (const c of msg.content as { type?: unknown; name?: unknown; input?: { skill?: unknown } }[]) {
            if (c.type === 'tool_use' && c.name === 'Skill' && typeof c.input?.skill === 'string') {
                out.push(c.input.skill.replace(/^[^:]*:/, ''));
            }
        }
    }
    return out;
}

export interface Floor {
    unit: string;
    baseline_recall: number;
    floor: number;
}

/**
 * The registered rule: floor = baseline recall − tolerance, per unit, for every
 * unit with a measured recall. Clamped at 0 because recall cannot go below it —
 * a negative floor and a 0 floor gate exactly the same set of results.
 */
export function deriveFloors(units: readonly UnitRow[], tolerance: number): Floor[] {
    if (!(tolerance >= 0 && tolerance < 1)) throw new Error('deriveFloors: tolerance must be in [0,1)');
    return units
        .filter((u): u is UnitRow & { recall: number } => u.recall !== null)
        .map((u) => ({
            unit: u.unit,
            baseline_recall: u.recall,
            floor: Math.max(0, Math.round((u.recall - tolerance) * 1000) / 1000),
        }));
}

/** The three regression states of 5.3. Only REGRESSION gates. */
export type RegressionState = 'PASSED' | 'ROUTING_CHANGED' | 'REGRESSION' | 'UNKNOWN';

/**
 * Compare a current unit row against its frozen baseline row and floor.
 *
 * - REGRESSION: current recall is below the floor — the only gating state.
 * - ROUTING_CHANGED: at or above the floor, but recall moved, or the set of
 *   skills the runs invoked differs from the baseline's.
 * - PASSED: at or above the floor and nothing moved.
 * - UNKNOWN: no measured recall now (every run failed) — never green.
 */
export function classifyRow(
    baseline: { recall: number; invoked: readonly string[] },
    current: { recall: number | null; invoked: readonly string[] },
    floor: number,
): RegressionState {
    if (current.recall === null) return 'UNKNOWN';
    if (current.recall < floor) return 'REGRESSION';
    const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
        [...new Set(a)].sort().join('\n') === [...new Set(b)].sort().join('\n');
    if (current.recall !== baseline.recall || !sameSet(baseline.invoked, current.invoked)) return 'ROUTING_CHANGED';
    return 'PASSED';
}

export interface RunClassification {
    rows: { unit: string; floor: number; baseline_recall: number; recall: number | null; state: RegressionState }[];
    counts: Record<RegressionState, number>;
    /** Baseline units the current run did not measure at all. */
    not_run: string[];
    /** Units the current run measured that carry no registered floor. */
    unfloored: string[];
    /** red on any REGRESSION; unknown when nothing was measured or any unit is UNKNOWN; else green. */
    gate: 'green' | 'red' | 'unknown';
}

type RunShape = { cases: readonly CaseRow[]; units: readonly UnitRow[] };

/**
 * 5.3 over a whole run: every unit the current run measured, classified with
 * `classifyRow` against its frozen baseline row and its registered floor.
 * A unit without a registered floor is listed apart rather than compared to an
 * invented one — floors come only from the 0.4 derivation.
 */
export function classifyRun(baseline: RunShape, current: RunShape, floors: readonly Floor[]): RunClassification {
    const invokedBy = (cases: readonly CaseRow[]): Map<string, string[]> => {
        const m = new Map<string, string[]>();
        for (const c of cases) m.set(c.skill, [...(m.get(c.skill) ?? []), ...(c.invoked ?? [])]);
        return m;
    };
    const floorOf = new Map(floors.map((f) => [f.unit, f]));
    const baseInvoked = invokedBy(baseline.cases);
    const curInvoked = invokedBy(current.cases);
    const counts: Record<RegressionState, number> = { PASSED: 0, ROUTING_CHANGED: 0, REGRESSION: 0, UNKNOWN: 0 };
    const rows: RunClassification['rows'] = [];
    const unfloored: string[] = [];
    for (const u of [...current.units].sort((a, b) => (a.unit < b.unit ? -1 : 1))) {
        const f = floorOf.get(u.unit);
        if (f === undefined) {
            unfloored.push(u.unit);
            continue;
        }
        const state = classifyRow(
            { recall: f.baseline_recall, invoked: baseInvoked.get(u.unit) ?? [] },
            { recall: u.recall, invoked: curInvoked.get(u.unit) ?? [] },
            f.floor,
        );
        counts[state] += 1;
        rows.push({ unit: u.unit, floor: f.floor, baseline_recall: f.baseline_recall, recall: u.recall, state });
    }
    const measured = new Set(current.units.map((u) => u.unit));
    const not_run = floors.map((f) => f.unit).filter((n) => !measured.has(n)).sort();
    const gate = counts.REGRESSION > 0 ? 'red' : rows.length === 0 || counts.UNKNOWN > 0 ? 'unknown' : 'green';
    return { rows, counts, not_run, unfloored, gate };
}
