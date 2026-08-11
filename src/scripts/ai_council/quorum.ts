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
    /**
     * `concluded` when `present >= threshold` AND no gate-class attendance
     * floor held the pass; `inconclusive` otherwise. Deliberately still a
     * two-value union: `council_cli.ts::_deserialise_quorum` hard-validates
     * this exact literal pair, so a third status would be a breaking change.
     * The floor's own outcome is `heldByFloor` below, not a third status.
     */
    readonly status: QuorumStatus;
    /** The concrete k this pass needed, after resolving `setting` against `total`. */
    readonly threshold: number;
    /** Total enabled members configured for this pass — the `n`. */
    readonly total: number;
    /** Members that actually produced a usable response. */
    readonly present: number;
    /**
     * `true` only in the third outcome ADR-224 names: the threshold WAS met,
     * and a gate-class attendance floor held the pass anyway. `false` both for
     * an ordinary `concluded` and for a threshold that was never met —
     * "held by the floor" and "did not reach quorum" are semantically
     * different, and collapsing them into one `inconclusive` loses the only
     * measurement that could later justify or retire the floor.
     */
    readonly heldByFloor: boolean;
}

/**
 * A gate-class attendance floor: the minimum number of *present* members a
 * pass must have before its conclusion carries a gate, independent of the
 * `ceil(n / 2)` threshold.
 *
 * Supplying one to `evaluateQuorum` IS the gate-class declaration — see that
 * function's docstring for why the class is caller-declared rather than
 * inferred or configured.
 */
export interface AttendanceFloor {
    readonly minPresent: number;
}

/**
 * The floor ADR-224 authorized: `min_present: 2`, so a gate-class pass never
 * carries a gate on a single voice.
 *
 * A constant rather than a config key, deliberately. The council roster lives
 * in the **user-global** `~/.event4u/agent-config/settings/.ai-council.yml`
 * (ADR-104), so a configurable floor would be present or absent per operator
 * machine with no signal when it is absent — which is the exact objection that
 * rejected ADR-224's alternative (a) ("a protection whose absence is invisible
 * is worse than a narrower one that is present everywhere"). A caller declares
 * *whether* a pass is gate-class; it does not get to negotiate the magnitude
 * down to 1 and thereby disable the floor silently.
 */
export const GATE_CLASS_ATTENDANCE_FLOOR: AttendanceFloor = Object.freeze({ minPresent: 2 });

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
 * Resolve an attendance floor into the concrete minimum it enforces.
 *
 * Only the LOWER bound is clamped (`>= 1`), and the asymmetry against
 * `resolveQuorumThreshold` — which clamps its threshold into `[1, total]` — is
 * deliberate rather than an oversight. A *threshold* above `total` would make a
 * pass structurally unwinnable, which is a misconfiguration, so it is clamped
 * down. A *floor* above `total` being unwinnable is the floor doing its job: a
 * council with fewer present members than a gate requires must hold the gate,
 * not pass it because the requirement was quietly lowered to fit the roster.
 *
 * A malformed floor throws rather than degrading to "no floor". A safety floor
 * that fails open on a caller bug is worse than one that fails loudly — the
 * absence would be invisible at exactly the call sites that asked for it.
 */
function _resolveAttendanceFloor(floor: AttendanceFloor): number {
    const { minPresent } = floor;
    if (!Number.isInteger(minPresent) || minPresent < 1) {
        throw new RangeError(
            `evaluateQuorum: floor.minPresent must be an integer >= 1 (got ${minPresent}).`,
        );
    }
    return minPresent;
}

/**
 * Evaluate whether a pass met quorum.
 *
 * `present` is clamped into `[0, total]` before comparison — a caller that
 * miscounts (more "present" than were ever configured) cannot manufacture a
 * `concluded` verdict past what `total` actually allows.
 *
 * ## The gate-class attendance floor (ADR-224)
 *
 * `floor` is the fourth argument and defaults to `null`, which reproduces the
 * pre-ADR-224 behaviour byte-for-byte. Three properties of that shape are
 * decisions, not conveniences:
 *
 * - **Gate-class is caller-DECLARED, never inferred.** Passing a floor is the
 *   declaration. The two rejected alternatives were inference from the
 *   invocation context — which silently reclassifies passes whenever that
 *   context changes shape, and cannot work at all at the pre-run call site,
 *   where `lens` and `invocation` are empty by construction — and a config key,
 *   which inherits ADR-104's user-global config and so varies per operator
 *   machine (see `GATE_CLASS_ATTENDANCE_FLOOR`).
 * - **Default OFF for an un-instrumented call site.** The accepted failure mode,
 *   named here because it is the one this default buys: the floor protects only
 *   where a caller opts in, and **as of 2026-08-11 no caller in this repository
 *   does** — the closest candidate, `legal_review_prep.require_council`, is a
 *   model-carried obligation stated in a rule and a skill, with no code path
 *   that reads it. So this ships as an inert capability, deliberately and
 *   visibly, rather than as a floor that quietly changes every advisory pass
 *   ADR-224 promised not to touch. `quorum-attendance-budget.json` carries the
 *   same statement as a registered honest gap, so the inertness is falsifiable
 *   rather than folklore.
 * - **Default ON once declared.** A declared gate-class pass is floored
 *   immediately; there is no second enable flag. Requiring two independent
 *   opt-ins would produce a mechanism overwhelmingly likely never to fire,
 *   which is the ceremonial-compliance outcome an AI council flagged 2/2 when
 *   asked to review this design.
 */
export function evaluateQuorum(
    total: number,
    present: number,
    setting: QuorumSetting = 'majority',
    floor: AttendanceFloor | null = null,
): QuorumResult {
    const threshold = resolveQuorumThreshold(total, setting);
    const clampedPresent = Math.min(Math.max(present, 0), total);
    const metThreshold = clampedPresent >= threshold;
    // Validated whenever a floor is SUPPLIED, never only when it would fire —
    // otherwise a malformed floor throws or passes depending on the pass's own
    // outcome, which makes a caller bug reproducible only on some attendances.
    const minPresent = floor === null ? null : _resolveAttendanceFloor(floor);
    const heldByFloor = metThreshold && minPresent !== null && clampedPresent < minPresent;
    const status: QuorumStatus = metThreshold && !heldByFloor ? 'concluded' : 'inconclusive';
    return { status, threshold, total, present: clampedPresent, heldByFloor };
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
 * ONE such record exists, and it is deliberately narrow: ADR-224
 * (`docs/decisions/ADR-224-gate-scoped-solo-attendance-floor.md`) authorizes a
 * `min_present: 2` floor to branch on this predicate **for gate-class passes
 * only**, decided against a measured 12.5 % solo-conclusion rate.
 *
 * **That floor has now landed, and it does NOT use this predicate** — so the
 * paragraph above still describes the code exactly. `evaluateQuorum`'s
 * `AttendanceFloor` compares `present` against a minimum directly, which
 * subsumes the solo case without consuming the authorization: the predicate
 * stays advisory-render-and-telemetry-only, and ADR-224's permission to branch
 * on it remains unspent. A future reader who needs to branch on solo status
 * therefore still needs their own record; nothing here has been widened for
 * them.
 *
 * One consequence worth knowing before reading attendance data: a gate-class
 * pass held by the floor resolves `inconclusive`, so this predicate returns
 * `false` for it and the `solo` field on its `quorum_result` line is `false`.
 * The solo-conclusion rate therefore DEFLATES exactly as the floor starts
 * firing — which is why `held_by_floor` is its own event field and its own
 * registered metric rather than an afterthought. The two are successor
 * instruments, not duplicates.
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
