// Tests for src/scripts/check_augment_description_cap.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists, so this is a focused differential suite over the
// public behaviour (parse_frontmatter, DESC_CAP) plus a golden-parity layer
// (python3 vs tsx) on the REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DESC_CAP, parse_frontmatter } from '../../src/scripts/check_augment_description_cap.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_augment_description_cap.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_augment_description_cap.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('parse_frontmatter', () => {
    it('parses simple key/value pairs and strips quotes', () => {
        const fm = parse_frontmatter('---\ntype: auto\ndescription: "Hello world"\n---\nbody\n');
        expect(fm['type']).toBe('auto');
        expect(fm['description']).toBe('Hello world');
    });

    it('strips single quotes after double', () => {
        const fm = parse_frontmatter("---\ndescription: 'x'\n---\n");
        expect(fm['description']).toBe('x');
    });

    it('returns empty for missing frontmatter', () => {
        expect(parse_frontmatter('no frontmatter here')).toEqual({});
    });

    it('returns empty when closing fence absent', () => {
        expect(parse_frontmatter('---\ntype: auto\n')).toEqual({});
    });

    it('DESC_CAP is 150', () => {
        expect(DESC_CAP).toBe(150);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_augment_description_cap — golden parity (python3 vs tsx)', () => {
    it('matches byte-for-byte on the real repo', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
