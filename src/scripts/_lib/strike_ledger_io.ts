/**
 * Persisting the strike ledger from the verification recorder.
 *
 * Kept apart from the pure fold in `strike_ledger.ts` so the fold is testable
 * without a filesystem, and so the recorder carries one call rather than the
 * ledger's I/O. Every failure here is swallowed: the ledger is shadow
 * instrumentation and must never change what the recorder does or returns.
 */
import path from 'node:path';

import { update_json_under_lock } from '../hooks/state_io.js';
import {
    STRIKE_LEDGER_FILE,
    coerceLedger,
    observeRun,
    pruneLedger,
    recordEdit,
    type StrikeLedger,
} from './strike_ledger.js';
import type { RunRecord } from './verification_evidence.js';

type Dict = Record<string, unknown>;

/**
 * Who made the attempt. A subagent's payload names it; everything else is the
 * main session. Parallel subagents must not count each other's strikes.
 */
export function strikeAgent(envelope: Dict): string {
    const pl = envelope['payload'];
    const payload = typeof pl === 'object' && pl !== null && !Array.isArray(pl) ? (pl as Dict) : {};
    for (const v of [payload['agent_id'], payload['agentId'], envelope['agent_id']]) {
        if (typeof v === 'string' && v.trim() !== '') return v.trim();
    }
    return 'main';
}

/** The run the recorder appended for this event, if it appended one. */
function lastRun(state: Dict): RunRecord | null {
    const runs = state['verification_runs'];
    if (!Array.isArray(runs) || runs.length === 0) return null;
    const last = runs[runs.length - 1] as unknown;
    if (typeof last !== 'object' || last === null) return null;
    const r = last as Dict;
    return typeof r['command'] === 'string' ? (r as unknown as RunRecord) : null;
}

export function observeStrike(
    consumer_root: string,
    envelope: Dict,
    state: Dict,
    event: { readonly isEdit: boolean; readonly recorded: boolean },
    now: string = new Date().toISOString(),
): void {
    if (!event.isEdit && !event.recorded) return;
    const run = event.recorded ? lastRun(state) : null;
    if (!event.isEdit && run === null) return;
    const platform = typeof envelope['platform'] === 'string' ? envelope['platform'] : 'unknown';
    try {
        update_json_under_lock<StrikeLedger>(path.join(consumer_root, STRIKE_LEDGER_FILE), (loaded) => {
            let ledger = pruneLedger(coerceLedger(loaded), now);
            if (event.isEdit) ledger = recordEdit(ledger);
            if (run !== null) {
                ledger = observeRun(ledger, run, { agent: strikeAgent(envelope), now, platform }).ledger;
            }
            return ledger;
        });
    } catch {
        // Shadow: a ledger failure is invisible to the recorder by design.
    }
}
