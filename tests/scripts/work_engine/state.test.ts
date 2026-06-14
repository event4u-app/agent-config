// Golden-parity rig for the py2ts work_engine `state` twin (ADR-094).
//
// `work_engine/state.py` is a foundation library module with NO intra-package
// imports — stdlib only. To exercise it from python3 without importing the
// whole `work_engine` package (whose `__init__` pulls in unported siblings),
// we load `state.py` via a direct-file `importlib` loader, registering the
// module in `sys.modules` BEFORE `exec_module` so the dataclass field-type
// resolution (under `from __future__ import annotations`) finds the module.
//
// Each block drives construction / serialization on BOTH engines from the
// same JSON fixture and asserts byte-identical `json.dumps(..., indent=2,
// ensure_ascii=False)` (the exact call `state.dump` makes) plus matching
// validation-error text. The TS side is exercised via the same module under
// `node node_modules/.bin/tsx` per ADR-094's runtime model.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_DIRECTIVE_SET,
    DEFAULT_INTENT,
    Input,
    KNOWN_DIRECTIVE_SETS,
    KNOWN_INPUT_KINDS,
    SCHEMA_VERSION,
    SchemaError,
    dump,
    from_dict,
    load,
    to_dict,
} from '../../../src/agent-src/templates/scripts/work_engine/state.js';

// tests/scripts/work_engine/state.test.ts → four levels up is the repo root.
const REPO_ROOT = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    '..',
    '..',
    '..',
);

const STATE_PY = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
    'state.py',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/**
 * Run a python3 snippet that has `state.py` loaded as the module `state`
 * (direct-file importlib loader; `sys.modules` registration handles the
 * `from __future__ import annotations` dataclass type resolution). `args`
 * become `sys.argv[1:]`.
 */
function runPyWithState(
    body: string,
    args: string[] = [],
): SpawnSyncReturns<string> {
    const loader = [
        'import sys, json, importlib.util',
        `spec = importlib.util.spec_from_file_location("state", ${JSON.stringify(STATE_PY)})`,
        'state = importlib.util.module_from_spec(spec)',
        'sys.modules["state"] = state',
        'spec.loader.exec_module(state)',
    ].join('\n');
    const code = `${loader}\n${body}`;
    return spawnSync('python3', ['-c', code, ...args], {
        encoding: 'utf8',
    });
}

