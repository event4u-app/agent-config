/**
 * Shared trigger-eval precision/recall floors — single source of truth.
 *
 * Extracted from `src/cli/commands/recordTriggerEval.ts` so the weekly
 * canary rotation (`src/scripts/trigger_eval_rotation.ts`, ADR-118 §4) and
 * the `eval:record` provenance recorder enforce the SAME per-domain floors.
 * Values are unchanged from the recorder's originals (Phase D council
 * verdict — tuned to the trigger pattern each skill shows, not a single
 * global pair): a reference task wants near-perfect precision; a judgment
 * task tolerates a looser one.
 */

export interface TriggerEvalFloor {
    minRecall: number;
    minPrecision: number;
}

/** Universal fallback floor when a skill carries no domain-specific entry. */
export const DEFAULT_FLOOR: TriggerEvalFloor = { minRecall: 1.0, minPrecision: 0.8 };

/** Domain-specific floors; skills absent here fall back to {@link DEFAULT_FLOOR}. */
export const DOMAIN_FLOORS: Readonly<Record<string, TriggerEvalFloor>> = {
    'image-generation': { minRecall: 1.0, minPrecision: 0.85 },
    iconography: { minRecall: 1.0, minPrecision: 0.9 },
    'brand-strategy': { minRecall: 0.9, minPrecision: 0.7 },
};

/** Resolve the effective floor for a skill (domain entry, else default). */
export function floor_for(skill: string | null | undefined): TriggerEvalFloor {
    return (skill !== null && skill !== undefined && DOMAIN_FLOORS[skill]) || DEFAULT_FLOOR;
}

/**
 * Advisory floor for the rules-mode canary leg (`rule_trigger_eval.ts`,
 * road-to-tested-routing Phase 4). Deliberately loose: it is a drift canary
 * over a ~40-case derived suite spanning ~97 rules, not a per-rule quality
 * gate — ratchet only after live baseline data exists. A breach fails the
 * scheduled canary job only, never a PR.
 */
export const RULES_MODE_FLOOR: TriggerEvalFloor = { minRecall: 0.5, minPrecision: 0.5 };
