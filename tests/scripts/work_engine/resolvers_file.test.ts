// Golden-parity rig for the py2ts work_engine `resolvers/file` twin (ADR-094).
//
// Loads `state.py` as module `state`, then loads `resolvers/file.py` with its
// `from ..state import Input` rewritten to `from state import Input`. The file
// resolver does NO filesystem I/O (existence checks are deferred to the audit
// step); it only strips, rejects NUL / URLs, and POSIX-normalises backslashes
// when `os.sep == "/"`. The harness asserts envelope + error parity. The
// backslash-normalisation branch is host-conditional on both engines (it fires
// only on POSIX `os.sep == "/"` / `path.sep === "/"`), so the macOS / Linux CI
// runner exercises the same branch on both sides — reason: identical host.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    FileResolverError,
    KIND,
    build_envelope,
} from '../../../src/agent-src/templates/scripts/work_engine/resolvers/file.js';

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
const RESOLVER_PY = path.join(WE, 'resolvers', 'file.py');

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
        'except mod.FileResolverError as exc:',
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

const PY = hasPython3();
const describePy = PY ? describe : describe.skip;

describePy('resolvers/file — envelope parity (python3 vs tsx)', () => {
    const cases: Array<[string, string]> = [
        ['posix relative path', JSON.stringify('src/components/Sidebar.tsx')],
        ['blade path', JSON.stringify('resources/views/dashboard.blade.php')],
        ['absolute posix path preserved', JSON.stringify('/etc/hosts')],
        ['single char path', JSON.stringify('a')],
        ['surrounding whitespace stripped', JSON.stringify('  src/App.tsx  ')],
        ['windows backslashes → posix on this host', JSON.stringify('resources\\views\\foo.blade.php')],
        ['mixed separators', JSON.stringify('src\\a/b\\c.tsx')],
        ['non-ASCII path verbatim', JSON.stringify('src/Héllo.tsx')],
    ];
    for (const [label, raw] of cases) {
        it(`Input envelope parity — ${label}`, () => {
            // py json.dumps uses ', ' separators; tsEnvelope is compact —
            // the envelope content is the parity surface, not the separator style.
            expect(JSON.parse(tsEnvelope(raw))).toEqual(JSON.parse(pyEnvelope(raw)));
        });
    }
});

describePy('resolvers/file — error parity (python3 vs tsx)', () => {
    const cases: Array<[string, string]> = [
        ['empty string', JSON.stringify('')],
        ['whitespace-only', JSON.stringify('   \t ')],
        ['NUL byte', JSON.stringify('src/' + String.fromCharCode(0) + 'evil.tsx')],
        ['http URL', JSON.stringify('http://example.com/patch')],
        ['https URL', JSON.stringify('https://example.com/x')],
        ['ftp URL', JSON.stringify('ftp://host/f')],
        ['file URL', JSON.stringify('file:///tmp/x')],
        ['URL case-insensitive prefix', JSON.stringify('HTTPS://Example.com/A')],
        // The repr-of-slice tail (`{stripped[:32]!r}`) — long URL exercises the
        // 32-codepoint truncation byte-for-byte across engines.
        ['long https URL truncated in message', JSON.stringify('https://example.com/very/long/path/that/exceeds/thirty-two/characters')],
        ['url-ish with non-ascii in first 32', JSON.stringify('https://exämple.com/café-page')],
        ['not a string — number', JSON.stringify(3)],
        ['not a string — null', JSON.stringify(null)],
        ['not a string — list', JSON.stringify([])],
        ['not a string — object', JSON.stringify({})],
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

describe('resolvers/file — TS-side unit checks (no python3 needed)', () => {
    it('KIND constant', () => {
        expect(KIND).toBe('file');
    });
    it('builds the canonical envelope and posix-normalises backslashes', () => {
        const env = build_envelope('a\\b\\c.tsx');
        expect(env.kind).toBe('file');
        expect(env.data).toEqual({ path: 'a/b/c.tsx', reconstructed_ac: [], assumptions: [] });
    });
    it('rejects URLs', () => {
        expect(() => build_envelope('https://x.com')).toThrow(FileResolverError);
    });
});
