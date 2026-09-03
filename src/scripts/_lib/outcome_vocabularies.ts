/**
 * The three outcome vocabularies this repository actually produces, and the
 * one crossing between them — in a single module, so a fourth cannot appear
 * without a diff to this file.
 *
 * `road-to-experience-loop-broadening` step 1.3. That step was written on the
 * premise that the tree holds **two** outcome enums and that one of them is
 * documentation-only. Re-measured at `63d06b7eb`, both halves of that premise
 * are wrong, and the corrected picture is why this module registers rather
 * than unifies:
 *
 * | Vocabulary | Subject | Declared | Values |
 * |---|---|---|---|
 * | phase | one audit-log line — a `/work` PHASE | here, consumed by `orchestration_record` | 4 |
 * | step  | one work-engine STEP | `work_engine/delivery_state.ts` (template tree) | 3 |
 * | run   | one command or gate RUN | here, consumed by `outcome_envelope` | 7 |  code-comment-allow report-comment -- one row of a pre-existing three-row table documenting the three vocabularies; the digit changed from 6 to 7 with the vocabulary, and the table is the registry's whole point
 *
 * All three are declared in code AND emitted today. `skipped` and `error` are
 * not aspirational: `envelopeOutcome` in `orchestration_record.ts` returns
 * both, and `review_skipped_record.ts` writes `outcome: 'skipped'` onto a real
 * audit line. An earlier reading of this tree concluded they "exist nowhere",
 * because it grepped for enum MEMBER ASSIGNMENTS (`SKIPPED: 'skipped'`) and
 * these are string-literal union members. The distinction cost a wrong premise
 * once; it is written down here so it cannot cost it twice.
 *
 * **Why register and not unify.** AI council 2026-08-29 (anthropic + openai,
 * 2 rounds, $0.00, both seats subscription-authed) split on the question and
 * named the same discriminator: trace the producers before choosing. The trace
 * settled it — the three subjects are genuinely different (a phase aggregates
 * steps; a run is neither), all three are produced, and a cross-domain mapping
 * already existed in the tree. A superset would admit states that are
 * nonsense for their subject: a step ending `approval-required`, a run ending
 * `partial`. So: separate vocabularies, one registry, mappings only where
 * execution actually crosses.
 *
 * **Mappings are not written for symmetry.** Two crossings exist, and both are
 * places where execution actually translates: `DispatchOutcome` -> phase in
 * `orchestration_record.ts`, and `LadderAction` -> run in
 * `continuation_ladder.ts` (added 2026-09-03 with the seventh run state, so the
 * state has a producer rather than being a word nothing emits). A total
 * phase<->step<->run mapping would be nine relations of which two are real, and
 * the seven invented ones would read as contract.
 *
 * `revisit-if`: a producer needs a value its vocabulary cannot express, or a
 * second real crossing appears, or producer analysis shows two of the three
 * subjects share identical terminal semantics with a lossless mapping — at
 * which point unifying those two becomes the cheaper answer.
 *
 * **The run vocabulary grew to seven on 2026-09-03** — exactly the first branch
 * of the reopening condition above: the continuation ladder needed a word for a
 * run whose plan premise moved, and had none. AI council (anthropic/claude-sonnet-4-5 +
 * openai/codex-default, three rounds, blind chairman) resolved it unanimously
 * as option (a), extend rather than overload `blocked` with a reason field. The
 * seats attached the same prerequisites, discharged here: a versioned value
 * domain ({@link RUN_TERMINAL_VOCABULARY_VERSION}), a tolerant read
 * ({@link readRunTerminalState}), a declared downgrade
 * ({@link RUN_TERMINAL_STATE_DOWNGRADE}) and the rollback trigger below.
 *
 * **Rollback trigger, stated rather than instrumented.** Withdraw
 * `premise-invalidated` — remove it from {@link RUN_TERMINAL_STATES} and let the
 * ladder rung report its declared downgrade `blocked` instead — on EITHER of:
 * (1) any consumer is observed failing (a throw, a refused write, a dropped
 * record) on encountering the value, or (2) `readRunTerminalState` returns
 * `null` for a persisted value in normal operation, which would mean a writer
 * emitted something this registry does not know. Both are single-occurrence
 * triggers, not rates: the downgrade mapping already exists, so withdrawal
 * costs one commit and no migration, and there is no reason to tolerate a
 * budget of failures before paying that. No telemetry is built for this and
 * none is claimed — condition (1) surfaces as a failing run and (2) as a null
 * where a value was written.
 *
 * Type-only + literal arrays. No `node:` import, so any surface may read it.
 */

