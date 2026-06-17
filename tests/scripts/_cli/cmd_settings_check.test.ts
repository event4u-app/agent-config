// Golden-parity tests for src/scripts/_cli/cmd_settings_check.ts (py2ts ADR-200
// — the read-only .agent-settings.yml YAML-subset validator).
//
// Strategy: run `python3 src/scripts/_cli/cmd_settings_check.py` vs
// `tsx src/scripts/_cli/cmd_settings_check.ts` against the SAME fixture file in
// a temp dir and byte-compare stdout / stderr / exit. The command is read-only,
// so no mutation guard is needed beyond using throwaway fixtures. The suite
// never touches the real repo, the network, or a browser. The project root is
// pinned to the temp dir so the round-trip-parser gate import resolves without
// reading the real settings file.
//
// Coverage map:
//   - usage / arg-error exit codes (exit + usage+error stderr; --help body NOT
//     byte-compared).
//   - file absent → exit 2 (and --allow-missing → exit 0, with/without --quiet).
//   - clean in-subset file → exit 0.
//   - each pre-scan rule family (separator, complex key, block scalar, tag,
//     anchor, nested flow, tab-in-indent) → exit 1 + finding lines.
//   - round-trip parser gate finding (malformed mapping the pre-scan misses).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_settings_check.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_settings_check.py');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();
const itPy = py3 ? it : it.skip;

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function rootEnv(root: string): Record<string, string> {
    return { AGENT_CONFIG_ROOT_OVERRIDE: '1', AGENT_CONFIG_PROJECT_ROOT: root };
}

function runPy(args: string[], root: string): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '80', PYTHONPATH: path.join(REPO_ROOT, 'src'), ...rootEnv(root) },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], root: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '80', ...rootEnv(root) },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const roots: string[] = [];
function freshRoot(): string {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acchk-'));
    roots.push(r);
    return r;
}

afterEach(() => {
    while (roots.length) {
        const r = roots.pop()!;
        try {
            fs.rmSync(r, { recursive: true, force: true });
        } catch {
            /* best-effort */
        }
    }
});

/** Write fixture in the root, return its absolute path. */
function writeFixture(root: string, body: string, name = '.agent-settings.yml'): string {
    const p = path.join(root, name);
    fs.writeFileSync(p, body);
    return p;
}

/** Byte-compare a (py, ts) run on the same args + root. */
function expectParity(args: string[], root: string): void {
    const p = runPy(args, root);
    const t = runTs(args, root);
    expect(t.status).toBe(p.status);
    expect(t.stdout).toBe(p.stdout);
    expect(t.stderr).toBe(p.stderr);
}

// ---------------------------------------------------------------------------
// usage / arg errors
// ---------------------------------------------------------------------------

describe('cmd_settings_check — usage / arg errors', () => {
    itPy('unknown flag → exit 2 + usage+error stderr', () => {
        const root = freshRoot();
        const p = runPy(['--bogus'], root);
        const t = runTs(['--bogus'], root);
        expect(t.status).toBe(2);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
        expect(t.stdout).toBe(p.stdout);
    });

    itPy('--path without a value → exit 2', () => {
        const root = freshRoot();
        const p = runPy(['--path'], root);
        const t = runTs(['--path'], root);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    itPy('--help → exit 0 + usage banner first line (body prose exempt)', () => {
        const root = freshRoot();
        const p = runPy(['--help'], root);
        const t = runTs(['--help'], root);
        expect(t.status).toBe(0);
        expect(p.status).toBe(0);
        expect(t.stdout.split('\n')[0]).toBe(p.stdout.split('\n')[0]);
    });
});

// ---------------------------------------------------------------------------
// file presence
// ---------------------------------------------------------------------------

describe('cmd_settings_check — file presence', () => {
    itPy('absent file (no flag) → exit 2 + stderr hint', () => {
        const root = freshRoot();
        expectParity(['--path', path.join(root, 'missing.yml')], root);
    });

    itPy('absent file + --allow-missing → exit 0 + notice', () => {
        const root = freshRoot();
        expectParity(['--path', path.join(root, 'missing.yml'), '--allow-missing'], root);
    });

    itPy('absent file + --allow-missing + --quiet → exit 0, no stdout', () => {
        const root = freshRoot();
        const args = ['--path', path.join(root, 'missing.yml'), '--allow-missing', '--quiet'];
        const p = runPy(args, root);
        const t = runTs(args, root);
        expect(t.status).toBe(0);
        expect(t.stdout).toBe('');
        expect(t.stdout).toBe(p.stdout);
    });
});

// ---------------------------------------------------------------------------
// clean subset + --quiet
// ---------------------------------------------------------------------------

describe('cmd_settings_check — in-subset file', () => {
    itPy('clean mapping → exit 0 + success line', () => {
        const root = freshRoot();
        const p = writeFixture(root, 'foo: bar\nnested:\n  child: 1\nlist:\n  - a\n  - b\n');
        expectParity(['--path', p], root);
    });

    itPy('clean mapping + --quiet → exit 0, no stdout', () => {
        const root = freshRoot();
        const p = writeFixture(root, 'foo: bar\n');
        const py = runPy(['--path', p, '--quiet'], root);
        const ts = runTs(['--path', p, '--quiet'], root);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toBe('');
        expect(ts.stdout).toBe(py.stdout);
    });
});

// ---------------------------------------------------------------------------
// pre-scan rule families — each → exit 1 + identical finding lines
// ---------------------------------------------------------------------------

describe('cmd_settings_check — pre-scan findings', () => {
    const cases: Array<[string, string]> = [
        ['multi-doc separator', 'foo: bar\n---\nbaz: 1\n'],
        ['complex key', '? a\n: b\n'],
        ['block-scalar indicator', 'foo: |\n  multi\n  line\n'],
        ['tagged scalar', 'foo: !!str 123\n'],
        ['anchor / alias', 'foo: &anchor 1\nbar: *anchor\n'],
        ['nested flow-mapping', 'foo: {a: 1, b: 2}\n'],
        ['tab in indent', 'foo:\n\tbar: 1\n'],
        ['multiple findings', 'foo: bar\n---\n? complex\nbaz: !!int 3\n'],
    ];
    for (const [label, body] of cases) {
        itPy(`${label} → exit 1 + identical findings`, () => {
            const root = freshRoot();
            const p = writeFixture(root, body);
            expectParity(['--path', p], root);
        });
    }
});

// ---------------------------------------------------------------------------
// round-trip parser gate — pre-scan passes, parser rejects
// ---------------------------------------------------------------------------

describe('cmd_settings_check — round-trip parser gate', () => {
    itPy('mapping line without a colon → parser finding (exit 1)', () => {
        // No pre-scan rule matches, but sync_yaml_rt.parse rejects the line.
        const root = freshRoot();
        const p = writeFixture(root, 'foo bar baz\n');
        expectParity(['--path', p], root);
    });

    itPy('indent underflow → parser finding (exit 1)', () => {
        const root = freshRoot();
        const p = writeFixture(root, 'parent:\n    deep: 1\n  shallow: 2\n');
        expectParity(['--path', p], root);
    });
});
