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

export function observeStrike(
    consumer_root: string,
    envelope: Dict,
    event: { readonly isEdit: boolean; readonly run: Dict | null },
    now: string = new Date().toISOString(),
): void {
    // `run` is the record the recorder appended for THIS event, handed over by
    // the recorder itself — never looked up in its state, where an earlier
    // event's record of the same command would be indistinguishable.
    const run = event.run !== null && typeof event.run['command'] === 'string' ? (event.run as unknown as RunRecord) : null;
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
                // Expire BEFORE the fold — a streak past the TTL must not be
                // revived by this event — and cap AFTER it, so what is written
                // honours the bounds.
                let ledger = pruneLedger(coerceLedger(loaded), now);
                if (event.isEdit) ledger = recordEdit(ledger, agent, now);
                if (run !== null) ledger = observeRun(ledger, run, { agent, now, platform }).ledger;
                return pruneLedger(ledger, now);
            },
            { blocking: false },
        );
    } catch {
        // Shadow: a ledger failure is invisible to the recorder by design.
    }
}
