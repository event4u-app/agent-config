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

/**
 * The run the recorder appended for THIS event: the newest record, and only
 * when it carries this event's command and was written at or after the
 * recorder's own `checked_at` minus the time one update can take. Anything else
 * is a run from an earlier event and is never observed twice.
 */
export function appendedRun(state: Dict, command: string): RunRecord | null {
    const runs = state['verification_runs'];
    if (!Array.isArray(runs) || runs.length === 0) return null;
    const last = runs[runs.length - 1] as unknown;
    if (typeof last !== 'object' || last === null) return null;
    const r = last as Dict;
    if (r['command'] !== command.slice(0, 512)) return null;
    const at = typeof r['at'] === 'string' ? Date.parse(r['at']) : NaN;
    const checked = typeof state['checked_at'] === 'string' ? Date.parse(state['checked_at']) : NaN;
    if (!Number.isFinite(at) || !Number.isFinite(checked) || checked - at > 5_000 || at > checked) return null;
    return r as unknown as RunRecord;
}

export function observeStrike(
    consumer_root: string,
    envelope: Dict,
    state: Dict,
    event: { readonly isEdit: boolean; readonly command: string | null },
    now: string = new Date().toISOString(),
): void {
    const run = event.command !== null ? appendedRun(state, event.command) : null;
    if (!event.isEdit && run === null) return;
    const agent = strikeAgent(envelope);
    const rawPlatform = envelope['platform'];
    const platform = typeof rawPlatform === 'string' && /^[a-z0-9_-]{1,32}$/i.test(rawPlatform) ? rawPlatform : 'unknown';
    try {
        // Non-blocking: a held ledger lock skips this observation rather than
        // delaying the recorder. Shadow data may lose a sample; the hook may not wait.
        update_json_under_lock<StrikeLedger>(
            path.join(consumer_root, STRIKE_LEDGER_FILE),
            (loaded) => {
                let ledger = pruneLedger(coerceLedger(loaded), now);
                if (event.isEdit) ledger = recordEdit(ledger, agent);
                if (run !== null) ledger = observeRun(ledger, run, { agent, now, platform }).ledger;
                return ledger;
            },
            { blocking: false },
        );
    } catch {
        // Shadow: a ledger failure is invisible to the recorder by design.
    }
}
