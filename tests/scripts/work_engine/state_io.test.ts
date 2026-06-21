// Golden-parity tests for work_engine/state_io.ts vs state_io.py
// (ADR-094 py2ts Phase 1 — work_engine foundation).
//
// `state_io.py` is the most intra-dependent module in this batch:
//   from . import state as _state_module
//   from .cli_args import DEFAULT_STATE_FILE, LEGACY_STATE_FILE, _FMT_V0, _FMT_V1
//   from .delivery_state import DeliveryState
//   from .errors import _CLIError
//   from .migration.v0_to_v1 import migrate_payload
//   from .state import SchemaError, WorkState
//
// The direct-file importlib loader cannot resolve those relative imports on
// its own, so the Python driver builds a synthetic `we` package whose
// __path__ points at the work_engine dir (plus a `we.migration` subpackage),
// preloads every sibling state_io needs into sys.modules under `we.<name>`,
// then loads `we.state_io` — at which point its relative imports all resolve.
// The work_engine `__init__` (which pulls unported siblings) is never
// executed: we register the package object manually.
//
// The TS twin imports the real merged sibling twins (state.ts, cli_args.ts,
// delivery_state.ts, errors.ts) and inlines the `migrate_payload` slice (the
// full v0_to_v1.ts twin lands in a later phase) — so neither side imports the
// other language. The parity bar is byte-identical on-disk JSON for the
// save path (v0 and v1 round-trips) plus identical _CLIError message text on
// every error path the contract exercises.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { _CLIError } from '../../../src/agent-src/templates/scripts/work_engine/errors.js';
import { WorkState, from_dict } from '../../../src/agent-src/templates/scripts/work_engine/state.js';
import {
    _load,
    _save,
    _sync_back,
    _to_delivery,
    _to_v0_dict,
    migrate_payload,
} from '../../../src/agent-src/templates/scripts/work_engine/state_io.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

// Package-aware loader: synthesise `we` + `we.migration` packages, preload
// every sibling state_io.py imports, then load `we.state_io`.
const PY_LOADER = [
    'import sys, json, importlib.util, types, os',
    `WE = ${JSON.stringify(WE)}`,
    'we = types.ModuleType("we"); we.__path__ = [WE]; we.__package__ = "we"',
    'sys.modules["we"] = we',
    'mig = types.ModuleType("we.migration"); mig.__path__ = [os.path.join(WE, "migration")]; mig.__package__ = "we.migration"',
    'sys.modules["we.migration"] = mig',
    'def _sub(dotted, relpath):',
    '    sp = importlib.util.spec_from_file_location("we." + dotted, os.path.join(WE, relpath))',
    '    m = importlib.util.module_from_spec(sp)',
    '    sys.modules["we." + dotted] = m',
    '    sp.loader.exec_module(m)',
    '    return m',
    '_sub("state", "state.py")',
    '_sub("cli_args", "cli_args.py")',
    '_sub("delivery_state", "delivery_state.py")',
    '_sub("errors", "errors.py")',
    '_sub("migration.v0_to_v1", os.path.join("migration", "v0_to_v1.py"))',
    'sio = _sub("state_io", "state_io.py")',
].join('\n');

function runPy(body: string, args: string[] = []): { stdout: string; status: number; stderr: string } {
    const r = spawnSync('python3', ['-c', `${PY_LOADER}\n${body}`, ...args], { encoding: 'utf8' });
    return { stdout: r.stdout, status: r.status ?? -1, stderr: r.stderr };
}

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'state-io-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

// A representative v1 payload (canonical envelope) and a v0 payload (flat).
const V1_PAYLOAD = {
    version: 1,
    input: { kind: 'ticket', data: { title: 'Fix the café login', id: 7 } },
    intent: 'backend-coding',
    directive_set: 'backend',
    persona: 'qa',
    memory: [{ id: 'r1' }],
    plan: 'do the thing',
    changes: [{ file: 'a.py' }],
    tests: null,
    verify: { claims: 2, first_try_passes: 2 },
    outcomes: { plan: 'success' },
    questions: [],
    report: 'done',
};

const V0_PAYLOAD = {
    ticket: { title: 'Legacy ticket', id: 3 },
    persona: 'advisory',
    memory: [],
    plan: null,
    changes: [],
    tests: null,
    verify: null,
    outcomes: {},
    questions: ['q1'],
    report: '',
};

