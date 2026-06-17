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
 * - `refine`    → `audit`        — existing-UI inventory + greenfield gate.
 * - `memory`    → `app_spec`     — greenfield app-spec grounding gate.
 * - `analyze`   → `design`       — produces the locked design brief.
 * - `plan`      → `scaffold`     — greenfield Zero-to-One skeleton gate.
 * - `implement` → `apply`        — stack-dispatched render of the brief.
 * - `test`      → `review`       — design-review pass produces findings.
 * - `verify`    → `polish`       — bounded fix loop (≤ 2 rounds).
 * - `report`    → backend.report — shared delivery-Markdown renderer.
 *
 * The greenfield order is audit → app-spec → design → scaffold → apply →
 * review → polish (Phases 2-4 council, Option A): `design` fixes the
 * abstract visual language, `scaffold` maps it onto concrete structure.
 */

import type { Step } from '../../delivery_state.js';
import { report } from '../backend/index.js';

import * as app_spec from './app_spec.js';
import * as apply from './apply.js';
import * as audit from './audit.js';
import * as design from './design.js';
import * as polish from './polish.js';
import * as review from './review.js';
import * as scaffold from './scaffold.js';

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
 * `refine` runs audit; `memory` runs the greenfield app-spec gate; `analyze`
 * runs design; `plan` runs the greenfield scaffold gate; `implement` runs
 * apply; `test` runs review; `verify` runs polish; `report` re-uses the shared
 * backend renderer. The app-spec and scaffold gates are no-ops outside the
 * greenfield-scaffold path. The mapping is rebuilt per call (cheap; the
 * dispatcher invokes `get_steps` once per run).
 */
function _build_step_map(): Map<string, Step> {
    return new Map<string, Step>([
        ['refine', audit.run],
        ['memory', app_spec.run],
        ['analyze', design.run],
        ['plan', scaffold.run],
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
 * Mirrors `work_engine.directives.backend.all_ambiguities`. Each handler
 * re-exports its own `AMBIGUITIES` tuple so doc generators see a uniform shape
 * across all eight steps. `report` borrows the backend renderer's surface.
 */
export function all_ambiguities(): Record<string, ReadonlyArray<Record<string, string>>> {
    return {
        refine: audit.AMBIGUITIES,
        memory: app_spec.AMBIGUITIES,
        analyze: design.AMBIGUITIES,
        plan: scaffold.AMBIGUITIES,
        implement: apply.AMBIGUITIES,
        test: review.AMBIGUITIES,
        verify: polish.AMBIGUITIES,
        report: report.AMBIGUITIES,
    };
}

export { app_spec, apply, audit, design, polish, report, review, scaffold };