/**
 * Outcome of one audit-log line — a `/work` phase.
 *
 * Authoritative for `docs/contracts/audit-log-v1.md`'s `outcome` row. The
 * binding is a test, not an import, because a markdown contract cannot import:
 * `tests/contracts/outcome_vocabularies.test.ts`.
 */
export const PHASE_OUTCOMES = ['success', 'blocked', 'skipped', 'error'] as const;
export type PhaseOutcome = (typeof PHASE_OUTCOMES)[number];

/**
 * Outcome of one work-engine step.
 *
 * Declared in `src/agent-src/templates/scripts/work_engine/delivery_state.ts`,
 * which is a TEMPLATE and self-contained by contract — no template file
 * imports from `src/scripts/`. So this is the lint-checked mirror, not the
 * declaration, and the same test asserts the two agree.
 */
export const STEP_OUTCOMES = ['success', 'blocked', 'partial'] as const;
export type StepOutcome = (typeof STEP_OUTCOMES)[number];

/**
 * Terminal state of one command or gate run.
 *
 * Authoritative for `contexts/execution/terminal-states.md`. Re-exported by
 * `outcome_envelope.ts` as `TerminalState`, which stays the public surface —
 * `runtime_journal.test.ts` pins that import path, and an anti-fork assertion
 * there already prevents a second declaration.
 */
export const RUN_TERMINAL_STATES = [
    'success',
    'clean-no-op',
    'blocked',
    'approval-required',
    'exhausted',
    'stagnated',
    /**
     * The plan premise this run was built on no longer holds — the situational
     * -awareness fingerprint the run engaged under (`origin/main` plus every open
     * PR head) was re-observed and differs.
     *
     * Added by `road-to-wired-instruments` Phase 2 under the AI-council decision
     * of 2026-09-03 (option (a), unanimous). It is NOT `blocked` with a reason
     * field: premise invalidation is operationally distinct from a missing
     * precondition and from an exhausted budget, and folding it into either loses
     * both aggregation by state and type-enforced exhaustive handling. The
     * remedy differs too — re-probe and re-plan, where `blocked` says obtain the
     * missing thing and `exhausted` says the budget was too small.
     */
    'premise-invalidated',
] as const;
export type RunTerminalState = (typeof RUN_TERMINAL_STATES)[number];

/**
 * Version of the RUN vocabulary's VALUE DOMAIN — bumped when a member is added
 * or removed, never for prose.
 *
 * Distinct from any table version: `runtime_journal.JOURNAL_SCHEMA_VERSION`
 * covers tables and columns and is unaffected by a widening of what one column
 * may contain, so a value-domain change needs its own number or it travels
 * unversioned. A persisted shape carrying a `RunTerminalState` stamps THIS
 * number beside the value, so a reader can tell a value it does not know from a
 * value that is corrupt.
 *
 * v1 — the six original states.
 * v2 — adds `premise-invalidated` (2026-09-03).
 */
export const RUN_TERMINAL_VOCABULARY_VERSION = 2;

/** The vocabulary version each member first appeared in. */
export const RUN_TERMINAL_STATE_SINCE: Readonly<Record<RunTerminalState, number>> = {
    success: 1,
    'clean-no-op': 1,
    blocked: 1,
    'approval-required': 1,
    exhausted: 1,
    stagnated: 1,
    'premise-invalidated': 2,
};

