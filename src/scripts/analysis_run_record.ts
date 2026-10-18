/**
 * analysis_run_record.ts — `run.json`, the one record each analysis round
 * leaves in `agents/runtime/analysis/<round-id>/` (step 6.3, ADR-288 D9).
 *
 * It is the denominator the falsification rule reads after ten runs and the
 * unit the retro's `analysis-run` reader consumes. A reading that was not taken
 * is `missing`, never 0: a zero would be counted as a measured null.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { TOP_TIERS, type Lens, type LoopRow } from './analysis_ledger.js';
import type { AnalystMode } from './analysis_analysts.js';
import { assertKnownSchema, type RunState } from './analysis_run.js';

export const RUN_JSON = 'run.json';
export const RUN_JSON_SCHEMA_VERSION = '1.0';
export const DOORS = ['reference', 'and-optimize', 'pr', 'inbox'] as const;
export type Door = (typeof DOORS)[number];

export interface AnalystInput {
    analyst_id: string;
    mode: AnalystMode;
    family: string;
    ledger: readonly LoopRow[];
    tokens: number;
}

export interface RunJsonInput {
    run_id: string;
    door: Door;
    started_at: string;
    ended_at: string;
    final_state: RunState;
    analysts: AnalystInput[];
    exchange: { rounds: number; already_fixed: number; claims_checked: number } | null;
    gain: { offered: boolean; band: 'low' | 'medium' | 'high'; reason: string };
    seats: { used: string[]; failed: string[] };
    roadmaps_emitted: string[];
    recurrence_hits: number;
    ci_rounds: number;
    /** From `probe_turnaround` over the run's sessions; null when it was not read. */
    turnaround: { user_requests: number; blocking_calls: number } | null;
}

export interface RunJsonRow {
    analyst_id: string;
    mode: AnalystMode;
    family: string;
    loop: number;
    lens: Lens;
    status: LoopRow['status'];
    top_tier: { added: number; changed: number; killed: number };
}

export interface RunJson {
    schema_version: string;
    run_id: string;
    door: Door;
    final_state: RunState;
    analysts: number;
    rows: RunJsonRow[];
    exchange:
        | { rounds: number; already_fixed: number; claims_checked: number; already_fixed_rate: number | 'missing' }
        | 'missing';
    gain: RunJsonInput['gain'];
    seats: RunJsonInput['seats'];
    roadmaps_emitted: string[];
    recurrence_hits: number;
    ci_rounds: number;
    tokens: number;
    wall_clock_seconds: number;
    turnaround: NonNullable<RunJsonInput['turnaround']> | 'missing';
}

function topTierCounts(row: LoopRow): RunJsonRow['top_tier'] {
    const counts = { added: 0, changed: 0, killed: 0 };
    if (row.status !== 'counted') return counts;
    for (const item of row.items) {
        if (item.change === 'retained' || !item.evidence.some((e) => TOP_TIERS.includes(e.tier))) continue;
        counts[item.change] += 1;
    }
    return counts;
}

export function buildRunJson(input: RunJsonInput): RunJson {
    const rows: RunJsonRow[] = input.analysts.flatMap((a) =>
        a.ledger.map((row) => ({
            analyst_id: a.analyst_id,
            mode: a.mode,
            family: a.family,
            loop: row.loop,
            lens: row.lens,
            status: row.status,
            top_tier: topTierCounts(row),
        })),
    );
    const ex = input.exchange;
    return {
        schema_version: RUN_JSON_SCHEMA_VERSION,
        run_id: input.run_id,
        door: input.door,
        final_state: input.final_state,
        analysts: input.analysts.length,
        rows,
        exchange:
            ex === null
                ? 'missing'
                : { ...ex, already_fixed_rate: ex.claims_checked > 0 ? ex.already_fixed / ex.claims_checked : 'missing' },
        gain: { ...input.gain },
        seats: { used: [...input.seats.used], failed: [...input.seats.failed] },
        roadmaps_emitted: [...input.roadmaps_emitted],
        recurrence_hits: input.recurrence_hits,
        ci_rounds: input.ci_rounds,
        tokens: input.analysts.reduce((sum, a) => sum + a.tokens, 0),
        wall_clock_seconds: Math.round((Date.parse(input.ended_at) - Date.parse(input.started_at)) / 1000),
        turnaround: input.turnaround === null ? 'missing' : { ...input.turnaround },
    };
}

const isCount = (v: unknown): boolean => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Every reason `doc` is not a valid run.json. Empty means valid. */
export function validateRunJson(doc: unknown): string[] {
    if (typeof doc !== 'object' || doc === null) return ['run.json is not an object'];
    const d = doc as Record<string, unknown>;
    const errors: string[] = [];
    try {
        assertKnownSchema(d['schema_version'], 'run.json');
    } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
    }
    if (typeof d['run_id'] !== 'string' || d['run_id'] === '') errors.push('run_id is required');
    if (!DOORS.includes(d['door'] as Door)) errors.push(`door must be one of ${DOORS.join(', ')}`);
    for (const key of ['analysts', 'recurrence_hits', 'ci_rounds', 'tokens', 'wall_clock_seconds']) {
        if (!isCount(d[key])) errors.push(`${key} must be a non-negative integer`);
    }
    const seats = d['seats'] as { used?: unknown; failed?: unknown } | undefined;
    if (seats === undefined || !Array.isArray(seats.used) || !Array.isArray(seats.failed)) errors.push('seats.used and seats.failed are required');
    if (!Array.isArray(d['roadmaps_emitted'])) errors.push('roadmaps_emitted must be a list');
    if (d['exchange'] !== 'missing' && (typeof d['exchange'] !== 'object' || d['exchange'] === null)) errors.push('exchange must be an object or "missing"');
    if (d['turnaround'] !== 'missing' && (typeof d['turnaround'] !== 'object' || d['turnaround'] === null)) {
        errors.push('turnaround must be an object or "missing"');
    }
    const rows = d['rows'];
    if (!Array.isArray(rows)) {
        errors.push('rows must be a list');
        return errors;
    }
    const perAnalyst = new Map<string, number[]>();
    for (const r of rows as Array<Record<string, unknown>>) {
        const id = String(r['analyst_id']);
        perAnalyst.set(id, [...(perAnalyst.get(id) ?? []), Number(r['loop'])]);
    }
    if (isCount(d['analysts']) && perAnalyst.size !== d['analysts']) {
        errors.push(`rows name ${perAnalyst.size} analysts, the record says ${String(d['analysts'])}`);
    }
    for (const [id, loops] of perAnalyst) {
        if (loops.some((l, i) => l !== i + 1)) errors.push(`rows of ${id} are not one per loop from 1: ${loops.join(',')}`);
    }
    return errors;
}

/** Written atomically, after validation; an invalid record is never left on disk. */
export function writeRunJson(runDir: string, doc: RunJson): void {
    const errors = validateRunJson(doc);
    if (errors.length > 0) throw new Error(`run.json invalid: ${errors.join('; ')}`);
    fs.mkdirSync(runDir, { recursive: true });
    const tmp = path.join(runDir, `${RUN_JSON}.tmp`);
    fs.writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`);
    fs.renameSync(tmp, path.join(runDir, RUN_JSON));
}

export function readRunJson(runDir: string): RunJson {
    const doc = JSON.parse(fs.readFileSync(path.join(runDir, RUN_JSON), 'utf8')) as unknown;
    const errors = validateRunJson(doc);
    if (errors.length > 0) throw new Error(`run.json invalid: ${errors.join('; ')}`);
    return doc as RunJson;
}
