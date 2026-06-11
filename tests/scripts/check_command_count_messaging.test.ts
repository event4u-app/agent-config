// Tests for src/scripts/check_command_count_messaging.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. canonical_counts() reads the live command suite, so
// the focused layer asserts its shape on the real tree; the golden-parity
// layer runs python3 vs tsx on the REAL REPO (skipped without python3) for
// both the default and --quiet invocations.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/check_command_count_messaging.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_command_count_messaging.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_command_count_messaging.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_command_count_messaging — canonical_counts', () => {
    it('total = active + shims, all non-negative', () => {
        const [total, shims, active] = mod.canonical_counts();
        expect(total).toBeGreaterThan(0);
        expect(shims).toBeGreaterThanOrEqual(0);
        expect(active).toBe(total - shims);
    });

    it('SUPERSEDED_RE matches a superseded_by frontmatter line', () => {
        expect(mod.SUPERSEDED_RE.test('superseded_by: other-cmd')).toBe(true);
        expect(mod.SUPERSEDED_RE.test('superseded_by:')).toBe(false);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_command_count_messaging — golden parity (python3 vs tsx)', () => {
    for (const args of [[], ['--quiet']] as const) {
        it(`matches byte-for-byte: ${args.join(' ') || '(no args)'}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
