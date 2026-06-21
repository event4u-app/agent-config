// Golden-parity tests for work_engine/scoring/memory_visibility.ts vs
// memory_visibility.py (ADR-094 py2ts Phase 1 — scoring subpackage).
//
// `scoring/memory_visibility.py` carries ONE intra-package import
// (`from .decision_trace import derive_confidence_band, derive_risk_class`).
// The direct-file importlib loader cannot resolve a relative import on its
// own, so the Python driver builds a synthetic package `mvpkg` whose
// `__path__` points at the scoring dir, loads `decision_trace` as
// `mvpkg.decision_trace`, registers it in sys.modules, then loads
// `memory_visibility` as `mvpkg.memory_visibility` — at which point its
// `from .decision_trace import ...` resolves against the registered submodule.
// The TS twin imports the real `./decision_trace.js` twin, so neither side
// touches the other language's dependency. Output strings carry the literal
// 🧠 / · / … / → glyphs and are compared verbatim (byte surface).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    CONSEQUENCE_KEYS,
    DEFAULT_ASKED_TYPES,
    DEFAULT_MAX_INLINE_IDS,
    ICON,
    compute_affected,
    diff_consequence_keys,
    format_changed_decisions_block,
    format_line,
    should_emit,
    summarise_visibility,
} from '../../../src/agent-src/templates/scripts/work_engine/scoring/memory_visibility.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCORING = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
    'scoring',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

// Package-aware loader: synthesise `mvpkg` with __path__ = scoring dir, load
// decision_trace + memory_visibility as its submodules so the relative import
// resolves.
const PY_LOADER = [
    'import sys, json, importlib.util, types',
    `SCORING = ${JSON.stringify(SCORING)}`,
    'pkg = types.ModuleType("mvpkg")',
    'pkg.__path__ = [SCORING]',
    'pkg.__package__ = "mvpkg"',
    'sys.modules["mvpkg"] = pkg',
    'def _sub(name):',
    '    import os',
    '    sp = importlib.util.spec_from_file_location("mvpkg." + name, os.path.join(SCORING, name + ".py"))',
    '    m = importlib.util.module_from_spec(sp)',
    '    sys.modules["mvpkg." + name] = m',
    '    sp.loader.exec_module(m)',
    '    return m',
    '_sub("decision_trace")',
    'mv = _sub("memory_visibility")',
].join('\n');