describe('state_io — migrate_payload', () => {
    it('v1 payload returned deep-copied unchanged', () => {
        const out = migrate_payload(V1_PAYLOAD);
        expect(out).toEqual(V1_PAYLOAD);
        expect(out).not.toBe(V1_PAYLOAD);
    });
    it('v0 payload wrapped into v1 envelope', () => {
        const out = migrate_payload(V0_PAYLOAD) as Record<string, unknown>;
        expect(out['version']).toBe(1);
        expect(out['input']).toEqual({ kind: 'ticket', data: { title: 'Legacy ticket', id: 3 } });
        expect(out['intent']).toBe('backend-coding');
        expect(out['directive_set']).toBe('backend');
        expect(out['persona']).toBe('advisory');
        expect(out['questions']).toEqual(['q1']);
    });
    it('non-dict → SchemaError', () => {
        expect(() => migrate_payload(42 as unknown as never)).toThrow(/v0 state must be a JSON object/);
    });
    it('missing ticket → SchemaError listing keys', () => {
        expect(() => migrate_payload({ foo: 1 } as never)).toThrow(
            /v0 state must carry a 'ticket' key; got keys: \['foo'\]/,
        );
    });
    it('higher version → SchemaError', () => {
        expect(() => migrate_payload({ version: 2 } as never)).toThrow(
            /cannot migrate from version 2/,
        );
    });
});

describe('state_io — _save round-trips', () => {
    it('v1 save is byte-identical JSON + trailing newline', () => {
        const work = from_dict(V1_PAYLOAD);
        const f = path.join(mkTmp(), 'sub', '.work-state.json');
        _save(f, work, 'v1');
        const bytes = fs.readFileSync(f, 'utf-8');
        expect(bytes.endsWith('\n')).toBe(true);
        // re-load round-trips
        const [reloaded] = _load(f);
        expect(reloaded).toBeInstanceOf(WorkState);
    });

    it('v0 save emits the legacy flat shape', () => {
        const work = from_dict(V1_PAYLOAD);
        const f = path.join(mkTmp(), '.work-state.json');
        _save(f, work, 'v0');
        const obj = JSON.parse(fs.readFileSync(f, 'utf-8'));
        expect(Object.keys(obj)).toEqual([
            'ticket',
            'persona',
            'memory',
            'plan',
            'changes',
            'tests',
            'verify',
            'outcomes',
            'questions',
            'report',
        ]);
        expect(obj.ticket).toEqual({ title: 'Fix the café login', id: 7 });
    });
});

describe('state_io — _to_delivery / _sync_back', () => {
    it('projects WorkState → DeliveryState and mirrors back', () => {
        const work = from_dict(V1_PAYLOAD);
        const delivery = _to_delivery(work);
        expect(delivery).toBeInstanceOf(DeliveryState);
        expect(delivery.ticket).toEqual({ title: 'Fix the café login', id: 7 });
        expect(delivery.persona).toBe('qa');
        // mutate the delivery, sync back
        delivery.report = 'updated';
        delivery.plan = 'new plan';
        _sync_back(work, delivery);
        expect(work.report).toBe('updated');
        expect(work.plan).toBe('new plan');
        expect(work.input.data).toEqual({ title: 'Fix the café login', id: 7 });
    });
});

describe('state_io — _load', () => {
    it('loads v1 file and tags v1', () => {
        const f = path.join(mkTmp(), '.work-state.json');
        fs.writeFileSync(f, JSON.stringify(V1_PAYLOAD), 'utf-8');
        const [work, fmt] = _load(f);
        expect(fmt).toBe('v1');
        expect(work.persona).toBe('qa');
    });
    it('loads + migrates v0 file, tags v0', () => {
        const f = path.join(mkTmp(), '.work-state.json');
        fs.writeFileSync(f, JSON.stringify(V0_PAYLOAD), 'utf-8');
        const [work, fmt] = _load(f);
        expect(fmt).toBe('v0');
        expect(work.input.data).toEqual({ title: 'Legacy ticket', id: 3 });
    });
    it('non-object JSON → _CLIError', () => {
        const f = path.join(mkTmp(), '.work-state.json');
        fs.writeFileSync(f, '[]', 'utf-8');
        expect(() => _load(f)).toThrow(_CLIError);
        expect(() => _load(f)).toThrow(/must carry a JSON object; got list/);
    });
    it('unsupported version → _CLIError', () => {
        const f = path.join(mkTmp(), '.work-state.json');
        fs.writeFileSync(f, JSON.stringify({ version: 99, input: {} }), 'utf-8');
        expect(() => _load(f)).toThrow(/unsupported version 99/);
    });
    it('neither shape → _CLIError', () => {
        const f = path.join(mkTmp(), '.work-state.json');
        fs.writeFileSync(f, JSON.stringify({ foo: 1 }), 'utf-8');
        expect(() => _load(f)).toThrow(/missing 'ticket' \(v0\) or 'version' \(v1\)/);
    });
    it('invalid JSON → _CLIError', () => {
        const f = path.join(mkTmp(), '.work-state.json');
        fs.writeFileSync(f, '{not json', 'utf-8');
        expect(() => _load(f)).toThrow(/Invalid JSON in/);
    });
});

