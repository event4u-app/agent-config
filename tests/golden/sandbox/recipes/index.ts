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

export interface RecipeMeta {
    gt_id: string;
    ticket_relpath?: string;
    prompt_relpath?: string;
    diff_relpath?: string;
    file_relpath?: string;
    persona?: string | null;
    cycle_cap?: number;
}

export interface RecipeModule {
    META: RecipeMeta;
    buildRecipe(workspace: string): Record<string, RecipeStep>;
    seedState?(workspace: string): Dict | null;
}

export const RECIPES: RecipeModule[] = [];
