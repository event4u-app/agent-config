// Golden-parity rig for the py2ts work_engine `resolvers/diff` twin (ADR-094).
//
// Loads `state.py` as module `state`, then loads `resolvers/diff.py` with its
// `from ..state import Input` rewritten to `from state import Input`. The diff
// resolver does no subprocess / git work — it is a pure header-heuristic check
// on the raw payload — so the golden harness compares the built `Input`
// envelope and the reject-path error text on both engines.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    DiffResolverError,
    KIND,
    build_envelope,
} from '../../../src/agent-src/templates/scripts/work_engine/resolvers/diff.js';

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
const RESOLVER_PY = path.join(WE, 'resolvers', 'diff.py');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

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

function pyError(rawJson: string): string {
    const body = [
        'raw = json.loads(sys.argv[1])',
        'try:',
        '    mod.build_envelope(raw)',
        '    sys.stdout.write("__NO_ERROR__")',
        'except mod.DiffResolverError as exc:',
        '    sys.stdout.write(type(exc).__name__ + ": " + str(exc))',
    ].join('\n');
    const r = runPy(body, [rawJson]);
    if (r.status !== 0) throw new Error(`py error-probe failed: ${r.stderr || r.stdout}`);
    return r.stdout;
}

function tsEnvelope(rawJson: string): string {
    const env = build_envelope(JSON.parse(rawJson));
    return JSON.stringify({ kind: env.kind, data: env.data });
}

function tsError(rawJson: string): string {
    try {
        build_envelope(JSON.parse(rawJson));
        return '__NO_ERROR__';
    } catch (exc) {
        return `${(exc as Error).name}: ${(exc as Error).message}`;
    }
}

const GIT_DIFF = [
    'diff --git a/foo.ts b/foo.ts',
    'index e69de29..4b825dc 100644',
    '--- a/foo.ts',
    '+++ b/foo.ts',
    '@@ -0,0 +1 @@',
    '+const x = 1;',
].join('\n');

const UNIFIED_DIFF = [
    '--- old.txt',
    '+++ new.txt',
    '@@ -1 +1 @@',
    '-a',
    '+b',
].join('\n');

const PY = hasPython3();
const describePy = PY ? describe : describe.skip;

describePy('resolvers/diff — envelope parity (python3 vs tsx)', () => {
    const cases: Array<[string, string]> = [
        ['git diff', JSON.stringify(GIT_DIFF)],
        ['unified diff', JSON.stringify(UNIFIED_DIFF)],
        ['Index: header (SVN/CVS)', JSON.stringify('Index: foo\n===\n')],
        ['hunk-header only (semantically empty diff accepted)', JSON.stringify('@@ -1 +1 @@')],
        ['marker not at line start is still searched line-wise', JSON.stringify('prelude\n--- a\n')],
        ['non-ASCII in diff body verbatim', JSON.stringify('--- a\n+++ b\n@@ -1 +1 @@\n+café ☕')],
    ];
    for (const [label, raw] of cases) {
        it(`Input envelope parity — ${label}`, () => {
            // py json.dumps uses ', ' separators; tsEnvelope is compact —
            // the envelope content is the parity surface, not the separator style.
            expect(JSON.parse(tsEnvelope(raw))).toEqual(JSON.parse(pyEnvelope(raw)));
        });
    }
});

describePy('resolvers/diff — error parity (python3 vs tsx)', () => {
    const cases: Array<[string, string]> = [
        ['empty string', JSON.stringify('')],
        ['whitespace-only', JSON.stringify('  \n\t ')],
        ['prose, no diff markers', JSON.stringify('please improve the dashboard layout')],
        ['inline marker inside prose (not at line start)', JSON.stringify('the function `--- foo` failed')],
        ['not a string — number', JSON.stringify(7)],
        ['not a string — null', JSON.stringify(null)],
        ['not a string — list', JSON.stringify(['x'])],
        ['not a string — bool', JSON.stringify(false)],
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

describe('resolvers/diff — TS-side unit checks (no python3 needed)', () => {
    it('KIND constant', () => {
        expect(KIND).toBe('diff');
    });
    it('accepts a git diff and builds the canonical shape', () => {
        const env = build_envelope(GIT_DIFF);
        expect(env.kind).toBe('diff');
        expect(env.data).toEqual({ raw: GIT_DIFF, reconstructed_ac: [], assumptions: [] });
    });
    it('rejects prose with no markers', () => {
        expect(() => build_envelope('just words here')).toThrow(DiffResolverError);
    });
});
