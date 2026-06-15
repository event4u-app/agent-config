/**
 * Backend directive set — step handlers for the backend-coding flow.
 *
 * TypeScript twin of `work_engine/directives/backend/__init__.py` (ADR-096
 * py2ts Phase 1 — work_engine TOP/integration layer). The `__init__.py` →
 * `index.ts` mapping mirrors the hooks subpackage convention. Public API
 * names stay snake_case to mirror the Python module 1:1 (per ADR-096).
 *
 * Each module exposes a single `run` callable that matches the `Step`
 * protocol defined in `../../delivery_state`. The dispatcher wires them into
 * the `STEP_ORDER` mapping at call time.
 *
 * The deterministic gates (`refine`, `memory`, `analyze`) validate upstream
 * state; the delegation gates (`plan`, `implement`, `test`, `verify`) halt
 * with `@agent-directive:` markers so the orchestrator can invoke the matching
 * skill and resume. `report` renders the delivery Markdown once everything
 * else has succeeded.
 */

import type { Step } from '../../delivery_state.js';

import * as analyze from './analyze.js';
import * as implement from './implement.js';
import * as memory from './memory.js';
import * as plan from './plan.js';
import * as refine from './refine.js';
import * as report from './report.js';
import * as test from './test.js';
import * as verify from './verify.js';

/** External name carried in `state.directive_set` for this set. */
export const DIRECTIVE_SET_NAME = 'backend';

/**
 * Input kinds this directive set knows how to handle.
 *
 * Read by `work_engine.dispatcher.assert_kind_supported` before the loop
 * starts. The schema's `work_engine.state.KNOWN_INPUT_KINDS` is the *envelope*
 * whitelist (what is accepted on disk); `SUPPORTED_KINDS` is the *capability*
 * whitelist (what this set can actually drive end to end).
 */
export const SUPPORTED_KINDS: ReadonlyArray<string> = ['ticket', 'prompt'];

// Mirror the Python `_STEPS` tuple: (refine, memory, analyze, plan, implement,
// test, verify, report). The leaf name is the dispatcher slot key; in Python
// it is derived via `step.__name__.rsplit(".", 1)[-1]` — hardcoded here since
// the modules are imported statically.
const _STEPS: ReadonlyArray<[string, { run: Step; AMBIGUITIES: ReadonlyArray<Record<string, string>> }]> = [
    ['refine', refine],
    ['memory', memory],
    ['analyze', analyze],
    ['plan', plan],
    ['implement', implement],
    ['test', test],
    ['verify', verify],
    ['report', report],
];

/**
 * Return `{step_name: AMBIGUITIES}` for every step in flow order.
 *
 * Used by documentation generators and the `test_ambiguity_coverage` suite to
 * prove every step explicitly declares what can surface a `BLOCKED` outcome.
 * Steps that always succeed (`memory`, `report`) return an empty tuple —
 * declared intent, not an omission.
 */
export function all_ambiguities(): Record<string, ReadonlyArray<Record<string, string>>> {
    const out: Record<string, ReadonlyArray<Record<string, string>>> = {};
    for (const [name, step] of _STEPS) {
        out[name] = step.AMBIGUITIES;
    }
    return out;
}

/**
 * Return the `{step_name: handler}` mapping the dispatcher walks.
 *
 * Each value is the module-level `run` callable matching the
 * `work_engine.delivery_state.Step` protocol — exactly what
 * `work_engine.dispatcher.dispatch` calls. Order of insertion matches the
 * canonical backend flow (refine → memory → analyze → plan → implement →
 * test → verify → report).
 */
export function get_steps(): Map<string, Step> {
    const out = new Map<string, Step>();
    for (const [name, step] of _STEPS) {
        out.set(name, step.run);
    }
    return out;
}

// Re-export the step modules as namespaces (Python `__all__` lists them as
// importable members of the package).
export { analyze, implement, memory, plan, refine, report, test, verify };
