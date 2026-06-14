// Golden-parity tests for work_engine/delivery_state.ts vs delivery_state.py
// (ADR-094 py2ts Phase 1). Covers: Outcome enum string values, StepResult /
// DeliveryState dataclass field order + defaults via asdict, per-instance
// mutable defaults (no shared container), agent_directive formatting (incl.
// Python str() coercion of bool/None/int payload values + kwargs order), and
// is_agent_directive (lstrip + prefix). Python loaded via the shared direct-file
// importlib loader (sys.modules registered before exec for the 3.9 dataclass
// __module__ lookup; work_engine dir + repo on sys.path).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    AGENT_DIRECTIVE_PREFIX,
    DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
    is_agent_directive,
} from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function pyLoaderPreamble(): string {
    return [
        'import importlib.util, sys, json, pathlib, dataclasses',
        `WE = pathlib.Path(${JSON.stringify(WE)})`,
        `REPO = pathlib.Path(${JSON.stringify(REPO_ROOT)})`,
        'sys.path.insert(0, str(WE)); sys.path.insert(0, str(REPO))',
        'def _load(name):',
        '    sp = importlib.util.spec_from_file_location("we_"+name, WE / (name + ".py"))',
        '    m = importlib.util.module_from_spec(sp)',
        '    sys.modules[sp.name] = m',
        '    sp.loader.exec_module(m)',
        '    return m',
    ].join('\n');
}

