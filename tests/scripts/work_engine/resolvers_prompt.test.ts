// Golden-parity rig for the py2ts work_engine `resolvers/prompt` twin (ADR-094).
//
// `resolvers/prompt.py` imports `from ..state import Input`. To exercise it
// from python3 without importing the whole `work_engine` package (whose
// `__init__` pulls in unported siblings), we load `state.py` as the module
// `state`, then load the resolver source with its `from ..state import Input`
// rewritten to `from state import Input` and exec it as a standalone module.
//
// Each block drives `build_envelope` on BOTH engines from the same payload and
// asserts the serialised `Input` envelope (`{kind, data}`) is byte-identical,
// plus matching error-class name + message text on the reject paths. The TS
// side is exercised via the same module under `node node_modules/.bin/tsx`.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    KIND,
    PromptResolverError,
    build_envelope,
} from '../../../src/agent-src/templates/scripts/work_engine/resolvers/prompt.js';

const REPO_ROOT = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    '..',
    '..',
    '..',
);

const WE = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
);
const STATE_PY = path.join(WE, 'state.py');
const RESOLVER_PY = path.join(WE, 'resolvers', 'prompt.py');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/**
 * Run a python3 snippet with `state.py` loaded as module `state` and the
 * resolver loaded as module `mod` (its `from ..state import Input` rewritten
 * to `from state import Input`). `args` become `sys.argv[1:]`.
 */
function runPy(body: string, args: string[] = []): SpawnSyncReturns<string> {
    const loader = [
        'import sys, json, importlib.util',
        `_sspec = importlib.util.spec_from_file_location("state", ${JSON.stringify(STATE_PY)})`,
        'state = importlib.util.module_from_spec(_sspec)',
        'sys.modules["state"] = state',
        '_sspec.loader.exec_module(state)',
        `_src = open(${JSON.stringify(RESOLVER_PY)}, encoding="utf-8").read()`,
        '_src = _src.replace("from ..state import Input", "from state import Input")',
        'mod = type(sys)("mod")',
        'exec(compile(_src, "mod", "exec"), mod.__dict__)',
    ].join('\n');
    return spawnSync('python3', ['-c', `${loader}\n${body}`, ...args], {
        encoding: 'utf8',
    });
}

/** Python: build_envelope(arg) → json.dumps({"kind","data"}) of the Input. */
function pyEnvelope(rawJson: string): string {
    const body = [
        'raw = json.loads(sys.argv[1])',
        'env = mod.build_envelope(raw)',
        'sys.stdout.write(json.dumps({"kind": env.kind, "data": env.data}, ensure_ascii=False))',
    ].join('\n');
    const r = runPy(body, [rawJson]);
    if (r.status !== 0) throw new Error(`py envelope failed: ${r.stderr || r.stdout}`);
    return r.stdout;
}

/** Python: build_envelope(arg) expecting the resolver error → "<ClassName>: <msg>". */
function pyError(rawJson: string): string {
    const body = [
        'raw = json.loads(sys.argv[1])',
        'try:',
        '    mod.build_envelope(raw)',
        '    sys.stdout.write("__NO_ERROR__")',
        'except mod.PromptResolverError as exc:',
        '    sys.stdout.write(type(exc).__name__ + ": " + str(exc))',
    ].join('\n');
    const r = runPy(body, [rawJson]);
    if (r.status !== 0) throw new Error(`py error-probe failed: ${r.stderr || r.stdout}`);
    return r.stdout;
}

function tsEnvelope(rawJson: string): string {
    const raw = JSON.parse(rawJson);
    const env = build_envelope(raw);
    return JSON.stringify({ kind: env.kind, data: env.data });
}

function tsError(rawJson: string): string {
    const raw = JSON.parse(rawJson);
    try {
        build_envelope(raw);
        return '__NO_ERROR__';
    } catch (exc) {
        return `${(exc as Error).name}: ${(exc as Error).message}`;
    }
}

const PY = hasPython3();
const describePy = PY ? describe : describe.skip;

describePy('resolvers/prompt — envelope parity (python3 vs tsx)', () => {
    const cases: Array<[string, string]> = [
        ['plain prompt', JSON.stringify('improve the dashboard')],
        ['prompt with surrounding whitespace preserved', JSON.stringify('  spaced  ')],
        ['single non-whitespace char', JSON.stringify('a')],
        ['multiline prompt', JSON.stringify('line one\nline two\n')],
        ['non-ASCII verbatim', JSON.stringify('café — naïve ☕')],
        ['tabs + newlines around content', JSON.stringify('\t\nhello\n\t')],
    ];
    for (const [label, raw] of cases) {
        it(`Input envelope parity — ${label}`, () => {
            // py json.dumps uses ', ' separators; tsEnvelope is compact —
            // the envelope content is the parity surface, not the separator style.
            expect(JSON.parse(tsEnvelope(raw))).toEqual(JSON.parse(pyEnvelope(raw)));
        });
    }
});

describePy('resolvers/prompt — error parity (python3 vs tsx)', () => {
    const cases: Array<[string, string]> = [
        ['empty string', JSON.stringify('')],
        ['whitespace-only', JSON.stringify('   \t\n ')],
        ['not a string — number', JSON.stringify(5)],
        ['not a string — null', JSON.stringify(null)],
        ['not a string — list', JSON.stringify([1, 2])],
        ['not a string — object', JSON.stringify({ a: 1 })],
        ['not a string — bool', JSON.stringify(true)],
    ];
    for (const [label, raw] of cases) {
        it(`identical error class + message — ${label}`, () => {
            const py = pyError(raw);
            const ts = tsError(raw);
            expect(py).not.toBe('__NO_ERROR__');
            expect(ts).toBe(py);
        });
    }
});

describe('resolvers/prompt — TS-side unit checks (no python3 needed)', () => {
    it('KIND constant', () => {
        expect(KIND).toBe('prompt');
    });
    it('builds the canonical envelope shape', () => {
        const env = build_envelope('hi');
        expect(env.kind).toBe('prompt');
        expect(env.data).toEqual({ raw: 'hi', reconstructed_ac: [], assumptions: [] });
    });
    it('throws PromptResolverError on empty', () => {
        expect(() => build_envelope('  ')).toThrow(PromptResolverError);
    });
});
