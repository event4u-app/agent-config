// Golden-parity tests for the 9 explain_last SECTION renderers + the
// state_loader failure paths (py2ts Phase 1, ADR-200).
//
// The section renderers are pure `render(trace) -> str` functions (no I/O,
// no scrubbing — masking happens in the builders), so they are driven here
// over hand-built trace dicts and compared byte-for-byte against the REAL
// python3 renderers. The Python side uses a DIRECT-FILE importlib loader
// that registers a stub `explast` package in `sys.modules` so each section
// (and any `from ..` sibling it touches) loads WITHOUT triggering the real
// package `__init__` (which would pull config/_lib siblings). state_loader
// is loaded the same way to pin the version-skew / not-found messages +
// exit codes.
//
// Coverage: every section's populated AND empty/placeholder branch, the
// hit_score `:.2f` formatting (incl. banker's rounding + non-numeric n/a),
// the double-space before the assumptions em-dash, the 2-space halt-surface
// indent, the provider/pack empty-string skip, and the council citations
// sub-block.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PyFloat } from '../../../src/scripts/_cli/explain_last/memory.js';
import * as sections from '../../../src/scripts/_cli/explain_last/sections/index.js';
import {
    EXPECTED_VERSION,
    StateLoadError,
    load_state,
} from '../../../src/scripts/_cli/explain_last/state_loader.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const BASE = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'explain_last');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = hasPython3();

// Python preamble: register a stub `explast` package so direct-file loads of
// `explast.sections.<name>` resolve their relative imports without the real
// package __init__.
const PY_PREAMBLE = [
    'import importlib.util, sys, types, json',
    `BASE = ${JSON.stringify(BASE)}`,
    "pkg = types.ModuleType('explast'); pkg.__path__ = [BASE]; pkg.__package__ = 'explast'",
    "sys.modules['explast'] = pkg",
    "spkg = types.ModuleType('explast.sections'); spkg.__path__ = [BASE + '/sections']; spkg.__package__ = 'explast.sections'",
    "sys.modules['explast.sections'] = spkg",
    'def _load(name, rel):',
    '    spec = importlib.util.spec_from_file_location(name, BASE + "/" + rel)',
    '    m = importlib.util.module_from_spec(spec); sys.modules[name] = m; spec.loader.exec_module(m); return m',
    "_load('explast.scrubber', 'scrubber.py')",
].join('\n');

/**
 * Render `section` over each trace in `traces` with the python3 twin and
 * return the per-trace output strings.
 */
function pyRenderSection(section: string, traces: unknown[]): string[] {
    const code = [
        PY_PREAMBLE,
        `mod = _load('explast.sections.${section}', 'sections/${section}.py')`,
        'data = json.loads(sys.stdin.read())',
        'out = [mod.render(t) for t in data]',
        'sys.stdout.write(json.dumps(out, ensure_ascii=False))',
    ].join('\n');
    const res = spawnSync('python3', ['-c', code], {
        encoding: 'utf8',
        input: JSON.stringify(traces),
    });
    if (res.status !== 0) {
        throw new Error(`python section ${section} failed: ${res.stderr}`);
    }
    return JSON.parse(res.stdout) as string[];
}

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

describe('explain_last sections — golden parity', () => {
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

    for (const [name, cases] of Object.entries(SECTION_CASES)) {
        it.runIf(HAVE_PYTHON)(`${name}.render matches python3 across all branches`, () => {
            // Python receives plain numbers for hit_score; its `float()` was
            // already applied by the builder in production, but the section
            // only does `:.2f`/isinstance, so a plain JSON number is faithful.
            const pyTraces = cases.map((t) => stripPyFloatMarker(t));
            const expected = pyRenderSection(name, pyTraces);
            const actual = tsRender(renderers[name] as Renderer, cases);
            expect(actual).toEqual(expected);
        });
    }
});

