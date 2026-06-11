// Tests for src/scripts/lint_pack_boundaries.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public behaviour (link regex, link resolution semantics,
// allow rules, artefact index) plus a golden-parity layer that runs python3
// vs tsx on the REAL REPO (skipped without python3). The real repo has no
// packages/ tree, so the no-arg run exercises the "skip" path.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as lpb from '../../src/scripts/lint_pack_boundaries.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_pack_boundaries.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_pack_boundaries.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_pack_boundaries — behavioural spec', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lpb-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function write(rel: string, content: string): string {
        const p = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, content, 'utf-8');
        return p;
    }

    // --- LINK_RE extracts the target, stripping fragment / query. ---
    it('scan extracts markdown link targets and strips #/?', () => {
        const f = write(
            'doc.md',
            'See [a](./other.md#frag) and [b](../up.md?x=1) and [c](https://ex.com).',
        );
        expect(lpb._scan_file(f)).toEqual(['./other.md', '../up.md', 'https://ex.com']);
    });

    // --- _resolve_link ignores external / absolute targets. ---
    it('_resolve_link returns null for http/mailto/absolute', () => {
        const src = path.join(tmp, 'a/b.md');
        expect(lpb._resolve_link(src, 'https://example.com')).toBeNull();
        expect(lpb._resolve_link(src, 'mailto:x@y.z')).toBeNull();
        expect(lpb._resolve_link(src, '/abs/web/path')).toBeNull();
        expect(lpb._resolve_link(src, '')).toBeNull();
    });

    // --- _is_allowed rules: same pack, core, or declared requires. ---
    it('_is_allowed: same pack always allowed', () => {
        expect(lpb._is_allowed('alpha', 'alpha', [])).toBe(true);
    });
    it('_is_allowed: core target always allowed', () => {
        expect(lpb._is_allowed('alpha', 'core', [])).toBe(true);
    });
    it('_is_allowed: declared requires allowed, undeclared denied', () => {
        expect(lpb._is_allowed('alpha', 'beta', ['beta'])).toBe(true);
        expect(lpb._is_allowed('alpha', 'beta', [])).toBe(false);
    });

    // --- _load_pack_meta reads pack.yaml or returns {}. ---
    it('_load_pack_meta returns {} when pack.yaml is absent', () => {
        fs.mkdirSync(path.join(tmp, 'pkg'), { recursive: true });
        expect(lpb._load_pack_meta(path.join(tmp, 'pkg'))).toEqual({});
    });
    it('_load_pack_meta parses pack.yaml mapping', () => {
        write('pkg/pack.yaml', 'id: my-pack\nrequires:\n  - core\n');
        const meta = lpb._load_pack_meta(path.join(tmp, 'pkg'));
        expect(meta['id']).toBe('my-pack');
        expect(meta['requires']).toEqual(['core']);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_pack_boundaries — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default (no-flag) run byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches --format json byte-for-byte', () => {
        const py = runPy(['--format', 'json']);
        const ts = runTs(['--format', 'json']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches --quiet byte-for-byte (real CI invocation)', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
