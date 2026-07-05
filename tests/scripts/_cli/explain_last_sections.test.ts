// Contract tests for the 9 explain_last SECTION renderers + the
// state_loader failure paths (py2ts Phase 1, ADR-200). The tsx twins are the
// source of truth (the python originals were deleted in the teardown); the
// pure render(trace)->str output + the state_loader failure messages are
// pinned via inline snapshots.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PyFloat } from '../../../src/scripts/_cli/explain_last/memory.js';
import * as sections from '../../../src/scripts/_cli/explain_last/sections/index.js';
import {
    EXPECTED_VERSION,
    StateLoadError,
    load_state,
} from '../../../src/scripts/_cli/explain_last/state_loader.js';

type Renderer = (trace: Record<string, unknown>) => string;

/** Render `traces` through the TS section, substituting PyFloat for `hit_score`. */
function tsRender(renderer: Renderer, traces: Array<Record<string, unknown>>): string[] {
    return traces.map((t) => renderer(reviveFloats(t)));
}

/** JSON carries hit_score as a plain number; the builder would emit PyFloat. */
function reviveFloats(trace: Record<string, unknown>): Record<string, unknown> {
    if (!Array.isArray(trace.memory)) {
        return trace;
    }
    const memory = (trace.memory as Array<Record<string, unknown>>).map((e) => {
        if (e && typeof e === 'object' && '__pyfloat__' in e) {
            return { ...e, hit_score: new PyFloat(e['__pyfloat__'] as number) };
        }
        return e;
    });
    return { ...trace, memory };
}

const SECTION_CASES: Record<string, Array<Record<string, unknown>>> = {
    header: [
        { run_id: 'TICK-1', subject: 'implement-ticket', generated_at: '2026-06-17T12:00:00+00:00' },
        { run_id: null, subject: null, generated_at: null }, // (unknown)/unknown/empty
        { run_id: 'R', subject: 'mystery' }, // unmapped subject passes through
    ],
    route: [
        { route: { matched_rules: ['a', 'b'], kernel_rules: ['k1', 'k2', 'k3'], persona: 'dev' } },
        { route: { matched_rules: [], kernel_rules: [], persona: null } }, // (none)/0/(none)
        { route: null }, // router missing branch
    ],
    inputs: [
        {
            inputs: {
                profile: 'developer', preset: 'balanced', rule_loading_tier: 'strict',
                source_per_knob: { profile: 'user', preset: 'profile', rule_loading_tier: 'user' },
            },
        },
        { inputs: { profile: null, preset: 'balanced', rule_loading_tier: 'x', source_per_knob: {} } },
        { inputs: null }, // could-not-resolve branch
    ],
    memory: [
        {
            memory: [
                { entry_id: 'm1', __pyfloat__: 1.25, used_in: 'plan' },
                { entry_id: 'm2', __pyfloat__: 2, used_in: 'refine' }, // → 2.00
                { entry_id: 'm3', __pyfloat__: 0.005, used_in: 'x' }, // banker's round → 0.00
                { entry_id: 'm4', __pyfloat__: 0.015, used_in: 'y' }, // → 0.01 or 0.02 (test pins to py)
            ],
        },
        { memory: [{ entry_id: 'mx', hit_score: 'oops', used_in: 'z' }] }, // non-numeric → n/a
        { memory: [] }, // (none)
        { memory: null }, // (none)
    ],
    council: [
        {
            council: [
                { member_id: 'a/b', verdict: 'looks fine', citations: ['c1', 'c2'] },
                { member_id: 'solo', verdict: 'ok', citations: [] },
                { member_id: null, verdict: null, citations: null },
            ],
        },
        { council: [] }, // (none recorded)
        { council: null }, // (none recorded)
    ],
    assumptions: [
        {
            assumptions: [
                { id: 'a1', accepted: true, source: 'refine' },
                { id: 'a2', accepted: false, source: 'halt' },
                { id: null, source: null }, // (unknown)/accepted-default-true/unspecified
            ],
        },
        { assumptions: [] }, // (none captured)
        { assumptions: null }, // (none captured)
    ],
    halt: [
        { halt: { reason: 'blocked', step: 'plan', surface: ['x', 'y'] } },
        { halt: { reason: 'blocked', step: null, surface: [] } }, // step (unspecified), no surface
        { halt: null }, // clean run
    ],
    provider: [
        { provider: { id: 'sora', selection_reason: 'cheap' } },
        { provider: { id: null, selection_reason: null } }, // (unknown)/(no reason)
        { provider: null }, // empty string skip
    ],
    pack: [
        { pack: { id: 'finance', reason: 'declared' } },
        { pack: { id: 'core', reason: '' } }, // no reason → just id
        { pack: null }, // empty string skip
    ],
};

