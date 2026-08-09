/**
 * Quorum resolution for a council pass (Phase 3.3 of
 * road-to-always-on-orchestration).
 *
 * A pass concludes when at least `k` of `n` enabled members produced a
 * usable response ("present"); below `k` the pass is `inconclusive`. At a
 * release gate an inconclusive pass HOLDS the gate for a human — it is
 * NEVER silently downgraded to advisory (council-verified, 2026-08-09).
 * Deciding what to DO with an `inconclusive` status (block a merge, retry,
 * surface to the user) is the caller's job; this module only answers
 * whether the threshold was met.
 *
 * `majority` is a SIMPLE majority — `ceil(n / 2)` — deliberately NOT the
 * traditional "more than half" (`floor(n / 2) + 1`). At n=2 those two
 * definitions diverge: `ceil(2/2)=1` vs `floor(2/2)+1=2`. The stricter
 * 2-of-2 reading turns any single absent member into a deadlocked release
 * gate, which is exactly the failure mode council members flagged for the
 * n=2 case this module is built around — 1-of-2 is the deliberate choice,
 * not an off-by-one.
 *
 * This module is pure — no filesystem, no environment, no config parsing.
 * `config.ts::QuorumSetting` is the validated shape a loaded
 * `.ai-council.yml` supplies; a caller reads `cfg.quorum` and passes it
 * straight through to `evaluateQuorum`.
 */

import type { QuorumSetting } from './config.js';

export type QuorumStatus = 'concluded' | 'inconclusive';

export interface QuorumResult {
    /** `concluded` when `present >= threshold`; `inconclusive` otherwise. */
    readonly status: QuorumStatus;
    /** The concrete k this pass needed, after resolving `setting` against `total`. */
    readonly threshold: number;
    /** Total enabled members configured for this pass — the `n`. */
    readonly total: number;
    /** Members that actually produced a usable response. */
    readonly present: number;
}

/**
 * Resolve `setting` into a concrete integer threshold for `total` members.
 *
 * `'majority'` → `ceil(total / 2)` (0 when `total` is 0 — there is nothing
 * to require attendance from). A fixed numeric `setting` is clamped to
 * `[1, total]` so neither a misconfigured cap above `total` (structurally
 * unwinnable) nor one below 1 (would resolve trivially) can escape the
 * config validation `config.ts::_build_quorum` already runs at load time —
 * this is a second, cheap floor for any caller that builds a `QuorumSetting`
 * by hand instead of through the loader.
 */
export function resolveQuorumThreshold(total: number, setting: QuorumSetting = 'majority'): number {
    if (!Number.isInteger(total) || total < 0) {
        throw new RangeError(
            `resolveQuorumThreshold: total must be a non-negative integer (got ${total}).`,
        );
    }
    if (total === 0) {
        return 0;
    }
    if (setting === 'majority') {
        return Math.ceil(total / 2);
    }
    return Math.min(Math.max(setting, 1), total);
}

/**
 * Evaluate whether a pass met quorum.
 *
 * `present` is clamped into `[0, total]` before comparison — a caller that
 * miscounts (more "present" than were ever configured) cannot manufacture a
 * `concluded` verdict past what `total` actually allows.
 */
export function evaluateQuorum(
    total: number,
    present: number,
    setting: QuorumSetting = 'majority',
): QuorumResult {
    const threshold = resolveQuorumThreshold(total, setting);
    const clampedPresent = Math.min(Math.max(present, 0), total);
    const status: QuorumStatus = clampedPresent >= threshold ? 'concluded' : 'inconclusive';
    return { status, threshold, total, present: clampedPresent };
}