function py(body: string): string {
    const r = spawnSync('python3', ['-c', `${pyLoaderPreamble()}\n${body}`], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr}`);
    }
    return r.stdout.trim();
}

describe('work_engine/delivery_state', () => {
    it('Outcome enum carries the string values', () => {
        expect(Outcome.SUCCESS).toBe('success');
        expect(Outcome.BLOCKED).toBe('blocked');
        expect(Outcome.PARTIAL).toBe('partial');
    });

    it('AGENT_DIRECTIVE_PREFIX is the public contract literal', () => {
        expect(AGENT_DIRECTIVE_PREFIX).toBe('@agent-directive:');
    });

    it('StepResult defaults: empty questions + message, own array per instance', () => {
        const a = new StepResult({ outcome: Outcome.SUCCESS });
        const b = new StepResult({ outcome: Outcome.BLOCKED });
        expect(a.questions).toEqual([]);
        expect(a.message).toBe('');
        a.questions.push('x');
        // default_factory=list → no cross-instance leakage.
        expect(b.questions).toEqual([]);
    });

    it('DeliveryState defaults match the contract', () => {
        const s = new DeliveryState({ ticket: { id: 'T1' } });
        expect(s.persona).toBe('senior-engineer');
        expect(s.memory).toEqual([]);
        expect(s.plan).toBeNull();
        expect(s.changes).toEqual([]);
        expect(s.outcomes).toEqual({});
        expect(s.questions).toEqual([]);
        expect(s.report).toBe('');
        expect(s.ui_audit).toBeNull();
        expect(s.stack).toBeNull();
    });

    it('DeliveryState mutable defaults are per-instance', () => {
        const a = new DeliveryState({ ticket: {} });
        const b = new DeliveryState({ ticket: {} });
        a.changes.push({ file: 'x' });
        a.outcomes['k'] = 'v';
        expect(b.changes).toEqual([]);
        expect(b.outcomes).toEqual({});
    });

    it('agent_directive: name only', () => {
        expect(agent_directive('implement-plan')).toBe('@agent-directive: implement-plan');
    });

    it('agent_directive: payload renders key=value, kwargs order preserved', () => {
        expect(agent_directive('run-tests', { scope: 'full', n: 3 })).toBe(
            '@agent-directive: run-tests scope=full n=3',
        );
    });

    it('agent_directive: Python str() coercion of bool / None', () => {
        expect(agent_directive('x', { a: true, b: false, c: null })).toBe(
            '@agent-directive: x a=True b=False c=None',
        );
    });

    it('is_agent_directive: lstrip then prefix match', () => {
        expect(is_agent_directive('@agent-directive: foo')).toBe(true);
        expect(is_agent_directive('   @agent-directive: foo')).toBe(true);
        expect(is_agent_directive('1. user option')).toBe(false);
        expect(is_agent_directive('')).toBe(false);
        // non-string → false (Python isinstance guard).
        expect(is_agent_directive(42 as unknown)).toBe(false);
        expect(is_agent_directive(null as unknown)).toBe(false);
    });

    describe.runIf(hasPython3())('python parity', () => {
        it('Outcome values match CPython', () => {
            const oracle = py(
                'm=_load("delivery_state")\n' +
                    'print(json.dumps({k: getattr(m.Outcome, k).value for k in ' +
                    '("SUCCESS","BLOCKED","PARTIAL")}))',
            );
            expect(JSON.parse(oracle)).toEqual({
                SUCCESS: 'success',
                BLOCKED: 'blocked',
                PARTIAL: 'partial',
            });
        });

        it('StepResult asdict field order matches CPython', () => {
            const oracle = py(
                'm=_load("delivery_state")\n' +
                    'r=m.StepResult(outcome=m.Outcome.BLOCKED, questions=["q"], message="msg")\n' +
                    'd=dataclasses.asdict(r)\n' +
                    'd["outcome"]=d["outcome"].value\n' +
                    'print(json.dumps({"keys": list(d.keys()), "val": d}))',
            );
            const expected = JSON.parse(oracle) as { keys: string[]; val: Record<string, unknown> };
            const r = new StepResult({
                outcome: Outcome.BLOCKED,
                questions: ['q'],
                message: 'msg',
            });
            expect(Object.keys(r)).toEqual(expected.keys);
            expect({ outcome: r.outcome, questions: r.questions, message: r.message }).toEqual(
                expected.val,
            );
        });

        it('DeliveryState asdict field order matches CPython', () => {
            const oracle = py(
                'm=_load("delivery_state")\n' +
                    's=m.DeliveryState(ticket={"id":"T1"})\n' +
                    'print(json.dumps(list(dataclasses.asdict(s).keys())))',
            );
            const expected = JSON.parse(oracle) as string[];
            const s = new DeliveryState({ ticket: { id: 'T1' } });
            expect(Object.keys(s)).toEqual(expected);
        });

        const directiveCases: Array<[string, Record<string, unknown>]> = [
            ['implement-plan', {}],
            ['run-tests', { scope: 'full' }],
            ['run-tests', { scope: 'full', n: 3 }],
            ['x', { a: true, b: false, c: null }],
            // NB: payload keys must not collide with the `name` positional
            // (Python `agent_directive(name, **payload)` would TypeError on a
            // `name=` kwarg — same constraint both sides).
            ['x', { count: 0, label: 'a-b_c' }],
        ];

        it.each(directiveCases)('agent_directive(%j, %j) matches CPython', (name, payload) => {
            const kwargs = Object.entries(payload)
                .map(([k, v]) => `${k}=${pyLiteral(v)}`)
                .join(', ');
            const oracle = py(
                'm=_load("delivery_state")\n' +
                    `print(m.agent_directive(${JSON.stringify(name)}${kwargs ? ', ' + kwargs : ''}))`,
            );
            expect(agent_directive(name, payload)).toBe(oracle);
        });

        const directiveProbes = [
            '@agent-directive: foo',
            '   @agent-directive: foo',
            '\t@agent-directive: x',
            '1. user option',
            '',
            'agent-directive: no-at',
        ];

        it.each(directiveProbes)('is_agent_directive(%j) matches CPython', (q) => {
            const oracle = py(
                'm=_load("delivery_state")\n' +
                    `print("true" if m.is_agent_directive(${JSON.stringify(q)}) else "false")`,
            );
            expect(String(is_agent_directive(q))).toBe(oracle);
        });
    });
});

/** Render a JS payload value as a Python literal for the `-c` oracle. */
function pyLiteral(v: unknown): string {
    if (v === null || v === undefined) {
        return 'None';
    }
    if (v === true) {
        return 'True';
    }
    if (v === false) {
        return 'False';
    }
    if (typeof v === 'number') {
        return String(v);
    }
    return JSON.stringify(v);
}
