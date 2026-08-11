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

/**
 * Did this pass conclude on a single voice?
 *
 * Derived — deliberately NOT a third `QuorumStatus`. `ceil(n / 2)` makes
 * 1-of-2 a legitimate `concluded`, which is the intended behaviour (see the
 * module header); this predicate does not dispute it, it only makes the
 * shape visible so a reader can tell a one-member conclusion from a
 * full-attendance one. Advisory render and telemetry only: no gate reads it,
 * and nothing downstream may branch on it without its own decision record.
 *
 * ONE such record now exists, and it is deliberately narrow: ADR-224
 * (`docs/decisions/ADR-224-gate-scoped-solo-attendance-floor.md`) authorizes a
 * `min_present: 2` floor to branch on this predicate **for gate-class passes
 * only**, decided against a measured 12.5 % solo-conclusion rate. What landed
 * from that authorization is `wouldSoloFloorHold` below, which is a
 * counterfactual and branches nothing — so the sentence above still describes
 * the code: no caller holds a pass on solo status today. It is stated here so
 * a reader finds the authorization instead of re-deriving the prohibition, and
 * so the next branch is visibly a separate argument: the exception is
 * gate-class passes, not solo status generally.
 *
 * `total` is deliberately NOT consulted. A council configured with a single
 * member concludes solo by construction, and that is still a conclusion
 * reached on one voice — collapsing it into "not solo" would hide exactly
 * the passes a solo-conclusion rate is measured to find. A consumer that
 * cares about the distinction reads `result.total` alongside.
 */
export function isSoloConcluded(result: QuorumResult): boolean {
    return result.status === 'concluded' && result.present === 1;
}

/**
 * The floor value ADR-224 named: a gate-class pass wants at least two voices.
 *
 * A constant rather than a bare `2` at the call site so the shadow telemetry
 * below and any future enforcement read the same number, and so changing it
 * is one edit with one place to argue about.
 */
export const SOLO_FLOOR_MIN_PRESENT = 2;

/**
 * WOULD a `min_present` floor have held this pass? Counterfactual only — this
 * predicate changes nothing and no caller branches on it to hold a gate.
 *
 * ADR-224 chose a gate-scoped `min_present: 2` floor against a solo-conclusion
 * rate of 1 of 8 passes, whose 95 % interval spans roughly 0.3 %–53 %. Two
 * facts, both read off the tree rather than assumed, decided that what lands
 * first is the measurement and not the enforcement:
 *
 *  - **Nothing in the tree branches on `QuorumStatus` to hold anything.** The
 *    only non-`quorum.ts` reader of `'inconclusive'` is
 *    `council_cli.ts::_deserialise_quorum`, which validates a persisted string.
 *    An enforced floor would therefore change zero behaviour today — there is
 *    no gate for it to hold — while still being able to hang an advisory pass
 *    the moment a consumer appears.
 *  - **ADR-224's own review trigger (b) is "the gate-class floor lands and its
 *    own fire-rate telemetry accumulates"**, which presumes exactly this
 *    counterfactual is being recorded.
 *
 * So the floor is evaluated on EVERY pass and recorded, never applied. The
 * fire-rate that accumulates from it is what makes the enforcement decision an
 * evidence call later instead of a second point estimate.
 *
 * `minPresent` is clamped into `[1, total]` with the same discipline
 * `resolveQuorumThreshold` applies, and the clamp carries meaning rather than
 * only safety: at `total = 1` it resolves to 1 and the floor never fires, so a
 * council **configured** with one member is not counted as a degraded pass.
 * That is the split `quorum-attendance-budget.json` already insists on for the
 * solo-conclusion rate — a one-member roster and a two-member roster that lost
 * one are different findings, and an unclamped floor would merge them.
 *
 * A pass that never reached `concluded` is not held by the floor: it failed
 * the threshold, which is a different outcome with a different cause. The two
 * are mutually exclusive by construction, which is what makes them readable
 * apart from the event log alone.
 */
export function wouldSoloFloorHold(
    result: QuorumResult,
    minPresent: number = SOLO_FLOOR_MIN_PRESENT,
): boolean {
    if (result.status !== 'concluded') {
        return false;
    }
    const floor = Math.min(Math.max(Math.trunc(minPresent), 1), result.total);
    return result.present < floor;
}
