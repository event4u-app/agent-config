#!/usr/bin/env tsx
/**
 * The worker-reuse shadow window, read from the subagent ledger, and the four
 * flip conditions of `docs/contracts/concern-activation-policy.md` as code.
 *
 * The guard flips from shadow to blocking only when ALL FOUR hold: a failure
 * the threshold would have caught is in the window, the false-positive rate is
 * measured and within 1 %, the economics are measured and favour it, and the
 * window holds at least 100 calls or two weeks. A condition nobody measured is
 * missing, never assumed. A window in which every reuse was refused is a valid
 * null.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEDGER_DIR } from './hooks/subagent_ledger_hook.js';

export interface ShadowLine {
    event: string;
    ts: string;
    tool?: string;
    dispatch_kind?: string;
    reuse?: { verdict: 'would_resume' | 'fresh'; name: string | null; reasons: string[] };
}

export interface ShadowWindow {
    first_ts: string | null;
    last_ts: string | null;
    days: number;
    agent_calls: number;
    would_resume: number;
    would_resume_by_name: Record<string, number>;
    refusal_reasons: Record<string, number>;
    resumes_observed: number;
    null_window: boolean;
}

export const FALSE_POSITIVE_TOLERANCE = 0.01;
export const WINDOW_MIN_CALLS = 100;
export const WINDOW_MIN_DAYS = 14;

const sorted = (m: Record<string, number>): Record<string, number> =>
    Object.fromEntries(Object.entries(m).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

export function summariseShadowWindow(lines: readonly ShadowLine[]): ShadowWindow {
    const shadow = lines.filter((l) => l.event === 'spawn_guard_shadow');
    const spawns = shadow.filter((l) => l.reuse !== undefined);
    const byName: Record<string, number> = {};
    const reasons: Record<string, number> = {};
    let would = 0;
    for (const l of spawns) {
        if (l.reuse!.verdict === 'would_resume' && l.reuse!.name !== null) {
            would++;
            byName[l.reuse!.name] = (byName[l.reuse!.name] ?? 0) + 1;
        } else {
            for (const r of l.reuse!.reasons) reasons[r] = (reasons[r] ?? 0) + 1;
        }
    }
    const times = spawns.map((l) => Date.parse(l.ts)).filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
    const first = times.length ? times[0]! : null;
    const last = times.length ? times[times.length - 1]! : null;
    return {
        first_ts: first === null ? null : new Date(first).toISOString(),
        last_ts: last === null ? null : new Date(last).toISOString(),
        days: first === null || last === null ? 0 : (last - first) / 86_400_000,
        agent_calls: spawns.length,
        would_resume: would,
        would_resume_by_name: sorted(byName),
        refusal_reasons: sorted(reasons),
        resumes_observed: shadow.filter((l) => l.dispatch_kind === 'resume').length,
        null_window: spawns.length > 0 && would === 0,
    };
}

/** Measurements the shadow log cannot produce on its own; null means unmeasured. */
export interface FlipMeasurements {
    false_positive_rate: number | null;
    cost_avoided: number | null;
    friction: number | null;
}

export type FlipCondition = 'failure_observed' | 'false_positive_rate_measured' | 'economics_measured' | 'window_met';

export function flipReadiness(w: ShadowWindow, m: FlipMeasurements): { ready: boolean; missing: FlipCondition[] } {
    const missing: FlipCondition[] = [];
    if (w.would_resume === 0) missing.push('failure_observed');
    if (m.false_positive_rate === null || m.false_positive_rate > FALSE_POSITIVE_TOLERANCE) missing.push('false_positive_rate_measured');
    if (m.cost_avoided === null || m.friction === null || m.cost_avoided <= m.friction) missing.push('economics_measured');
    if (w.agent_calls < WINDOW_MIN_CALLS && w.days < WINDOW_MIN_DAYS) missing.push('window_met');
    return { ready: missing.length === 0, missing };
}

function readLedger(root: string): ShadowLine[] {
    const dir = path.join(root, LEDGER_DIR);
    if (!fs.existsSync(dir)) return [];
    const out: ShadowLine[] = [];
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort()) {
        for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
            if (!line.includes('spawn_guard_shadow')) continue;
            try {
                out.push(JSON.parse(line) as ShadowLine);
            } catch {
                // A torn line is not a record.
            }
        }
    }
    return out;
}

function main(): number {
    const root = process.argv[2] ?? process.cwd();
    const w = summariseShadowWindow(readLedger(root));
    const r = flipReadiness(w, { false_positive_rate: null, cost_avoided: null, friction: null });
    process.stdout.write(`${JSON.stringify({ window: w, flip: r }, null, 2)}\n`);
    return 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
    process.exit(main());
}