/** Convert `__pyfloat__: n` markers to a plain `hit_score: n` for the py side. */
function stripPyFloatMarker(trace: Record<string, unknown>): unknown {
    if (!Array.isArray(trace.memory)) {
        return trace;
    }
    const memory = (trace.memory as Array<Record<string, unknown>>).map((e) => {
        if (e && typeof e === 'object' && '__pyfloat__' in e) {
            const { __pyfloat__, ...rest } = e;
            return { ...rest, hit_score: __pyfloat__ };
        }
        return e;
    });
    return { ...trace, memory };
}

describe('explain_last state_loader — golden parity (importlib direct-file)', () => {
    function pyLoad(stateJson: string | null): {
        ok: boolean; msg?: string; exit?: number;
    } {
        const code = [
            'import importlib.util, sys, types, json, tempfile, os',
            `BASE = ${JSON.stringify(BASE)}`,
            'spec = importlib.util.spec_from_file_location("sl", BASE + "/state_loader.py")',
            'sl = importlib.util.module_from_spec(spec); spec.loader.exec_module(sl)',
            'from pathlib import Path',
            'arg = sys.stdin.read()',
            'd = tempfile.mkdtemp(); p = Path(d) / "s.json"',
            'present = arg != "__MISSING__"',
            'if present: p.write_text(arg, encoding="utf-8")',
            'try:',
            '    sl.load_state(p)',
            '    sys.stdout.write(json.dumps({"ok": True}))',
            'except sl.StateLoadError as e:',
            // normalize the tmp path out of the message so it is deterministic.
            '    msg = str(e).replace(str(p), "<state>")',
            '    sys.stdout.write(json.dumps({"ok": False, "msg": msg, "exit": e.exit_code}))',
        ].join('\n');
        const res = spawnSync('python3', ['-c', code], {
            encoding: 'utf8',
            input: stateJson === null ? '__MISSING__' : stateJson,
        });
        if (res.status !== 0) {
            throw new Error(`python state_loader failed: ${res.stderr}`);
        }
        return JSON.parse(res.stdout) as { ok: boolean; msg?: string; exit?: number };
    }

    function tsLoad(stateJson: string | null): { ok: boolean; msg?: string; exit?: number } {
        const fs = require('node:fs') as typeof import('node:fs');
        const os = require('node:os') as typeof import('node:os');
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

    it.runIf(HAVE_PYTHON)('version skew (v0) → exit 0 + byte-identical message', () => {
        const py = pyLoad(JSON.stringify({ version: 0 }));
        const ts = tsLoad(JSON.stringify({ version: 0 }));
        expect(ts).toEqual(py);
        expect(ts.exit).toBe(0);
    });

    it.runIf(HAVE_PYTHON)('missing version (legacy) → same skew message (version=None)', () => {
        const py = pyLoad(JSON.stringify({ foo: 1 }));
        const ts = tsLoad(JSON.stringify({ foo: 1 }));
        expect(ts).toEqual(py);
        expect(ts.msg).toContain('version=None');
    });

    it.runIf(HAVE_PYTHON)('not found → exit 1', () => {
        const py = pyLoad(null);
        const ts = tsLoad(null);
        expect(ts.exit).toBe(py.exit);
        expect(ts.exit).toBe(1);
    });

    it.runIf(HAVE_PYTHON)('non-object JSON → must-contain-object message', () => {
        const py = pyLoad(JSON.stringify([1, 2, 3]));
        const ts = tsLoad(JSON.stringify([1, 2, 3]));
        expect(ts).toEqual(py);
    });

    it.runIf(HAVE_PYTHON)('valid v1 → ok', () => {
        const py = pyLoad(JSON.stringify({ version: 1, x: 1 }));
        const ts = tsLoad(JSON.stringify({ version: 1, x: 1 }));
        expect(ts).toEqual(py);
        expect(ts.ok).toBe(true);
    });

    it('EXPECTED_VERSION is pinned to 1', () => {
        expect(EXPECTED_VERSION).toBe(1);
    });
});
