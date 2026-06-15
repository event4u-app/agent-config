/**
 * UI-trivial directive set — single-file ≤5-line micro-edit path.
 *
 * TypeScript twin of `work_engine/directives/ui_trivial/__init__.py` (ADR-096
 * py2ts Phase 1 — work_engine TOP/integration layer). The `__init__.py` →
 * `index.ts` mapping mirrors the hooks subpackage convention. Public API names
 * stay snake_case to mirror the Python module 1:1 (per ADR-096).
 *
 * The eight-step shape mirrors `work_engine.directives.backend` /
 * `work_engine.directives.ui` — eight slots, fixed order, no branching:
 *
 * - `refine`    → `refine`   — confirm intent gate.
 * - `memory`    → `_skipped` — bypassed.
 * - `analyze`   → `_skipped` — bypassed.
 * - `plan`      → `_skipped` — bypassed.
 * - `implement` → `apply`    — hard preconditions; reclassify to `ui-improve`
 *   (full audit gate) when violated.
 * - `test`      → `test`     — smoke-test delegate.
 * - `verify`    → `_skipped` — bypassed.
 * - `report`    → `report`   — one-line delivery summary.
 *
 * The directory uses an underscore (`ui_trivial`) because Python packages
 * cannot contain hyphens. The schema carries the external hyphenated name
 * `"ui-trivial"`; the dispatcher's loader is the single place that translates
 * between them.
 */

import type { Step } from '../../delivery_state.js';

import * as _skipped from './_skipped.js';
import * as apply from './apply.js';
import * as refine from './refine.js';
import * as report from './report.js';
import * as test from './test.js';

/**
 * External name carried in `state.directive_set` for this set.
 *
 * Note the hyphen — this is the schema/wire form, not the module name. The
 * module name (`ui_trivial`) is an implementation detail of the loader.
 */
export const DIRECTIVE_SET_NAME = 'ui-trivial';

/** Roadmap that defines this directive bundle (Phase 2 Step 6). */
export const ROADMAP = 'agents/roadmaps/road-to-product-ui-track.md';

/**
 * Input kinds this directive set knows how to handle.
 *
 * The intent classifier reaches `ui-trivial` from any of the four input
 * kinds; the trivial set keeps the same tuple so input routing stays
 * unchanged once the intent label has landed.
 */
export const SUPPORTED_KINDS: ReadonlyArray<string> = ['ticket', 'prompt', 'diff', 'file'];

/**
 * Wire the eight-step dispatcher slots for the trivial set.
 *
 * `refine` validates the intent gate; `implement`, `test`, and `report` carry
 * the trivial-path behavior; the four bypassed slots share `_skipped` so the
 * dispatcher's completeness check is satisfied without inventing per-slot
 * stubs. The mapping is rebuilt per call (cheap; the dispatcher invokes
 * `get_steps` once per run).
 */
function _build_step_map(): Map<string, Step> {
    const skipped = _skipped.run;
    return new Map<string, Step>([
        ['refine', refine.run],
        ['memory', skipped],
        ['analyze', skipped],
        ['plan', skipped],
        ['implement', apply.run],
        ['test', test.run],
        ['verify', skipped],
        ['report', report.run],
    ]);
}

/**
 * Return the `{step_name: handler}` mapping the dispatcher walks.
 *
 * Mirrors `work_engine.directives.backend.get_steps`. `refine`, `implement`,
 * `test`, and `report` carry trivial-path behavior; the four bypassed slots
 * delegate to `_skipped`.
 */
export function get_steps(): Map<string, Step> {
    return _build_step_map();
}

/**
 * Per-step ambiguity declarations.
 *
 * Mirrors `work_engine.directives.backend.all_ambiguities`. The four bypassed
 * slots re-export `_skipped.AMBIGUITIES` (empty) so doc generators see a
 * uniform shape across all eight steps.
 */
export function all_ambiguities(): Record<string, ReadonlyArray<Record<string, string>>> {
    const skipped = _skipped.AMBIGUITIES;
    return {
        refine: refine.AMBIGUITIES,
        memory: skipped,
        analyze: skipped,
        plan: skipped,
        implement: apply.AMBIGUITIES,
        test: test.AMBIGUITIES,
        verify: skipped,
        report: report.AMBIGUITIES,
    };
}

export { apply, refine, report, test };
