/**
 * pressure_state — the plan-window verdict as one small file, for readers on
 * the hook dispatch path.
 *
 * The full model (`pressure.ts`) and the ledger reader would cost every hook
 * dispatch about five kilobytes of bundle to parse, so they run where the
 * snapshot is written — the status-line tap — and leave their verdict here.
 * A reader on the dispatch path reads this file and nothing else. A verdict
 * older than ten minutes is no verdict, the same staleness rule the model uses.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { write_target, type EnvMap } from './user_global_paths.js';

const STALE_AFTER_MS = 10 * 60 * 1000;

export interface PressureVerdict {
    readonly at: number;
    readonly state: string;
    /** The most pressing window, described for a human (`pressure.describeWindow`). */
    readonly line: string;
}

export function pressureStatePath(env?: EnvMap | null): string {
    return write_target(path.join('state', 'quota', 'pressure.json'), { env: env ?? null });
}

/** The window line when a fresh verdict says hot or exhausted; `null` otherwise. */
export function hotWindowLine(env?: EnvMap | null, now: number = Date.now()): string | null {
    try {
        const v = JSON.parse(fs.readFileSync(pressureStatePath(env), 'utf-8')) as Partial<PressureVerdict>;
        if (typeof v.at !== 'number' || now - v.at > STALE_AFTER_MS) return null;
        return (v.state === 'hot' || v.state === 'exhausted') && typeof v.line === 'string' ? v.line : null;
    } catch {
        return null;
    }
}
