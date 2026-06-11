// Tests for src/scripts/check_release_pr_shape.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_check_release_pr_shape.py — check() + _matches()
// drive the allowlist; stdout is captured. Plus golden parity on the REAL
// REPO via the --files path (no gh dependency; skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as shape from '../../src/scripts/check_release_pr_shape.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_release_pr_shape.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_release_pr_shape.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function runCheck(files: readonly string[]): { code: number; out: string } {
    const out: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: unknown }).write = (s: string): boolean => {
        out.push(String(s));
        return true;
    };
    let code: number;
    try {
        code = shape.check(files);
    } finally {
        process.stdout.write = orig;
    }
    return { code, out: out.join('') };
}

describe('check_release_pr_shape — check() (ported pytest)', () => {
    it('real 3.3.0 release-PR shape passes', () => {
        const files = [
            'package.json',
            'CHANGELOG.md',
            '.claude-plugin/marketplace.json',
            'src/packs/core/pack.yaml',
            'src/packs/core/README.md',
            'src/packs/finance-basic/pack.yaml',
            'src/packs/finance-basic/README.md',
        ];
        const { code, out } = runCheck(files);
        expect(code).toBe(0);
        expect(out).toContain('SHAPE-CLEAN');
        for (const f of files) {
            expect(out).toContain(`ok: ${f}`);
        }
    });

    it('stray install script fails', () => {
        const { code, out } = runCheck(['package.json', 'CHANGELOG.md', 'src/scripts/install.py']);
        expect(code).toBe(1);
        expect(out).toContain('OUT-OF-SHAPE: src/scripts/install.py');
        expect(out).not.toContain('ok: package.json');
    });

    it('empty diff fails', () => {
        const { code, out } = runCheck([]);
        expect(code).toBe(1);
        expect(out).toContain('empty diff');
    });

    it('pack-only release passes', () => {
        const { code } = runCheck([
            'package.json',
            'CHANGELOG.md',
            'src/packs/core/pack.yaml',
            'src/packs/finance-basic/pack.yaml',
            'src/packs/founder-strategy/pack.yaml',
        ]);
        expect(code).toBe(0);
    });

    it('nested package file fails', () => {
        const { code, out } = runCheck(['package.json', 'src/packs/core/installer/foo.ts']);
        expect(code).toBe(1);
        expect(out).toContain('OUT-OF-SHAPE: src/packs/core/installer/foo.ts');
    });

    it('marketplace metadata only passes', () => {
        expect(runCheck(['.claude-plugin/marketplace.json']).code).toBe(0);
    });

    it('changelog only passes', () => {
        expect(runCheck(['CHANGELOG.md']).code).toBe(0);
    });

    it('pack README only passes', () => {
        expect(runCheck(['src/packs/core/README.md']).code).toBe(0);
    });

    it('era archive release passes', () => {
        const { code, out } = runCheck([
            'package.json',
            'CHANGELOG.md',
            '.claude-plugin/marketplace.json',
            'src/packs/core/pack.yaml',
            'src/packs/core/README.md',
            'docs/archive/CHANGELOG-pre-5.4.0.md',
        ]);
        expect(code).toBe(0);
        expect(out).toContain('SHAPE-CLEAN');
    });

    it('unrelated archive file fails', () => {
        const { code, out } = runCheck(['package.json', 'docs/archive/some-other-doc.md']);
        expect(code).toBe(1);
        expect(out).toContain('OUT-OF-SHAPE: docs/archive/some-other-doc.md');
    });

    it('_matches rejects unrelated paths, accepts allowlist', () => {
        expect(shape._matches('src/scripts/install.py')).toBe(false);
        expect(shape._matches('tests/test_condense.py')).toBe(false);
        expect(shape._matches('.github/workflows/tests.yml')).toBe(false);
        expect(shape._matches('src/packs/core/installer/foo.ts')).toBe(false);
        expect(shape._matches('docs/archive/some-other-doc.md')).toBe(false);
        expect(shape._matches('package.json')).toBe(true);
        expect(shape._matches('src/packs/core/pack.yaml')).toBe(true);
        expect(shape._matches('src/packs/core/README.md')).toBe(true);
        expect(shape._matches('docs/archive/CHANGELOG-pre-5.4.0.md')).toBe(true);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_release_pr_shape — golden parity (python3 vs tsx)', () => {
    function run(bin: string, script: string, args: readonly string[]) {
        return spawnSync(bin, [script, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    const cases: string[][] = [
        ['--files=package.json,CHANGELOG.md,src/packs/core/pack.yaml'],
        ['--files=package.json,src/scripts/install.py'],
        ['--files='],
    ];
    for (const args of cases) {
        it(`matches byte-for-byte: ${args[0]}`, () => {
            const py = run('python3', PY_SCRIPT, args);
            const ts = run(TSX_BIN, TS_SCRIPT, args);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
