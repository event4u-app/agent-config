// Golden-parity tests for work_engine/persona_policy.ts vs persona_policy.py
// (ADR-094 py2ts Phase 1). Covers: every shipped persona resolves to the right
// policy flags, the default-on-miss fallback (None / unknown / non-string), and
// known_personas insertion order. The Python side is loaded via a direct-file
// importlib loader (sys.modules registered before exec so the CPython-3.9
// dataclass `__module__` lookup succeeds; work_engine dir + repo on sys.path).
// Policy objects are compared as asdict() dicts to assert field-name + value
// parity in declaration order.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    DEFAULT_PERSONA,
    PersonaPolicy,
    known_personas,
    resolve_policy,
} from '../../../src/agent-src/templates/scripts/work_engine/persona_policy.js';

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

/** asdict-equivalent projection of a TS PersonaPolicy, in Python field order. */
function asdict(p: PersonaPolicy): Record<string, unknown> {
    return {
        name: p.name,
        allows_implement: p.allows_implement,
        allows_test: p.allows_test,
        allows_verify: p.allows_verify,
        widen_tests: p.widen_tests,
        suggests_next_commands: p.suggests_next_commands,
    };
}

describe('work_engine/persona_policy', () => {
    it('DEFAULT_PERSONA is senior-engineer', () => {
        expect(DEFAULT_PERSONA).toBe('senior-engineer');
    });

    it('senior-engineer: runs every step, no widening', () => {
        expect(asdict(resolve_policy('senior-engineer'))).toEqual({
            name: 'senior-engineer',
            allows_implement: true,
            allows_test: true,
            allows_verify: true,
            widen_tests: false,
            suggests_next_commands: true,
        });
    });

    it('qa: widens tests', () => {
        const p = resolve_policy('qa');
        expect(p.widen_tests).toBe(true);
        expect(p.allows_implement).toBe(true);
    });

    it('advisory: plan-only, no next-command suggestions', () => {
        expect(asdict(resolve_policy('advisory'))).toEqual({
            name: 'advisory',
            allows_implement: false,
            allows_test: false,
            allows_verify: false,
            widen_tests: false,
            suggests_next_commands: false,
        });
    });

    it('unknown / null / non-string fall back to the default policy', () => {
        const def = asdict(resolve_policy('senior-engineer'));
        expect(asdict(resolve_policy('bogus'))).toEqual(def);
        expect(asdict(resolve_policy(null))).toEqual(def);
        expect(asdict(resolve_policy(undefined))).toEqual(def);
        expect(asdict(resolve_policy(42))).toEqual(def);
        expect(asdict(resolve_policy(''))).toEqual(def);
    });

    it('known_personas returns insertion order', () => {
        expect(known_personas()).toEqual(['senior-engineer', 'qa', 'advisory']);
    });

    it('policy objects are frozen (read-only configuration)', () => {
        const p = resolve_policy('qa');
        expect(() => {
            (p as unknown as { widen_tests: boolean }).widen_tests = false;
        }).toThrow();
    });

    describe.runIf(hasPython3())('python parity', () => {
        const personas = ['senior-engineer', 'qa', 'advisory', 'bogus', ''];

        it.each(personas)('resolve_policy(%j) asdict matches CPython', (persona) => {
            const oracle = py(
                'm=_load("persona_policy")\n' +
                    `print(json.dumps(dataclasses.asdict(m.resolve_policy(${JSON.stringify(persona)}))))`,
            );
            const expected = JSON.parse(oracle) as Record<string, unknown>;
            expect(asdict(resolve_policy(persona))).toEqual(expected);
        });

        it('resolve_policy(None) asdict matches CPython', () => {
            const oracle = py(
                'm=_load("persona_policy")\n' +
                    'print(json.dumps(dataclasses.asdict(m.resolve_policy(None))))',
            );
            expect(asdict(resolve_policy(null))).toEqual(JSON.parse(oracle));
        });

        it('known_personas matches CPython', () => {
            const oracle = py(
                'm=_load("persona_policy")\nprint(json.dumps(list(m.known_personas())))',
            );
            expect(known_personas()).toEqual(JSON.parse(oracle));
        });

        it('DEFAULT_PERSONA + __all__ match CPython', () => {
            const oracle = py(
                'm=_load("persona_policy")\n' +
                    'print(json.dumps({"default": m.DEFAULT_PERSONA, "all": sorted(m.__all__)}))',
            );
            const expected = JSON.parse(oracle) as { default: string; all: string[] };
            expect(DEFAULT_PERSONA).toBe(expected.default);
            expect(expected.all).toEqual(
                ['DEFAULT_PERSONA', 'PersonaPolicy', 'known_personas', 'resolve_policy'].sort(),
            );
        });
    });
});
