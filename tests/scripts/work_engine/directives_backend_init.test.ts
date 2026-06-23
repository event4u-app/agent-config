// Intent tests for work_engine/directives/backend/index.ts (ADR-096 py2ts
// Phase 1 — work_engine TOP/integration layer).
//
// Was a python3-vs-tsx golden-parity rig; the `.py` original is gone, so this
// now asserts the tsx wiring module's own contract directly. The module exposes
// DIRECTIVE_SET_NAME, SUPPORTED_KINDS, get_steps(), and all_ambiguities().
// get_steps() returns callables (not snapshot-comparable), so the structural
// assertion is on the step-name order plus the all_ambiguities() per-step code
// lists. A `{name, kinds, step_order, ambiguities}` summary is snapshotted.
import { describe, expect, it } from 'vitest';

import {
    DIRECTIVE_SET_NAME,
    SUPPORTED_KINDS,
    all_ambiguities,
    get_steps,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/index.js';

function tsSummary(): unknown {
    const amb: Record<string, Array<string | undefined>> = {};
    for (const [k, v] of Object.entries(all_ambiguities())) {
        amb[k] = v.map((a) => a['code']);
    }
    return _sortKeys({
        name: DIRECTIVE_SET_NAME,
        kinds: [...SUPPORTED_KINDS],
        step_order: [...get_steps().keys()],
        ambiguities: amb,
    });
}

function _sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(_sortKeys);
    }
    if (value && typeof value === 'object') {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(value as Record<string, unknown>).sort()) {
            sorted[k] = _sortKeys((value as Record<string, unknown>)[k]);
        }
        return sorted;
    }
    return value;
}

describe('directives/backend index — shape', () => {
    it('DIRECTIVE_SET_NAME + SUPPORTED_KINDS', () => {
        expect(DIRECTIVE_SET_NAME).toBe('backend');
        expect([...SUPPORTED_KINDS]).toEqual(['ticket', 'prompt']);
    });

    it('get_steps walks the canonical eight-step order', () => {
        expect([...get_steps().keys()]).toEqual([
            'refine', 'memory', 'analyze', 'plan', 'implement', 'test', 'verify', 'report',
        ]);
    });

    it('every step maps to a callable', () => {
        for (const handler of get_steps().values()) {
            expect(typeof handler).toBe('function');
        }
    });
});

describe('directives/backend index — summary contract', () => {
    it('name + kinds + step order + per-step ambiguity codes', () => {
        expect(tsSummary()).toMatchInlineSnapshot(`
          {
            "ambiguities": {
              "analyze": [
                "upstream_refine_failed",
                "upstream_memory_failed",
                "lost_ac",
              ],
              "implement": [
                "upstream_plan_failed",
                "empty_changes_delegate",
                "malformed_changes",
              ],
              "memory": [],
              "plan": [
                "upstream_analyze_failed",
                "empty_plan_delegate",
                "malformed_plan",
              ],
              "refine": [
                "missing_id",
                "trivial_title",
                "missing_or_vague_ac",
                "prompt_unrefined",
                "prompt_medium_confidence",
                "prompt_low_confidence",
                "prompt_ui_intent",
              ],
              "report": [],
              "test": [
                "upstream_implement_failed",
                "empty_tests_delegate",
                "malformed_tests",
                "bad_test_verdict",
              ],
              "verify": [
                "upstream_test_failed",
                "empty_verify_delegate",
                "malformed_verify",
                "bad_verify_verdict",
              ],
            },
            "kinds": [
              "ticket",
              "prompt",
            ],
            "name": "backend",
            "step_order": [
              "refine",
              "memory",
              "analyze",
              "plan",
              "implement",
              "test",
              "verify",
              "report",
            ],
          }
        `);
    });
});
