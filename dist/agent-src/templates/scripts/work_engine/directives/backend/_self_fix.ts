/**
 * Bounded self-fix loop — the shared primitive behind the red-check lanes.
 *
 * The gap this closes, verified in code before it was built: `test` and
 * `verify` both halt to `Outcome.BLOCKED` the instant their recorded verdict
 * is not `success`, and neither carries an attempt counter. The halt surface
 * they emit is a *user* question block with no `@agent-directive:` line, so a
 * red check the agent could have fixed unaided still costs a user round-trip.
 *
 * What this module adds is a counter and two floors — nothing else. It
 * deliberately adds **no critic**: the verdict is already a deterministic
 * value the engine holds in hand, so there is no judgement for a second model
 * to make. That distinction is why the TERMINAL honest null on
 * `recursive-verification` (ADR-106: capability 87% vs 87%, McNemar p=1.0)
 * does not bind here — the measured arm added a critic to decide whether an
 * attempt was good enough, and its killer finding was that cost scaled with
 * *all* tasks while benefit sat in the ~28% tail. A red-check retry fires only
 * on a red: zero cost on the passing majority.
 *
 * The null does bind one thing, and it is honoured: the falsification shape.
 * "The loop is redundant" must remain discoverable, so the loop never converts
 * a red into a green. Every exit it owns is `PARTIAL` with the red verdict
 * still on the surface.
 *
 * Two floors, neither invented here:
 *
 * - **Ceiling** — {@link SELF_FIX_CEILING} attempts per lane, which is the
 *   N=3 validation-loop budget from the `autonomous-execution` rule, applied
 *   per validation target (that rule resets its counter on a different
 *   target, so the counters below are per-lane rather than per-run).
 * - **No-progress** — two consecutive attempts producing an identical verdict
 *   signature stop the loop immediately, budget remaining or not. This is the
 *   floor the `recursive-verification` skill already stated in prose ("two
 *   consecutive attempts score identical on the deterministic scorer; further
 *   depth cannot help, so stop"), adopted as code rather than left as advice,
 *   and it matches `context-hygiene`'s "same failure signature twice → stop
 *   and pivot now".
 *
 * No-progress is checked BEFORE the ceiling on purpose: an unchanged signature
 * means the remaining budget cannot help, so spending it would be the exact
 * wasted-attempt pattern both rules name.
 */

import type { DeliveryState } from '../../delivery_state.js';
import { type Any, Outcome, StepResult, agent_directive } from '../../delivery_state.js';

/**
 * Attempts allowed per lane before the loop exits PARTIAL.
 *
 * Deliberately the `autonomous-execution` N=3 budget rather than a fresh
 * number: a second, differently-sized retry ceiling in the same package would
 * be a rule the tree contradicts.
 */
export const SELF_FIX_CEILING = 3;

/** Lanes that own a bounded loop. One counter each — they are distinct targets. */
export const SELF_FIX_LANES = ['test', 'verify'] as const;

export type SelfFixLane = (typeof SELF_FIX_LANES)[number];

/**
 * Keys excluded from the verdict signature at every depth.
 *
 * Without this the no-progress floor could never fire: a test verdict carries
 * `duration_ms`, which changes on every run, so two byte-identical failures
 * would sign differently and the loop would burn its whole budget on a target
 * it was making no progress against.
 */
export const VOLATILE_KEYS: ReadonlyArray<string> = [
    'duration_ms',
    'elapsed_ms',
    'timestamp',
    'started_at',
    'finished_at',
    'ran_at',
];

/** Why the loop stopped, or that it has budget left. */
export type SelfFixKind = 'retry' | 'exhausted' | 'no_progress';

/** Verdict of {@link decide} — pure, so the caller owns every mutation. */
export interface SelfFixDecision {
    kind: SelfFixKind;
    /** Attempts already spent on this lane before this decision. */
    attempts: number;
    /** 1-based number of the attempt a `retry` authorises. */
    next_attempt: number;
    ceiling: number;
    signature: string;
}

