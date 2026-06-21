/**
 * Golden Transcript recipe registry (TS twin of the RECIPE_MODULES tuple in
 * the retired harness.py). Each recipe module declares its scenario `META`
 * and a `buildRecipe(workspace)` returning the directive→callback map; some
 * declare `seedState(workspace)`. The harness enumerates this registry for
 * `allGtIds()` and resolves a scenario via its `META.gt_id`.
 *
 * Populated phase by phase (road-to-golden-transcript-ts-replatform.md
 * Phase 4 — one entry per ported `gt*.ts`).
 */
import type { Dict, RecipeStep } from '../runner.js';
import gt1Happy from './gt1_happy.js';
import gt2Ambiguity from './gt2_ambiguity.js';
import gt3Recovery from './gt3_recovery.js';
import gt4PersonaRefusal from './gt4_persona_refusal.js';
import gt5StateResume from './gt5_state_resume.js';
import gtP1High from './gt_p1_high.js';
import gtP2Medium from './gt_p2_medium.js';
import gtP3Low from './gt_p3_low.js';
import gtP4UiRejection from './gt_p4_ui_rejection.js';
import gtU1BuildHappy from './gt_u1_build_happy.js';
import gtU2ImproveDiff from './gt_u2_improve_diff.js';
import gtU3AuditSkipped from './gt_u3_audit_skipped.js';
import gtU4PolishCeiling from './gt_u4_polish_ceiling.js';
import gtU5MixedFlow from './gt_u5_mixed_flow.js';

export interface RecipeMeta {
    gt_id: string;
    ticket_relpath?: string;
    prompt_relpath?: string;
    diff_relpath?: string;
    file_relpath?: string;
    persona?: string | null;
    cycle_cap?: number;
    /** Capture-only: capture.ts segments the run at this directive (GT-5 resume demo). */
    resume_after_directive?: string;
}

export interface RecipeModule {
    META: RecipeMeta;
    buildRecipe(workspace: string): Record<string, RecipeStep>;
    seedState?(workspace: string): Dict | null;
}

export const RECIPES: RecipeModule[] = [
    gt1Happy,
    gt2Ambiguity,
    gt3Recovery,
    gt4PersonaRefusal,
    gt5StateResume,
    gtP1High,
    gtP2Medium,
    gtP3Low,
    gtP4UiRejection,
    gtU1BuildHappy,
    gtU2ImproveDiff,
    gtU3AuditSkipped,
    gtU4PolishCeiling,
    gtU5MixedFlow,
];