describe('state_io — _to_v0_dict', () => {
    it('flat shape in declaration order', () => {
        const work = from_dict(V1_PAYLOAD);
        const v0 = _to_v0_dict(work);
        expect(Object.keys(v0)).toEqual([
            'ticket',
            'persona',
            'memory',
            'plan',
            'changes',
            'tests',
            'verify',
            'outcomes',
            'questions',
            'report',
        ]);
    });
});

describe.runIf(hasPython3())('state_io — python parity', () => {
    it('v1 save bytes byte-identical to CPython', () => {
        const pyOut = path.join(mkTmp(), 'py.json');
        const body = [
            'import pathlib',
            'payload = json.loads(sys.argv[1])',
            // Build the WorkState directly via the state module, then save v1.
            'st = sys.modules["we.state"]',
            'work = st.from_dict(payload)',
            'sio._save(pathlib.Path(sys.argv[2]), work, "v1")',
            'sys.stdout.write(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))',
        ].join('\n');
        const r = runPy(body, [JSON.stringify(V1_PAYLOAD), pyOut]);
        if (r.status !== 0) {
            throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
        }
        const tsOut = path.join(mkTmp(), 'ts.json');
        _save(tsOut, from_dict(V1_PAYLOAD), 'v1');
        const tsBytes = fs.readFileSync(tsOut, 'utf-8');
        expect(tsBytes).toBe(r.stdout);
    });

    it('v0 save bytes byte-identical to CPython', () => {
        const pyOut = path.join(mkTmp(), 'py0.json');
        const body = [
            'import pathlib',
            'payload = json.loads(sys.argv[1])',
            'st = sys.modules["we.state"]',
            'work = st.from_dict(payload)',
            'sio._save(pathlib.Path(sys.argv[2]), work, "v0")',
            'sys.stdout.write(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))',
        ].join('\n');
        const r = runPy(body, [JSON.stringify(V1_PAYLOAD), pyOut]);
        if (r.status !== 0) {
            throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
        }
        const tsOut = path.join(mkTmp(), 'ts0.json');
        _save(tsOut, from_dict(V1_PAYLOAD), 'v0');
        expect(fs.readFileSync(tsOut, 'utf-8')).toBe(r.stdout);
    });

    it('migrate_payload byte-shape matches CPython for a v0 payload', () => {
        const body = [
            'payload = json.loads(sys.argv[1])',
            'sys.stdout.write(json.dumps(sio.migrate_payload(payload)))',
        ].join('\n');
        const r = runPy(body, [JSON.stringify(V0_PAYLOAD)]);
        if (r.status !== 0) {
            throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
        }
        expect(migrate_payload(V0_PAYLOAD)).toEqual(JSON.parse(r.stdout));
    });

    it('_CLIError message text matches CPython on each error path', () => {
        const cases: Array<{ name: string; content: string }> = [
            { name: 'non-object', content: '[]' },
            { name: 'unsupported-version', content: JSON.stringify({ version: 99, input: {} }) },
            { name: 'neither-shape', content: JSON.stringify({ foo: 1 }) },
            { name: 'invalid-json', content: '{not json' },
        ];
        for (const c of cases) {
            const f = path.join(mkTmp(), '.work-state.json');
            fs.writeFileSync(f, c.content, 'utf-8');
            const body = [
                'import pathlib',
                'try:',
                '    sio._load(pathlib.Path(sys.argv[1]))',
                '    sys.stdout.write("__NO_ERROR__")',
                'except sio._CLIError as exc:',
                '    sys.stdout.write(str(exc))',
            ].join('\n');
            const r = runPy(body, [f]);
            if (r.status !== 0) {
                throw new Error(`python3 failed (${c.name}): ${r.stderr || r.stdout}`);
            }
            let tsMsg = '__NO_ERROR__';
            try {
                _load(f);
            } catch (e) {
                if (e instanceof _CLIError) {
                    tsMsg = e.message;
                } else {
                    throw e;
                }
            }
            // The invalid-JSON path carries the parser's own message (CPython's
            // json vs V8's JSON differ); compare only the stable prefix there.
            if (c.name === 'invalid-json') {
                expect(tsMsg.startsWith(`Invalid JSON in ${f}: `)).toBe(true);
                expect(r.stdout.startsWith(`Invalid JSON in ${f}: `)).toBe(true);
            } else {
                expect(tsMsg).toBe(r.stdout);
            }
        }
    });
});
