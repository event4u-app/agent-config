/**
 * Quota exhaustion carries across the rounds of one invocation.
 *
 * A subscription seat that answered `cli_quota_exhausted` in round 1 stays
 * exhausted for the rest of the run: provider windows reset on the order of
 * hours, a council run lasts minutes. Asking it again every round and again in
 * peer review spends a spawn, a re-sent prompt and a timeout slot per call, to
 * collect the same refusal. The seat is therefore skipped after its first
 * refusal and answered with a placeholder that keeps its row — and the reason —
 * in the rendered output, so nothing reads as a seat that never existed.
 *
 * Keyed by member name, not name+model: a subscription quota belongs to the
 * account behind the provider, so every seat of that provider is out with it.
 */
import type { ExternalAIClient } from './clients.js';
import { CouncilResponse } from './clients.js';

export const QUOTA_EXHAUSTED = 'cli_quota_exhausted';
/** Set on an answered response whose seat hit the quota on a later call (a stance repair). */
export const QUOTA_EXHAUSTED_MARK = 'quota_exhausted_after';

export function quotaExhaustedNames(results: readonly CouncilResponse[]): Set<string> {
    const names = new Set<string>();
    for (const r of results) {
        if (r.error === QUOTA_EXHAUSTED || r.metadata[QUOTA_EXHAUSTED_MARK] === true) names.add(r.provider);
    }
    return names;
}

export function skippedForQuota(member: ExternalAIClient): CouncilResponse {
    return new CouncilResponse({
        provider: member.name,
        model: member.model,
        text: '',
        error: QUOTA_EXHAUSTED,
        metadata: { transport: member.transport, quota_carried: true, not_called: true },
    });
}

/**
 * Run `run` over the members that are not exhausted and splice a placeholder
 * in for each exhausted one, preserving member order — callers index results
 * by member position.
 */
export function runSkippingExhausted(
    members: readonly ExternalAIClient[],
    exhausted: ReadonlySet<string>,
    run: (live: ExternalAIClient[]) => CouncilResponse[],
): CouncilResponse[] {
    if (exhausted.size === 0) return run([...members]);
    const live = members.filter((m) => !exhausted.has(m.name));
    const liveResults = live.length > 0 ? run(live) : [];
    if (liveResults.length !== live.length) {
        throw new Error(`quota_carry: ${live.length} live seat(s) but ${liveResults.length} response(s) — positions would shift`);
    }
    const out: CouncilResponse[] = [];
    let i = 0;
    for (const m of members) {
        if (exhausted.has(m.name)) {
            out.push(skippedForQuota(m));
        } else {
            out.push(liveResults[i++] as CouncilResponse);
        }
    }
    return out;
}