/**
 * Canonical, volatile-free signature of a recorded verdict.
 *
 * Two failures are "the same failure" when this string matches. Object keys
 * are sorted so key order in the recorded state cannot masquerade as progress.
 */
export function verdict_signature(lane: string, verdict_payload: Any): string {
    return `${lane}:${_canonical(verdict_payload)}`;
}

/** Read the per-lane counter without mutating anything. */
export function decide(state: DeliveryState, lane: string, signature: string): SelfFixDecision {
    const lane_state = _lane_state(state, lane);
    const attempts = _nonNegativeInt(lane_state['attempts']);
    const signatures = Array.isArray(lane_state['signatures'])
        ? (lane_state['signatures'] as Any[]).filter((s): s is string => typeof s === 'string')
        : [];
    const previous = signatures.length > 0 ? signatures[signatures.length - 1] : null;

    const base = {
        attempts,
        next_attempt: attempts + 1,
        ceiling: SELF_FIX_CEILING,
        signature,
    };

    // No-progress before the ceiling: an unchanged signature means the
    // remaining budget cannot move this target, so spending it is waste.
    if (previous !== null && previous === signature) {
        return { kind: 'no_progress', ...base };
    }
    if (attempts >= SELF_FIX_CEILING) {
        return { kind: 'exhausted', ...base };
    }
    return { kind: 'retry', ...base };
}

/**
 * Spend one attempt on `lane` and remember its signature.
 *
 * Mutates `state.self_fix` in place, which is how the counter survives the
 * halt: the dispatcher persists the state it was handed, so the next
 * invocation reads the incremented value. Callers must invoke this exactly
 * once per `retry` decision — recording on an exit would inflate the count.
 */
export function record_attempt(state: DeliveryState, lane: string, signature: string): void {
    const container = _pyTruthy(state.self_fix) ? (state.self_fix as Record<string, Any>) : {};
    const lane_state = _lane_state(state, lane);
    const signatures = Array.isArray(lane_state['signatures'])
        ? (lane_state['signatures'] as Any[]).filter((s): s is string => typeof s === 'string')
        : [];
    container[lane] = {
        attempts: _nonNegativeInt(lane_state['attempts']) + 1,
        signatures: [...signatures, signature],
    };
    state.self_fix = container;
}

/** DoD entries the agent has not recorded as proven. Never inferred. */
export function unmet_dod(state: DeliveryState): Array<Record<string, Any>> {
    const dod = (state.ticket ?? {})['dod'];
    if (!Array.isArray(dod)) {
        return [];
    }
    return (dod as Any[]).filter(
        (item): item is Record<string, Any> => _isPlainObject(item) && item['proven'] !== true,
    );
}

/**
 * BLOCKED halt that delegates the fix instead of asking the user.
 *
 * The `@agent-directive:` first line is what makes this an agent round-trip
 * rather than a user one — the same delegation shape `run-tests` and
 * `review-changes` already use. The numbered options stay, because an
 * orchestrator that does not honour directives must still leave the human
 * something to act on.
 */
export function retry_halt(args: {
    lane: string;
    ticket_id: string;
    verdict: Any;
    decision: SelfFixDecision;
    fix_hint: string;
    rerun_directive: string;
}): StepResult {
    const { lane, ticket_id, verdict, decision, fix_hint, rerun_directive } = args;
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('fix-failing-checks', {
                ticket: ticket_id,
                lane,
                attempt: decision.next_attempt,
                ceiling: decision.ceiling,
            }),
            `> Ticket ${ticket_id} — \`${lane}\` reported \`${String(verdict)}\`. ` +
                `Self-fix attempt ${decision.next_attempt} of ${decision.ceiling}.`,
            `> The verdict is deterministic, so the fix is delegated rather than asked: ${fix_hint}`,
            `> 1. Continue — fix the failures and re-run \`${rerun_directive}\``,
            '> 2. Abort — stop this cycle and hand the failures back',
        ],
        message:
            `Ticket ${ticket_id} ${lane} verdict was \`${String(verdict)}\`; ` +
            `self-fix attempt ${decision.next_attempt}/${decision.ceiling} delegated.`,
    });
}