function runPy(body: string, args: string[] = []): string {
    const r = spawnSync('python3', ['-c', `${PY_LOADER}\n${body}`, ...args], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

describe('scoring/memory_visibility — constants', () => {
    it('icon + defaults + consequence keys', () => {
        expect(ICON).toBe('\u{1F9E0}');
        expect(DEFAULT_MAX_INLINE_IDS).toBe(5);
        expect([...DEFAULT_ASKED_TYPES]).toEqual([
            'domain-invariants',
            'incident-learnings',
            'historical-patterns',
        ]);
        expect([...CONSEQUENCE_KEYS]).toEqual([
            'confidence_band',
            'risk_class',
            'applied_rules',
            'test_plan',
        ]);
    });
});

describe('scoring/memory_visibility — summarise_visibility', () => {
    it('empty / non-list → zeros', () => {
        expect(summarise_visibility(null)).toEqual({ asks: 0, hits: 0, ids: [] });
        expect(summarise_visibility({})).toEqual({ asks: 0, hits: 0, ids: [] });
    });
    it('counts distinct types as hits, dedupes ids in order', () => {
        const memory = [
            { id: 'a', type: 'domain-invariants' },
            { id: 'a', type: 'domain-invariants' }, // dup id
            { rule_id: 'b', type: 'incident-learnings' },
            { id: 3, type: 'incident-learnings' }, // int id
        ];
        expect(summarise_visibility(memory)).toEqual({ asks: 3, hits: 2, ids: ['a', 'b', '3'] });
    });
    it('falls back to ids-present hit when no type field', () => {
        const memory = [{ id: 'x' }, { id: 'y' }];
        expect(summarise_visibility(memory)).toEqual({ asks: 3, hits: 1, ids: ['x', 'y'] });
    });
    it('custom asked_types changes asks count', () => {
        expect(summarise_visibility([{ id: 'a' }], { asked_types: ['t1', 't2'] })).toEqual({
            asks: 2,
            hits: 1,
            ids: ['a'],
        });
    });
});

describe('scoring/memory_visibility — format_line', () => {
    it('asks==0 → null', () => {
        expect(format_line({ asks: 0, hits: 0, ids: [] })).toBeNull();
    });
    it('renders icon + hits/asks + ids', () => {
        const line = format_line({ asks: 4, hits: 2, ids: ['a', 'b'] });
        expect(line).toBe('🧠 Memory: 2/4 · ids=[a, b]');
    });
    it('overflow appends …+N', () => {
        const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        const line = format_line({ asks: 4, hits: 4, ids }, { max_inline_ids: 5 });
        expect(line).toBe('🧠 Memory: 4/4 · ids=[a, b, c, d, e, …+2]');
    });
    it('affected segment: empty → none, non-empty → comma-joined', () => {
        expect(format_line({ asks: 4, hits: 1, ids: ['a'] }, { affected: [] })).toBe(
            '🧠 Memory: 1/4 · ids=[a] · affected: none',
        );
        expect(
            format_line({ asks: 4, hits: 1, ids: ['a'] }, { affected: ['confidence_band', 'risk_class'] }),
        ).toBe('🧠 Memory: 1/4 · ids=[a] · affected: confidence_band,risk_class');
    });
});

describe('scoring/memory_visibility — diff + compute_affected', () => {
    it('diff suppresses both-None keys; sorts result', () => {
        const a = { confidence_band: 'high', risk_class: 'medium', applied_rules: null, test_plan: null };
        const b = { confidence_band: 'medium', risk_class: 'medium', applied_rules: null, test_plan: null };
        expect(diff_consequence_keys(a, b)).toEqual(['confidence_band']);
    });
    it('list-valued keys compare order-insensitively', () => {
        const a = { applied_rules: ['b', 'a'] };
        const b = { applied_rules: ['a', 'b'] };
        expect(diff_consequence_keys(a, b)).toEqual([]);
    });
    it('compute_affected returns null when no memory consulted', () => {
        expect(compute_affected({ memory_hits: 0 })).toBeNull();
    });
    it('compute_affected flags confidence_band divergence', () => {
        // hits=2, claims==passes, no ambiguity → high WITH memory; without
        // memory (hits=0) the band drops → confidence_band diverges.
        const got = compute_affected({
            memory_hits: 2,
            verify_claims: 1,
            verify_first_try_passes: 1,
            ambiguity_flag: false,
        });
        expect(got).toEqual(['confidence_band']);
    });
    it('compute_affected returns [] when nothing diverges', () => {
        // hits=1 vs hits=0 both yield medium/low? hits=1 → medium, hits=0 with
        // no passes → low, so confidence_band diverges. Use a case where the
        // band is stable: passes>=1 keeps medium at hits=1 AND hits=0.
        const got = compute_affected({
            memory_hits: 1,
            verify_claims: 0,
            verify_first_try_passes: 1,
            ambiguity_flag: false,
        });
        // hits=1 → medium; hits=0, passes=1 → medium. risk same. → []
        expect(got).toEqual([]);
    });
});

describe('scoring/memory_visibility — format_changed_decisions_block', () => {
    it('null when no affected', () => {
        expect(format_changed_decisions_block(['a'], null)).toBeNull();
        expect(format_changed_decisions_block(['a'], [])).toBeNull();
    });
    it('null when no ids', () => {
        expect(format_changed_decisions_block([], ['confidence_band'])).toBeNull();
    });
    it('renders id × key rows with → glyph, sorted keys', () => {
        const block = format_changed_decisions_block(['r1', 'r2'], ['risk_class', 'confidence_band']);
        expect(block).toBe(
            [
                'Memory changed decisions:',
                '- r1 → confidence_band',
                '- r1 → risk_class',
                '- r2 → confidence_band',
                '- r2 → risk_class',
            ].join('\n'),
        );
    });
});

describe('scoring/memory_visibility — should_emit', () => {
    it('visibility_off wins', () => {
        expect(should_emit({ asks: 5 }, { visibility_off: true })).toBe(false);
    });
    it('asks<=0 → false', () => {
        expect(should_emit({ asks: 0 })).toBe(false);
    });
    it('cadence never / auto / always', () => {
        expect(should_emit({ asks: 4 }, { memory_cadence: 'never' })).toBe(false);
        expect(should_emit({ asks: 2 }, { memory_cadence: 'auto' })).toBe(false);
        expect(should_emit({ asks: 3 }, { memory_cadence: 'auto' })).toBe(true);
        expect(should_emit({ asks: 1 }, { memory_cadence: 'always' })).toBe(true);
    });
});

describe.runIf(hasPython3())('scoring/memory_visibility — python parity', () => {
    it('summarise_visibility matches CPython', () => {
        const memory = [
            { id: 'a', type: 'domain-invariants' },
            { id: 'a', type: 'domain-invariants' },
            { rule_id: 'b', type: 'incident-learnings' },
            { id: 3, type: 'incident-learnings' },
            'skip',
        ];
        const body = [
            'mem = json.loads(sys.argv[1])',
            'sys.stdout.write(json.dumps(mv.summarise_visibility(mem)))',
        ].join('\n');
        const expected = JSON.parse(runPy(body, [JSON.stringify(memory)]));
        expect(summarise_visibility(memory)).toEqual(expected);
    });

    it('format_line matches CPython across affected variants', () => {
        const cases = [
            { summary: { asks: 0, hits: 0, ids: [] }, affected: null },
            { summary: { asks: 4, hits: 2, ids: ['a', 'b'] }, affected: null },
            { summary: { asks: 4, hits: 4, ids: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }, affected: null },
            { summary: { asks: 4, hits: 1, ids: ['a'] }, affected: [] },
            { summary: { asks: 4, hits: 1, ids: ['a'] }, affected: ['confidence_band', 'risk_class'] },
        ];
        const body = [
            'cs = json.loads(sys.argv[1])',
            'out = [mv.format_line(c["summary"], affected=c["affected"]) for c in cs]',
            'sys.stdout.write(json.dumps(out))',
        ].join('\n');
        const expected = JSON.parse(runPy(body, [JSON.stringify(cases)]));
        const got = cases.map((c) => format_line(c.summary, { affected: c.affected }));
        expect(got).toEqual(expected);
    });

    it('compute_affected matches CPython', () => {
        const cases = [
            { memory_hits: 0, verify_claims: 0, verify_first_try_passes: 0, ambiguity_flag: false },
            { memory_hits: 2, verify_claims: 1, verify_first_try_passes: 1, ambiguity_flag: false },
            { memory_hits: 1, verify_claims: 0, verify_first_try_passes: 1, ambiguity_flag: false },
            { memory_hits: 1, verify_claims: 0, verify_first_try_passes: 0, ambiguity_flag: false },
        ];
        const body = [
            'cs = json.loads(sys.argv[1])',
            'out = [mv.compute_affected(memory_hits=c["memory_hits"], verify_claims=c["verify_claims"], verify_first_try_passes=c["verify_first_try_passes"], ambiguity_flag=c["ambiguity_flag"]) for c in cs]',
            'sys.stdout.write(json.dumps(out))',
        ].join('\n');
        const expected = JSON.parse(runPy(body, [JSON.stringify(cases)]));
        const got = cases.map((c) => compute_affected(c));
        expect(got).toEqual(expected);
    });

    it('format_changed_decisions_block matches CPython', () => {
        const body = [
            'out = mv.format_changed_decisions_block(["r1","r2"], ["risk_class","confidence_band"])',
            'sys.stdout.write(json.dumps(out))',
        ].join('\n');
        const expected = JSON.parse(runPy(body));
        expect(format_changed_decisions_block(['r1', 'r2'], ['risk_class', 'confidence_band'])).toBe(
            expected,
        );
    });

    it('should_emit matches CPython', () => {
        const cases = [
            { summary: { asks: 5 }, cadence: 'always', off: true },
            { summary: { asks: 0 }, cadence: 'always', off: false },
            { summary: { asks: 2 }, cadence: 'auto', off: false },
            { summary: { asks: 3 }, cadence: 'auto', off: false },
            { summary: { asks: 4 }, cadence: 'never', off: false },
            { summary: { asks: 1 }, cadence: 'always', off: false },
        ];
        const body = [
            'cs = json.loads(sys.argv[1])',
            'out = [mv.should_emit(c["summary"], memory_cadence=c["cadence"], visibility_off=c["off"]) for c in cs]',
            'sys.stdout.write(json.dumps(out))',
        ].join('\n');
        const expected = JSON.parse(runPy(body, [JSON.stringify(cases)]));
        const got = cases.map((c) =>
            should_emit(c.summary, { memory_cadence: c.cadence, visibility_off: c.off }),
        );
        expect(got).toEqual(expected);
    });
});
