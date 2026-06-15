/**
 * Mixed (backend + UI) directive set.
 *
 * TypeScript twin of `work_engine/directives/mixed/__init__.py` (ADR-096 py2ts
 * Phase 1 — work_engine TOP/integration layer). The `__init__.py` → `index.ts`
 * mapping mirrors the hooks subpackage convention. Public API names stay
 * snake_case to mirror the Python module 1:1 (per ADR-096).
 *
 * `mixed` is the directive set for tickets that touch both layers. Its plan
 * slot locks the backend contract (data shape + API surface) before any UI
 * work begins; its implement slot delegates the full UI sub-flow once the
 * contract is confirmed; its test slot stitches the seam with end-to-end smoke
 * scenarios.
 *
 * Slot mapping (mirrors `work_engine.directives.backend.get_steps`):
 *
 * - `refine`    → backend.refine  — intent classification + ticket / prompt gate.
 * - `memory`    → backend.memory  — engineering-memory pull.
 * - `analyze`   → backend.analyze — backend analysis precondition.
 * - `plan`      → `contract`      — backend contract lock.
 * - `implement` → `ui`            — delegate to UI sub-flow.
 * - `test`      → `stitch`        — integration verification.
 * - `verify`    → backend.verify  — four-judge review on the merged diff.
 * - `report`    → backend.report  — delivery markdown.
 *
 * The shared steps are reused by reference, not by duplication.
 */

import type { Step } from '../../delivery_state.js';
import {
    analyze as backend_analyze,
    memory as backend_memory,
    refine as backend_refine,
    report as backend_report,
    verify as backend_verify,
} from '../backend/index.js';

import * as contract from './contract.js';
import * as stitch from './stitch.js';
import * as ui from './ui.js';

/** External name carried in `state.directive_set` for this set. */
export const DIRECTIVE_SET_NAME = 'mixed';

/** Roadmap that promotes the Phase 4 stub to working handlers. */
export const ROADMAP = 'agents/roadmaps/road-to-product-ui-track.md';

/**
 * Input kinds this directive set accepts.
 *
 * `mixed` accepts the same envelope shapes as `backend`: ticket payloads
 * (refined by the ticket flow) and free-form prompts (refined by
 * `refine-prompt`). The `diff` / `file` envelopes stay UI-only since they
 * describe an existing screen, not a backend contract surface.
 */
export const SUPPORTED_KINDS: ReadonlyArray<string> = ['ticket', 'prompt'];

/**
 * Wire the eight-step dispatcher slots for the mixed set.
 *
 * `refine` / `memory` / `analyze` / `verify` / `report` reuse the backend
 * handlers verbatim; `plan` / `implement` / `test` are the mixed-specific
 * contract → ui → stitch chain.
 */
function _build_step_map(): Map<string, Step> {
    return new Map<string, Step>([
        ['refine', backend_refine.run],
        ['memory', backend_memory.run],
        ['analyze', backend_analyze.run],
        ['plan', contract.run],
        ['implement', ui.run],
        ['test', stitch.run],
        ['verify', backend_verify.run],
        ['report', backend_report.run],
    ]);
}

/**
 * Return the `{step_name: handler}` mapping the dispatcher walks.
 *
 * Mirrors `work_engine.directives.backend.get_steps` and
 * `work_engine.directives.ui.get_steps`.
 */
export function get_steps(): Map<string, Step> {
    return _build_step_map();
}

/**
 * Per-step ambiguity declarations.
 *
 * Each handler re-exports its own `AMBIGUITIES`. The mapping is rebuilt per
 * call (cheap; documentation generators and the `test_ambiguity_coverage`
 * suite invoke this once per run).
 */
export function all_ambiguities(): Record<string, ReadonlyArray<Record<string, string>>> {
    return {
        refine: backend_refine.AMBIGUITIES,
        memory: backend_memory.AMBIGUITIES,
        analyze: backend_analyze.AMBIGUITIES,
        plan: contract.AMBIGUITIES,
        implement: ui.AMBIGUITIES,
        test: stitch.AMBIGUITIES,
        verify: backend_verify.AMBIGUITIES,
        report: backend_report.AMBIGUITIES,
    };
}

export { contract, stitch, ui };
