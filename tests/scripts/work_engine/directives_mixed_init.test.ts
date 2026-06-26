// Intent tests for work_engine/directives/mixed/index.ts (ADR-096 py2ts Phase 1
// — work_engine TOP/integration layer). Was a python3-vs-tsx byte-parity rig;
// the `.py` original is gone, so this asserts the tsx directive-set's own
// contract directly. The mixed set reuses five backend handlers by reference;
// the shape block covers name / roadmap / kinds / step-order / callables, and
// the summary snapshot additionally freezes the ambiguity-code structure
// (`all_ambiguities()`). The summary is a pure read of static module state —
// deterministic, so the inline snapshot is stable.
import { describe, expect, it } from 'vitest';

import {
    DIRECTIVE_SET_NAME,
    ROADMAP,
    SUPPORTED_KINDS,
    all_ambiguities,
    get_steps,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/mixed/index.js';

function _sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(_sortKeys);
    if (value && typeof value === 'object') {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(value as Record<string, unknown>).sort()) {
            sorted[k] = _sortKeys((value as Record<string, unknown>)[k]);
        }
        return sorted;
    }
    return value;
}

function tsSummary(): string {
    const amb: Record<string, Array<string | undefined>> = {};
    for (const [k, v] of Object.entries(all_ambiguities())) amb[k] = v.map((a) => a['code']);
    return JSON.stringify(
        _sortKeys({ name: DIRECTIVE_SET_NAME, roadmap: ROADMAP, kinds: [...SUPPORTED_KINDS], step_order: [...get_steps().keys()], ambiguities: amb }),
        null,
        2,
    );
}

describe('directives/mixed index — shape', () => {
    it('name / roadmap / kinds', () => {
        expect(DIRECTIVE_SET_NAME).toBe('mixed');
        expect(ROADMAP).toBe('agents/roadmaps/road-to-product-ui-track.md');
        expect([...SUPPORTED_KINDS]).toEqual(['ticket', 'prompt']);
    });
    it('get_steps order', () => {
        expect([...get_steps().keys()]).toEqual([
            'refine', 'memory', 'analyze', 'plan', 'implement', 'test', 'verify', 'report',
        ]);
    });
    it('all callables', () => {
        for (const h of get_steps().values()) expect(typeof h).toBe('function');
    });
});

describe('directives/mixed index — full directive-set summary', () => {
    it('name / roadmap / kinds / step-order / ambiguity-code structure', () => {
        expect(tsSummary()).toMatchInlineSnapshot(`
          "{
            "ambiguities": {
              "analyze": [
                "upstream_refine_failed",
                "upstream_memory_failed",
                "lost_ac"
              ],
              "implement": [
                "upstream_contract_failed",
                "contract_sentinel_missing",
                "ui_track_not_started",
                "ui_track_review_unclean"
              ],
              "memory": [],
              "plan": [
                "upstream_analyze_failed",
                "contract_missing",
                "contract_incomplete",
                "contract_unconfirmed"
              ],
              "refine": [
                "missing_id",
                "trivial_title",
                "missing_or_vague_ac",
                "prompt_unrefined",
                "prompt_medium_confidence",
                "prompt_low_confidence",
                "prompt_ui_intent"
              ],
              "report": [],
              "test": [
                "upstream_ui_failed",
                "empty_stitch_delegate",
                "malformed_stitch",
                "bad_stitch_verdict"
              ],
              "verify": [
                "upstream_test_failed",
                "empty_verify_delegate",
                "malformed_verify",
                "bad_verify_verdict"
              ]
            },
            "kinds": [
              "ticket",
              "prompt"
            ],
            "name": "mixed",
            "roadmap": "agents/roadmaps/road-to-product-ui-track.md",
            "step_order": [
              "refine",
              "memory",
              "analyze",
              "plan",
              "implement",
              "test",
              "verify",
              "report"
            ]
          }"
        `);
    });
});
