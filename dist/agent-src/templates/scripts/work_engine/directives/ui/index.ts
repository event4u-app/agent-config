/**
 * UI directive set — every slot wired to a working handler.
 *
 * TypeScript twin of `work_engine/directives/ui/__init__.py` (ADR-200 py2ts
 * Phase 1 — work_engine TOP/integration layer). The `__init__.py` → `index.ts`
 * mapping mirrors the hooks subpackage convention. Public API names stay
 * snake_case to mirror the Python module 1:1 (per ADR-200).
 *
 * The eight-step shape mirrors `work_engine.directives.backend`:
 *
 * - `refine`    → `audit`        — existing-UI inventory gate.
 * - `memory`    → `_passthrough` — UI track does not consult memory.
 * - `analyze`   → `design`       — produces the locked design brief.
 * - `plan`      → `_passthrough` — design brief is the plan.
 * - `implement` → `apply`        — stack-dispatched render of the brief.
 * - `test`      → `review`       — design-review pass produces findings.
 * - `verify`    → `polish`       — bounded fix loop (≤ 2 rounds).
 * - `report`    → backend.report — shared delivery-Markdown renderer.
 */

import type { Step } from '../../delivery_state.js';
import { report } from '../backend/index.js';

import * as _passthrough from './_passthrough.js';
import * as apply from './apply.js';
import * as audit from './audit.js';
import * as design from './design.js';
import * as polish from './polish.js';
import * as review from './review.js';

/** External name carried in `state.directive_set` for this set. */
export const DIRECTIVE_SET_NAME = 'ui';

/** Roadmap that promoted the deferral stub to fully wired handlers. */
export const ROADMAP = 'agents/roadmaps/road-to-product-ui-track.md';

/**
 * Input kinds this directive set knows how to handle.
 *
 * Wires every UI-classifiable input shape (ticket prose, free-form prompt,
 * `diff` / `file` improve-this-screen envelopes) through to this set.
 */
export const SUPPORTED_KINDS: ReadonlyArray<string> = ['ticket', 'prompt', 'diff', 'file'];

/**
 * Wire the eight-step dispatcher slots for the UI set.
 *
 * `refine` runs audit; `memory` and `plan` are pass-through no-ops; `analyze`
 * runs design; `implement` runs apply; `test` runs review; `verify` runs
 * polish; `report` re-uses the shared backend renderer. The mapping is rebuilt
 * per call (cheap; the dispatcher invokes `get_steps` once per run).
 */
function _build_step_map(): Map<string, Step> {
    const passthrough = _passthrough.run;
    return new Map<string, Step>([
        ['refine', audit.run],
        ['memory', passthrough],
        ['analyze', design.run],
        ['plan', passthrough],
        ['implement', apply.run],
        ['test', review.run],
        ['verify', polish.run],
        ['report', report.run],
    ]);
}

/**
 * Return the `{step_name: handler}` mapping the dispatcher walks.
 *
 * Mirrors `work_engine.directives.backend.get_steps`.
 */
export function get_steps(): Map<string, Step> {
    return _build_step_map();
}

/**
 * Per-step ambiguity declarations.
 *
 * Mirrors `work_engine.directives.backend.all_ambiguities`. Each working
 * handler re-exports its own `AMBIGUITIES`; the pass-through slots re-export
 * `_passthrough.AMBIGUITIES` (empty) so doc generators see a uniform shape
 * across all eight steps. `report` borrows the backend renderer's surface.
 */
export function all_ambiguities(): Record<string, ReadonlyArray<Record<string, string>>> {
    const passthrough = _passthrough.AMBIGUITIES;
    return {
        refine: audit.AMBIGUITIES,
        memory: passthrough,
        analyze: design.AMBIGUITIES,
        plan: passthrough,
        implement: apply.AMBIGUITIES,
        test: review.AMBIGUITIES,
        verify: polish.AMBIGUITIES,
        report: report.AMBIGUITIES,
    };
}

export { apply, audit, design, polish, report, review };