/** Python `json.dumps(payload-built-state, indent=2, ensure_ascii=False)`. */
function pySerialize(fixtureJson: string): string {
    const body = [
        'payload = json.loads(sys.argv[1])',
        'st = state.from_dict(payload)',
        'sys.stdout.write(json.dumps(state.to_dict(st), indent=2, ensure_ascii=False))',
    ].join('\n');
    const r = runPyWithState(body, [fixtureJson]);
    if (r.status !== 0) {
        throw new Error(`python3 serialize failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

/** Python: from_dict then dump to a file, return the on-disk bytes (incl. \n). */
function pyDumpFile(fixtureJson: string, outPath: string): string {
    const body = [
        'import pathlib',
        'payload = json.loads(sys.argv[1])',
        'st = state.from_dict(payload)',
        'state.dump(st, pathlib.Path(sys.argv[2]))',
        'sys.stdout.write(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))',
    ].join('\n');
    const r = runPyWithState(body, [fixtureJson, outPath]);
    if (r.status !== 0) {
        throw new Error(`python3 dump failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

/** Python: from_dict, expect SchemaError, return its message text. */
function pyErrorMessage(fixtureJson: string): string {
    const body = [
        'payload = json.loads(sys.argv[1])',
        'try:',
        '    state.from_dict(payload)',
        '    sys.stdout.write("__NO_ERROR__")',
        'except state.SchemaError as exc:',
        '    sys.stdout.write(str(exc))',
    ].join('\n');
    const r = runPyWithState(body, [fixtureJson]);
    if (r.status !== 0) {
        throw new Error(`python3 error-probe failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

/** TS twin: from_dict then JSON.stringify(to_dict, null, 2) — `state.dump`'s body. */
function tsSerialize(fixtureJson: string): string {
    const payload = JSON.parse(fixtureJson);
    return JSON.stringify(to_dict(from_dict(payload)), null, 2);
}

/** TS twin: from_dict, capture the SchemaError message. */
function tsErrorMessage(fixtureJson: string): string {
    const payload = JSON.parse(fixtureJson);
    try {
        from_dict(payload);
        return '__NO_ERROR__';
    } catch (exc) {
        return (exc as Error).message;
    }
}

const PY = hasPython3();
const describePy = PY ? describe : describe.skip;

// ── Fixtures ────────────────────────────────────────────────────────────
//
// NOTE: fixtures deliberately avoid integer-valued floats (e.g. `1.0`). JSON
// carries no float/int tag, so `1.0` collapses to the JS number `1` on parse —
// CPython's reader keeps it a float and re-emits `1.0`. That divergence is a
// property of the JSON-round-trip, identical for any TS reader, and the
// Python `state.dump` path is fed JSON-parsed values too; it is not a twin
// defect. `mtime` uses a genuine non-integer float (`2.5`) to prove real
// floats round-trip on both sides.

const FRESH_TICKET = JSON.stringify({
    version: 1,
    input: { kind: 'ticket', data: { id: 'T-1', title: 'Build it' } },
});

const FULL_ENVELOPE = JSON.stringify({
    version: 1,
    input: {
        kind: 'prompt',
        data: { raw: 'improve the dashboard', assumptions: ['a', 'b'] },
    },
    intent: 'ui-improve',
    directive_set: 'ui',
    stack: { frontend: 'react', mtime: 2.5 },
    ui_audit: {
        greenfield: true,
        greenfield_decision: 'scaffold',
        a11y_baseline: [{ rule: 'color-contrast' }],
        components_found: ['Button', 'Card'],
    },
    ui_design: { design_confirmed: true, layout: 'grid' },
    ui_review: {
        findings: [{ severity: 'minor', text: 'x' }],
        review_clean: false,
        a11y: {
            violations: [{ id: 'v1' }],
            severity_floor: 'serious',
            accepted_violations: [],
        },
        preview: { render_ok: true },
    },
    ui_polish: { rounds: 2, applied: ['fix-a'], extension_used: false },
    contract: {
        data_model: [{ entity: 'User' }],
        api_surface: [{ path: '/users' }],
        contract_confirmed: true,
    },
    stitch: {
        scenarios: [{ name: 'login' }],
        verdict: 'success',
        integration_confirmed: true,
    },
    halts: [
        { reason: 'ambiguous AC', surface: ['line 1', 'line 2'], step: 'plan' },
    ],
    persona: 'frontend-lead',
    memory: [{ note: 'prior run' }],
    plan: { steps: ['s1', 's2'] },
    changes: [{ file: 'a.ts' }],
    tests: { added: 3 },
    verify: { passed: true },
    outcomes: { plan: 'success', apply: 'partial' },
    questions: ['Which layout?'],
    report: 'done',
});

// Unknown top-level keys are tolerated + dropped; non-ASCII left verbatim.
const TOLERANT_AND_UNICODE = JSON.stringify({
    version: 1,
    input: { kind: 'file', data: { path: 'src/Héllo.tsx' } },
    future_field: { ignored: true },
    report: 'café — naïve façade ☕',
    extension_used: 'leaked-but-not-a-field',
});

// `rounds` at the extension ceiling (3) only valid when extension_used is true.
const POLISH_EXTENSION = JSON.stringify({
    version: 1,
    input: { kind: 'ticket', data: {} },
    ui_polish: { rounds: 3, extension_used: true, applied: [] },
});

const EMPTY_DICT_GATES = JSON.stringify({
    version: 1,
    input: { kind: 'ticket', data: {} },
    ui_audit: {},
    ui_design: {},
    ui_review: {},
    ui_polish: {},
    contract: {},
    stitch: {},
});

describePy('work_engine/state — golden serialization parity (python3 vs tsx)', () => {
    const cases: Array<[string, string]> = [
        ['fresh ticket (defaults fill in)', FRESH_TICKET],
        ['full envelope (every slot populated)', FULL_ENVELOPE],
        ['tolerant reader + non-ASCII round-trip', TOLERANT_AND_UNICODE],
        ['polish at extension ceiling', POLISH_EXTENSION],
        ['empty-dict in-progress gates', EMPTY_DICT_GATES],
    ];

    for (const [label, fixture] of cases) {
        it(`byte-identical to_dict JSON — ${label}`, () => {
            const py = pySerialize(fixture);
            const ts = tsSerialize(fixture);
            expect(ts).toBe(py);
        });
    }

    it('dump() writes byte-identical on-disk bytes (trailing newline)', () => {
        const tmpDir = fs_mkdtemp();
        const pyOut = path.join(tmpDir, 'py-state.json');
        const tsOut = path.join(tmpDir, 'ts-state.json');
        const pyBytes = pyDumpFile(FULL_ENVELOPE, pyOut);
        dump(from_dict(JSON.parse(FULL_ENVELOPE)), tsOut);
        const tsBytes = fs_readFile(tsOut);
        expect(tsBytes).toBe(pyBytes);
        expect(tsBytes.endsWith('\n')).toBe(true);
    });
});

describePy('work_engine/state — validation error-text parity', () => {
    const errorCases: Array<[string, string]> = [
        [
            'payload not an object',
            JSON.stringify(['not', 'a', 'dict']),
        ],
        [
            'wrong version',
            JSON.stringify({ version: 2, input: { kind: 'ticket' } }),
        ],
        [
            'input not an object',
            JSON.stringify({ version: 1, input: 'nope' }),
        ],
        [
            'input.data not an object',
            JSON.stringify({ version: 1, input: { kind: 'ticket', data: [] } }),
        ],
        [
            'unknown input.kind',
            JSON.stringify({ version: 1, input: { kind: 'bogus', data: {} } }),
        ],
        [
            'unknown directive_set',
            JSON.stringify({
                version: 1,
                input: { kind: 'ticket', data: {} },
                directive_set: 'sideways',
            }),
        ],
        [
            'stack.frontend empty',
            JSON.stringify({
                version: 1,
                input: { kind: 'ticket', data: {} },
                stack: { frontend: '', mtime: 1.5 },
            }),
        ],
        [
            'stack.mtime not a number',
            JSON.stringify({
                version: 1,
                input: { kind: 'ticket', data: {} },
                stack: { frontend: 'react', mtime: 'soon' },
            }),
        ],
        [
            'ui_audit.greenfield not bool',
            JSON.stringify({
                version: 1,
                input: { kind: 'ticket', data: {} },
                ui_audit: { greenfield: 'yes' },
            }),
        ],
        [
            'ui_audit.greenfield_decision bad value',
            JSON.stringify({
                version: 1,
                input: { kind: 'ticket', data: {} },
                ui_audit: { greenfield_decision: 'rebuild' },
            }),
        ],
        [
            'ui_review.a11y.severity_floor bad value',
            JSON.stringify({
                version: 1,
                input: { kind: 'ticket', data: {} },
                ui_review: { a11y: { severity_floor: 'whatever' } },
            }),
        ],
        [
            'ui_polish.rounds out of range',
            JSON.stringify({
                version: 1,
                input: { kind: 'ticket', data: {} },
                ui_polish: { rounds: 5 },
            }),
        ],
        [
            'ui_polish.rounds not an int (float)',
            JSON.stringify({
                version: 1,
                input: { kind: 'ticket', data: {} },
                ui_polish: { rounds: 1.5 },
            }),
        ],
        [
            'stitch.verdict bad value',
            JSON.stringify({
                version: 1,
                input: { kind: 'ticket', data: {} },
                stitch: { verdict: 'maybe' },
            }),
        ],
        [
            'halts entry not an object',
            JSON.stringify({
                version: 1,
                input: { kind: 'ticket', data: {} },
                halts: ['not-a-dict'],
            }),
        ],
        [
            'halts entry missing reason',
            JSON.stringify({
                version: 1,
                input: { kind: 'ticket', data: {} },
                halts: [{ surface: [] }],
            }),
        ],
        [
            'halts surface entry not a string',
            JSON.stringify({
                version: 1,
                input: { kind: 'ticket', data: {} },
                halts: [{ reason: 'x', surface: [1] }],
            }),
        ],
    ];

    for (const [label, fixture] of errorCases) {
        it(`identical SchemaError text — ${label}`, () => {
            const py = pyErrorMessage(fixture);
            const ts = tsErrorMessage(fixture);
            expect(py).not.toBe('__NO_ERROR__'); // sanity: the .py really raises
            expect(ts).toBe(py);
        });
    }
});

describe('work_engine/state — TS-side unit checks (no python3 needed)', () => {
    it('module constants match the schema', () => {
        expect(SCHEMA_VERSION).toBe(1);
        expect(DEFAULT_INTENT).toBe('backend-coding');
        expect(DEFAULT_DIRECTIVE_SET).toBe('backend');
        expect([...KNOWN_INPUT_KINDS].sort()).toEqual([
            'diff',
            'file',
            'prompt',
            'ticket',
        ]);
        expect([...KNOWN_DIRECTIVE_SETS].sort()).toEqual([
            'backend',
            'mixed',
            'ui',
            'ui-trivial',
        ]);
    });

    it('Input default data is a fresh empty object per instance', () => {
        const a = new Input('ticket');
        const b = new Input('ticket');
        (a.data as Record<string, unknown>)['x'] = 1;
        expect(Object.keys(b.data)).toHaveLength(0);
    });

    it('round-trip from_dict → to_dict → from_dict is stable', () => {
        const first = to_dict(from_dict(JSON.parse(FULL_ENVELOPE)));
        const second = to_dict(from_dict(first as never));
        expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    });

    it('to_dict validates a mutated in-memory state before serialising', () => {
        const st = from_dict(JSON.parse(FRESH_TICKET));
        st.directive_set = 'sideways';
        expect(() => to_dict(st)).toThrow(SchemaError);
    });

    it('to_dict re-validates version drift', () => {
        const st = from_dict(JSON.parse(FRESH_TICKET));
        st.version = 99;
        expect(() => to_dict(st)).toThrow(/version must be 1; got 99/);
    });

    it('load() round-trips a dumped file', () => {
        const tmpDir = fs_mkdtemp();
        const out = path.join(tmpDir, 'state.json');
        const original = from_dict(JSON.parse(FULL_ENVELOPE));
        dump(original, out);
        const reread = load(out);
        expect(JSON.stringify(to_dict(reread))).toBe(
            JSON.stringify(to_dict(original)),
        );
    });
});

// ── tiny fs helpers (kept local to avoid a shared-rig dependency) ───────
import * as fs from 'node:fs';
import * as os from 'node:os';

function fs_mkdtemp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'we-state-'));
}
function fs_readFile(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}
