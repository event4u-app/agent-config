/**
 * Persona policy — behavioural parameters resolved from `state.persona`.
 *
 * TypeScript twin of `work_engine/persona_policy.py` (ADR-200 py2ts Phase 1 —
 * work_engine foundation). Public API names stay snake_case to mirror the
 * Python module 1:1 (per ADR-200 — Python style is part of the contract).
 *
 * Three personas ship today, each keyed by the string already carried
 * on `DeliveryState.persona` (see
 * `docs/contracts/implement-ticket-flow.md#personas`):
 *
 * `senior-engineer`
 *     Default. Runs every step. No test widening.
 * `qa`
 *     Runs every step but widens the `test` scope to the full suite
 *     (`scope=full` in the `run-tests` directive) so regressions
 *     outside the changed paths are caught.
 * `advisory`
 *     Plan-only mode. `implement`, `test`, and `verify` short-
 *     circuit to SUCCESS without doing work — the flow produces a
 *     delivery report whose value is the plan itself, and next-command
 *     suggestions are suppressed (nothing was committed).
 *
 * Unknown persona names fall back to `senior-engineer` rather than
 * raising, so a mistyped value never aborts a run mid-flight. The
 * caller is responsible for validating the string at the state-
 * construction boundary if strict behaviour is needed.
 */

/** Name used when `state.persona` is empty or unrecognised. */
export const DEFAULT_PERSONA = 'senior-engineer';

/**
 * Behavioural flags read by individual step handlers.
 *
 * The Python source is a frozen dataclass; this class mirrors its field
 * order and default values. Instances are treated as read-only configuration
 * (the Python `frozen=True` contract) — `_POLICIES` holds the only instances
 * and callers never mutate them.
 */
export class PersonaPolicy {
    readonly name: string;
    readonly allows_implement: boolean;
    readonly allows_test: boolean;
    readonly allows_verify: boolean;
    readonly widen_tests: boolean;
    readonly suggests_next_commands: boolean;

    constructor(args: {
        name: string;
        allows_implement?: boolean;
        allows_test?: boolean;
        allows_verify?: boolean;
        widen_tests?: boolean;
        suggests_next_commands?: boolean;
    }) {
        this.name = args.name;
        this.allows_implement = args.allows_implement ?? true;
        this.allows_test = args.allows_test ?? true;
        this.allows_verify = args.allows_verify ?? true;
        this.widen_tests = args.widen_tests ?? false;
        this.suggests_next_commands = args.suggests_next_commands ?? true;
        Object.freeze(this);
    }
}

const _POLICIES: Record<string, PersonaPolicy> = {
    'senior-engineer': new PersonaPolicy({ name: 'senior-engineer' }),
    qa: new PersonaPolicy({ name: 'qa', widen_tests: true }),
    advisory: new PersonaPolicy({
        name: 'advisory',
        allows_implement: false,
        allows_test: false,
        allows_verify: false,
        suggests_next_commands: false,
    }),
};

/**
 * Return the policy for `persona`; fall back to the default on miss.
 *
 * `persona` is typed `unknown` because it originates from
 * `DeliveryState.persona` which the Python dataclass declares as `str`
 * but does not enforce — a caller may set it to `None`/`null` while
 * wiring up a partial state in tests.
 */
export function resolve_policy(persona: unknown): PersonaPolicy {
    if (typeof persona === 'string' && persona in _POLICIES) {
        return _POLICIES[persona] as PersonaPolicy;
    }
    return _POLICIES[DEFAULT_PERSONA] as PersonaPolicy;
}

/** Return the persona names shipped today, in insertion order. */
export function known_personas(): string[] {
    return Object.keys(_POLICIES);
}
