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
 * | run   | one command or gate RUN | here, consumed by `outcome_envelope` | 6 |
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
 * **Mappings are not written for symmetry.** Exactly one crossing exists
 * (`DispatchOutcome` -> phase, in `orchestration_record.ts`). A total
 * phase<->step<->run mapping would be nine relations of which one is real, and
 * the eight invented ones would read as contract.
 *
 * `revisit-if`: a producer needs a value its vocabulary cannot express, or a
 * second real crossing appears, or producer analysis shows two of the three
 * subjects share identical terminal semantics with a lossless mapping — at
 * which point unifying those two becomes the cheaper answer.
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
] as const;
export type RunTerminalState = (typeof RUN_TERMINAL_STATES)[number];

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
] as const;

/** Is this string a phase outcome? The guard the audit-log consumer was missing. */
export function isPhaseOutcome(v: unknown): v is PhaseOutcome {
    return typeof v === 'string' && (PHASE_OUTCOMES as readonly string[]).includes(v);
}

/** Is this string a run terminal state? */
export function isRunTerminalState(v: unknown): v is RunTerminalState {
    return typeof v === 'string' && (RUN_TERMINAL_STATES as readonly string[]).includes(v);
}
