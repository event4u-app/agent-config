// Tests for src/scripts/check_token_optimizer_freshness.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the pure helpers (parse_catalog, is_external) plus a
// golden-parity layer that runs python3 vs tsx on the REAL REPO
// (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as tof from '../../src/scripts/check_token_optimizer_freshness.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_token_optimizer_freshness.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_token_optimizer_freshness.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_token_optimizer_freshness — behavioural spec', () => {
    it('parse_catalog reads rows only inside the ## Catalog section', () => {
        const text = [
            '## Intro',
            '| not | a | catalog | row |',
            '## Catalog',
            '| Asset | Path | Keywords | Description |',
            '|-------|------|----------|-------------|',
            '| `foo` | rules/foo.md | `kw1`, `kw2` | does foo |',
            '## After',
            '| also | not | a | row |',
        ].join('\n');
        const rows = tof.parse_catalog(text);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.name).toBe('foo');
        expect(rows[0]!.path).toBe('rules/foo.md');
        expect(rows[0]!.keywords).toBe('`kw1`, `kw2`');
        expect(rows[0]!.desc).toBe('does foo');
    });

    it('is_external recognises upstream / http / tbd / github.com', () => {
        expect(tof.is_external('upstream:foo')).toBe(true);
        expect(tof.is_external('https://example.com')).toBe(true);
        expect(tof.is_external('http://example.com')).toBe(true);
        expect(tof.is_external('TBD-someday')).toBe(true);
        expect(tof.is_external('see github.com/x/y')).toBe(true);
        expect(tof.is_external('rules/foo.md')).toBe(false);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('check_token_optimizer_freshness — golden parity (python3 vs tsx)', () => {
    it('matches byte-for-byte on the real catalog', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