/**
 * PARTIAL exit — the loop stopped and the check is STILL RED.
 *
 * `PARTIAL` rather than `BLOCKED` because attempts were spent and changes may
 * have landed, and emphatically not `SUCCESS`: the risk this loop carries is
 * that it converts a visible red into an invisible one, which is worse than
 * the round-trip it removes. The dispatcher halts on PARTIAL exactly as it
 * halts on BLOCKED, and the red verdict is the second line of the surface.
 */
export function partial_exit(args: {
    lane: string;
    ticket_id: string;
    verdict: Any;
    decision: SelfFixDecision;
    unmet: Array<Record<string, Any>>;
    rerun_directive: string;
}): StepResult {
    const { lane, ticket_id, verdict, decision, unmet, rerun_directive } = args;
    const reason =
        decision.kind === 'no_progress'
            ? `two consecutive attempts produced an identical \`${lane}\` verdict, ` +
              'so further attempts cannot help'
            : `the ${decision.ceiling}-attempt budget for \`${lane}\` is spent`;
    const dod_lines =
        unmet.length > 0
            ? [
                  '> Definition-of-done items still unproven:',
                  ...unmet.map((item) => {
                      const id = typeof item['id'] === 'string' ? item['id'] : '(no id)';
                      const check = typeof item['check'] === 'string' ? item['check'] : '(no check)';
                      return `>    - \`${id}\` — \`${check}\``;
                  }),
              ]
            : [];
    return new StepResult({
        outcome: Outcome.PARTIAL,
        questions: [
            `> Ticket ${ticket_id} — self-fix stopped after ` +
                `${decision.attempts} attempt(s): ${reason}.`,
            `> \`${lane}\` is STILL \`${String(verdict)}\`. Nothing here claims completion.`,
            ...dod_lines,
            `> 1. I'll take it from here — hand me the failures and re-run \`${rerun_directive}\``,
            '> 2. Continue anyway — override on a red verdict (NOT recommended)',
            '> 3. Abort',
        ],
        message:
            `Ticket ${ticket_id} ${lane} verdict is \`${String(verdict)}\` after ` +
            `${decision.attempts} self-fix attempt(s) (${decision.kind}); exiting PARTIAL.`,
    });
}

/** Per-lane record, defaulted without writing anything back. */
function _lane_state(state: DeliveryState, lane: string): Record<string, Any> {
    const container = _pyTruthy(state.self_fix) ? (state.self_fix as Record<string, Any>) : {};
    const lane_state = container[lane];
    return _isPlainObject(lane_state) ? lane_state : {};
}

/** Ints only; a bool, float, negative, or non-number resets to 0. */
function _nonNegativeInt(value: Any): number {
    if (typeof value !== 'number' || typeof value === 'boolean') {
        return 0;
    }
    if (!Number.isInteger(value) || value < 0) {
        return 0;
    }
    return value;
}

/**
 * Deterministic JSON rendering with sorted keys and volatile keys removed.
 *
 * Hand-rolled rather than `JSON.stringify`: the replacer form cannot sort
 * object keys, and key order is exactly what must not leak into the signature.
 */
function _canonical(value: Any): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
        return String(value);
    }
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _canonical(v)).join(',') + ']';
    }
    if (_isPlainObject(value)) {
        const keys = Object.keys(value)
            .filter((k) => !VOLATILE_KEYS.includes(k))
            .sort();
        return '{' + keys.map((k) => `${JSON.stringify(k)}:${_canonical(value[k])}`).join(',') + '}';
    }
    return JSON.stringify(String(value));
}

/** Python truthiness for the container kinds this module reads. */
function _pyTruthy(value: Any): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length !== 0;
    }
    if (Array.isArray(value)) {
        return value.length !== 0;
    }
    if (value instanceof Set || value instanceof Map) {
        return value.size !== 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as Record<string, Any>).length !== 0;
    }
    return true;
}

/** True for a dict-like value (mirrors Python `isinstance(x, dict)`). */
function _isPlainObject(value: Any): value is Record<string, Any> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof Set) &&
        !(value instanceof Map)
    );
}