/**
 * What a consumer pinned to an older vocabulary version reports instead.
 *
 * `premise-invalidated` -> `blocked`: of the six v1 states it is the only one
 * that is honest for a reader that cannot represent it — the run stopped on an
 * external condition it cannot resolve by iterating. Mapping it to `exhausted`
 * would invite the wrong remedy (raise the budget), which is the exact
 * confusion the contract's own `exhausted`/`stagnated` split exists to prevent.
 *
 * Every member introduced after v1 MUST have a row here; `outcome_vocabularies`
 * contract tests assert that, so a future eighth value cannot ship undowngradable.
 */
export const RUN_TERMINAL_STATE_DOWNGRADE: Readonly<Partial<Record<RunTerminalState, RunTerminalState>>> = {
    'premise-invalidated': 'blocked',
};

/**
 * The state a consumer pinned at `toVersion` should report for `state`.
 *
 * Returns the state unchanged when it already existed at that version, the
 * declared downgrade when it did not, and `null` for a string this vocabulary
 * does not know at all — never a throw, because this is the function a reader
 * of PERSISTED data calls, and persisted data outlives the code that wrote it.
 */
export function downgradeRunTerminalState(
    state: string,
    toVersion: number,
): RunTerminalState | null {
    if (!isRunTerminalState(state)) return null;
    if ((RUN_TERMINAL_STATE_SINCE[state] ?? 1) <= toVersion) return state;
    return RUN_TERMINAL_STATE_DOWNGRADE[state] ?? null;
}

/**
 * Tolerant read of a persisted terminal state: a member returns itself,
 * anything else returns `null`. Never throws.
 *
 * `null` rather than a fabricated fallback is the load-bearing choice. This
 * vocabulary's own consumers already treat a null terminal state as "not
 * recorded" (`repeated_failure` counts it under `unknown`), and that is exactly
 * what an unrecognised value IS to a reader that cannot name it. Substituting
 * `blocked` here would manufacture a measurement out of an absence — the
 * downgrade above is for a value the reader KNOWS is newer, which is a
 * different fact from a value it cannot place.
 */
export function readRunTerminalState(v: unknown): RunTerminalState | null {
    return isRunTerminalState(v) ? v : null;
}

/**
 * The crossings that exist. One row, because one crossing is real.
 *
 * Read as: code at `from` translates a value of `source` into a value of
 * `target`. A row is added when execution starts crossing, never in advance.
 */
export const CROSS_DOMAIN_MAPPINGS = [
    {
        source: 'DispatchOutcome',
        target: 'phase',
        at: 'src/scripts/_lib/orchestration_record.ts',
        fn: 'envelopeOutcome',
        /**
         * The mapping is VERSIONED as of 2026-08-30
         * (road-to-experience-loop-broadening 2.2). Version 1 was
         * unconditional: DONE / DONE_WITH_CONCERNS always became `success`.
         * Version 2 is contract-gated -- a `code-change` dispatch claiming
         * success with a MEASURED empty diff no longer does.
         *
         * Recorded here rather than only at the call site because this registry
         * is the one place a reader looks to learn that a crossing exists, and a
         * crossing whose semantics changed silently is worse than one nobody
         * documented. Lines carry `outcome_semantics`; an absent field is
         * version 1.
         */
        semantics_version: 2,
    },
    {
        source: 'LadderAction',
        target: 'run',
        at: 'src/scripts/_lib/continuation_ladder.ts',
        fn: 'terminalStateFor',
        /**
         * Version 1, and the mapping is TOTAL over `LadderAction` by
         * construction: `TERMINAL_STATE_BY_ACTION` is a `Record<LadderAction,
         * RunTerminalState | null>`, so adding a rung without deciding its
         * terminal state does not compile. `engage` maps to null because it is
         * the one action that is not terminal.
         */
        semantics_version: 1,
    },
] as const;

/** Is this string a phase outcome? The guard the audit-log consumer was missing. */
export function isPhaseOutcome(v: unknown): v is PhaseOutcome {
    return typeof v === 'string' && (PHASE_OUTCOMES as readonly string[]).includes(v);
}

/** Is this string a run terminal state? */
export function isRunTerminalState(v: unknown): v is RunTerminalState {
    return typeof v === 'string' && (RUN_TERMINAL_STATES as readonly string[]).includes(v);
}
