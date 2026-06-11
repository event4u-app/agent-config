// Tests for src/scripts/lint_archived_skills.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. Focused differential over the pure frontmatter
// parser plus a golden-parity layer running python3 vs tsx on the REAL REPO
// (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as as from '../../src/scripts/lint_archived_skills.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_archived_skills.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_archived_skills.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_archived_skills.parse_frontmatter', () => {
    it('parses simple key: value lines, stripping quotes', () => {
        const fm = as.parse_frontmatter('---\nslug: foo\nreason: "merged"\n---\nbody\n');
        expect(fm).not.toBeNull();
        expect(fm!['slug']).toBe('foo');
        expect(fm!['reason']).toBe('merged');
    });

    it('ignores indented and list lines (top-level scalars only)', () => {
        const fm = as.parse_frontmatter(
            '---\nslug: foo\nlast_known_callers:\n  - a\n  - b\n---\n',
        );
        expect(fm).not.toBeNull();
        expect(fm!['slug']).toBe('foo');
        // The list items are skipped; only the scalar key is recorded (possibly empty).
        expect('a' in fm!).toBe(false);
    });

    it('returns null without a leading frontmatter fence', () => {
        expect(as.parse_frontmatter('no frontmatter\n')).toBeNull();
    });

    it('returns null when the closing fence is missing', () => {
        expect(as.parse_frontmatter('---\nslug: foo\n')).toBeNull();
    });
});

describe('lint_archived_skills — constants', () => {
    it('declares the six required fields and the valid reasons', () => {
        expect([...as.REQUIRED_FIELDS]).toEqual([
            'slug',
            'archived_on',
            'last_seen_count',
            'reason',
            'replacement',
            'last_known_callers',
        ]);
        expect([...as.VALID_REASONS].sort()).toEqual([
            'deprecated',
            'merged',
            'superseded',
            'unused',
        ]);
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_archived_skills — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function same(args: readonly string[]): void {
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('default run matches byte-for-byte', () => same([]));
    it('--quiet matches byte-for-byte', () => same(['--quiet']));
});
