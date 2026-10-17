/**
 * round_reservations — reserve-then-reconcile for one council round
 * (road-to-unknowns-that-say-so Phase 3).
 *
 * Extracted rather than written into `orchestrator.ts`, which sits over the
 * source-size ceiling; the orchestrator calls three methods and nothing else.
 *
 * Inert unless a daily ceiling is set: `reserve` returns `null` without
 * touching the ledger, and `settle` records exactly what the orchestrator
 * recorded before this existed, so with every ceiling at zero the ledger is
 * byte-identical (ADR-279).
 */

import { randomUUID } from 'node:crypto';

import {
    close_reservation,
    record_spend,
    reserve_spend,
} from './budget_guard.js';
import { DEFAULT_CLI_TIMEOUT_SECONDS, type CouncilResponse, type ExternalAIClient } from './clients.js';
import { type CostEstimate } from './pricing.js';
import { _total_usd, type CostBudget } from './spend_gate.js';

/** One hour past the call's own timeout (D8). */
const HOLD_PAST_TIMEOUT_MS = 3_600_000;

/**
 * An error whose outcome nobody knows: the provider may have generated and
 * billed before the connection died. Anything else that fails with no tokens
 * failed before the provider accepted the request — auth, a missing key, a
 * refused connection — and releases its reservation.
 */
const UNKNOWN_OUTCOME = /time[sd]?\s*out|timeout|deadline exceeded|ETIMEDOUT|ECONNRESET|socket hang up|server[_ ]error|overloaded|\b5\d\d\b/iu;

export function outcomeIsUnknown(error: string): boolean {
    return UNKNOWN_OUTCOME.test(error);
}

export class RoundReservations {
    readonly run_id = randomUUID();
    private current: string | null = null;
    private readonly unknown: string[] = [];

    constructor(
        private readonly budget: CostBudget,
        private readonly ledgerPath: string | null = null,
    ) {}

    /**
     * Claim the seat's estimate under the ledger lock. Returns `'daily'` when
     * the ceiling cannot hold it (or the lock cannot be taken — an unchecked
     * ceiling is not that ceiling), `null` when the call may go ahead.
     */
    reserve(est: CostEstimate | null, member: ExternalAIClient): 'daily' | null {
        this.current = null;
        if (this.budget.daily_limit_usd <= 0 || est === null || !est.priced) {
            return null;
        }
        const timeout = (member as { timeout_seconds?: number }).timeout_seconds ?? DEFAULT_CLI_TIMEOUT_SECONDS;
        const res = reserve_spend(this.budget.daily_limit_usd, _total_usd(est), member.name, member.model, {
            path: this.ledgerPath,
            run_id: this.run_id,
            hold_ms: timeout * 1000 + HOLD_PAST_TIMEOUT_MS,
        });
        if (!res.ok) return 'daily';
        this.current = res.id;
        return null;
    }

    /**
     * Reconcile the seat's call. Without a reservation this is the ledger write
     * the orchestrator always made. With one: `completed` at the actual amount
     * when tokens came back or no error was raised; `released` when it failed
     * before the provider accepted it; an unknown outcome waits for `finish`.
     */
    settle(response: CouncilResponse, effective: ExternalAIClient, actual: CostEstimate): void {
        const id = this.current;
        this.current = null;
        if (id === null) {
            if (!response.error) {
                record_spend(_total_usd(actual), effective.name, effective.model, {
                    path: this.ledgerPath,
                    cache_read_input_tokens: response.cache_read_input_tokens,
                    cache_creation_input_tokens: response.cache_creation_input_tokens,
                    cache_ttl: '5m',
                    ...(actual.priced ? {} : { unpriced: true, input_tokens: actual.input_tokens, output_tokens: actual.output_tokens }),
                });
            }
            return;
        }
        const tokens = response.input_tokens + response.output_tokens;
        if (!response.error || tokens > 0) {
            close_reservation(id, 'completed', {
                path: this.ledgerPath,
                usd: _total_usd(actual),
                provider: effective.name,
                model: effective.model,
            });
        } else if (outcomeIsUnknown(String(response.error))) {
            this.unknown.push(id);
        } else {
            close_reservation(id, 'released', { path: this.ledgerPath });
        }
    }

    /** Run end: every reservation still waiting on an outcome closes at its estimate, never zero. */
    finish<T>(passthrough: T): T {
        if (this.current !== null) this.unknown.push(this.current);
        this.current = null;
        for (const id of this.unknown.splice(0)) {
            close_reservation(id, 'unreconciled', { path: this.ledgerPath });
        }
        return passthrough;
    }
}