describe('explain_last sections — render contract', () => {
    const renderers: Record<string, Renderer> = {
        header: sections.header.render,
        route: sections.route.render,
        inputs: sections.inputs.render,
        memory: sections.memory.render,
        council: sections.council.render,
        assumptions: sections.assumptions.render,
        halt: sections.halt.render,
        provider: sections.provider.render,
        pack: sections.pack.render,
    };

    it('every section renders each branch (pinned output)', () => {
        const rendered = Object.fromEntries(
            Object.entries(SECTION_CASES).map(([name, cases]) => [
                name,
                tsRender(renderers[name] as Renderer, cases),
            ]),
        );
        expect(rendered).toMatchInlineSnapshot(`
          {
            "assumptions": [
              "## Assumptions

          - [x] a1  — recorded in step \`refine\`
          - [ ] a2  — recorded in step \`halt\`
          - [x] (unknown)  — recorded in step \`unspecified\`
          ",
              "## Assumptions

          - (none captured)
          ",
              "## Assumptions

          - (none captured)
          ",
            ],
            "council": [
              "## Council

          ### a/b

          > looks fine

          Citations:
          - c1
          - c2

          ### solo

          > ok

          ### (unknown)

          > (no verdict)
          ",
              "## Council

          (none recorded for this run)
          ",
              "## Council

          (none recorded for this run)
          ",
            ],
            "halt": [
              "## Why halted?

          - **Reason:** \`blocked\`
          - **Hook event:** \`plan\`

          Surface emitted to the user:

            x
            y
          ",
              "## Why halted?

          - **Reason:** \`blocked\`
          - **Hook event:** \`(unspecified)\`
          ",
              "## Why halted?

          (clean run — no halt recorded)
          ",
            ],
            "header": [
              "# explain last — run TICK-1

          **Subject:** /implement-ticket · **Started:** 2026-06-17T12:00:00+00:00
          ",
              "# explain last — run (unknown)

          **Subject:** (unknown) · **Started:** 
          ",
              "# explain last — run R

          **Subject:** mystery · **Started:** 
          ",
            ],
            "inputs": [
              "## Why this profile / preset?

          | knob | value | source |
          |---|---|---|
          | profile.id | developer | user |
          | preset.id | balanced | profile |
          | rule_loading_tier | strict | user |
          ",
              "## Why this profile / preset?

          | knob | value | source |
          |---|---|---|
          | profile.id | (none) | default |
          | preset.id | balanced | default |
          | rule_loading_tier | x | default |
          ",
              "## Why this profile / preset?

          - (none) — settings could not be resolved
          ",
            ],
            "memory": [
              "## Memory hits influencing this run

          - m1 (score 1.25) — used in plan
          - m2 (score 2.00) — used in refine
          - m3 (score 0.01) — used in x
          - m4 (score 0.01) — used in y
          ",
              "## Memory hits influencing this run

          - mx (score n/a) — used in z
          ",
              "## Memory hits influencing this run

          - (none)
          ",
              "## Memory hits influencing this run

          - (none)
          ",
            ],
            "pack": [
              "## Active pack

          - finance — declared
          ",
              "## Active pack

          - core
          ",
              "",
            ],
            "provider": [
              "## Why this provider?

          - **Provider:** \`sora\`
          - **Selection reason:** cheap
          ",
              "## Why this provider?

          - **Provider:** \`(unknown)\`
          - **Selection reason:** (no reason recorded)
          ",
              "",
            ],
            "route": [
              "## Why this route?

          - Active rules: a, b
          - Kernel rules: 3
          - Persona: dev
          ",
              "## Why this route?

          - Active rules: (none)
          - Kernel rules: 0
          - Persona: (none)
          ",
              "## Why this route?

          - (none) — router.json missing or unreadable
          ",
            ],
          }
        `);
    });
});

describe('explain_last state_loader — failure paths', () => {
    function tsLoad(stateJson: string | null): { ok: boolean; msg?: string; exit?: number } {
        const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-'));
        const p = path.join(d, 's.json');
        if (stateJson !== null) {
            fs.writeFileSync(p, stateJson, 'utf-8');
        }
        try {
            load_state(p);
            return { ok: true };
        } catch (e) {
            if (e instanceof StateLoadError) {
                return { ok: false, msg: e.message.replace(p, '<state>'), exit: e.exitCode };
            }
            throw e;
        } finally {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }

    it('version skew (v0) → exit 0 + pinned message', () => {
        const ts = tsLoad(JSON.stringify({ version: 0 }));
        expect(ts.exit).toBe(0);
        expect(ts).toMatchInlineSnapshot(`
          {
            "exit": 0,
            "msg": "trace format upgraded; rerun the upstream command on this branch to regenerate (found version=0, expected 1)",
            "ok": false,
          }
        `);
    });

    it('missing version (legacy) → version=None skew message', () => {
        const ts = tsLoad(JSON.stringify({ foo: 1 }));
        expect(ts.msg).toContain('version=None');
        expect(ts).toMatchInlineSnapshot(`
          {
            "exit": 0,
            "msg": "trace format upgraded; rerun the upstream command on this branch to regenerate (found version=None, expected 1)",
            "ok": false,
          }
        `);
    });

    it('not found → exit 1', () => {
        const ts = tsLoad(null);
        expect(ts.exit).toBe(1);
        expect(ts).toMatchInlineSnapshot(`
          {
            "exit": 1,
            "msg": "state file not found: <state>",
            "ok": false,
          }
        `);
    });

    it('non-object JSON → must-contain-object message', () => {
        const ts = tsLoad(JSON.stringify([1, 2, 3]));
        expect(ts).toMatchInlineSnapshot(`
          {
            "exit": 2,
            "msg": "state file <state> must contain a JSON object",
            "ok": false,
          }
        `);
    });

    it('valid v1 → ok', () => {
        const ts = tsLoad(JSON.stringify({ version: 1, x: 1 }));
        expect(ts.ok).toBe(true);
        expect(ts).toMatchInlineSnapshot(`
          {
            "ok": true,
          }
        `);
    });

    it('EXPECTED_VERSION is pinned to 1', () => {
        expect(EXPECTED_VERSION).toBe(1);
    });
});
