// Tests for src/scripts/check_cluster_patterns.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists, so this is a focused differential suite over the
// public behaviour (load_cluster_table, parse_frontmatter, check_dispatcher,
// build_slug_map) plus a golden-parity layer (python3 vs tsx) on the REAL
// REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    build_slug_map,
    check_dispatcher,
    load_cluster_table,
    parse_frontmatter,
} from '../../src/scripts/check_cluster_patterns.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_cluster_patterns.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_cluster_patterns.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_cluster_patterns — parse_frontmatter', () => {
    it('parses top-level keys only (skips indented)', () => {
        const [fm, body] = parse_frontmatter(
            '---\nname: fix\ncluster: fix\n  nested: skip\n---\n# /fix\n',
        );
        expect(fm['name']).toBe('fix');
        expect(fm['cluster']).toBe('fix');
        expect(fm['nested']).toBeUndefined();
        expect(body).toBe('# /fix\n');
    });

    it('returns empty fm + original text when no frontmatter', () => {
        const [fm, body] = parse_frontmatter('# /fix\n');
        expect(fm).toEqual({});
        expect(body).toBe('# /fix\n');
    });
});

describe('check_cluster_patterns — table + slug map', () => {
    it('load_cluster_table returns dispatch/flag rows from the real contract', () => {
        const rows = load_cluster_table();
        expect(rows.length).toBeGreaterThan(0);
        for (const [, kind] of rows) {
            expect(['dispatch', 'flag']).toContain(kind);
        }
    });

    it('build_slug_map returns physical paths keyed by canonical slug', () => {
        const m = build_slug_map();
        // Every value is a real command.md path.
        for (const p of m.values()) {
            expect(p.endsWith(path.join('command.md'))).toBe(true);
        }
    });

    it('check_dispatcher reports a missing dispatcher for an unknown slug', () => {
        const rep = check_dispatcher('definitely-not-a-cluster', new Map());
        expect(rep.errors.some((e) => e.startsWith('dispatcher file missing:'))).toBe(true);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_cluster_patterns — golden parity (python3 vs tsx)', () => {
    it('matches byte-for-byte on the real repo', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
