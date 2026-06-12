// Tests for src/scripts/update_counts.ts (py2ts Phase 5).
//
// Two layers:
//   1. 1:1 port of tests/test_update_counts.py — apply_to_text substitutions /
//      drift detection, count() against the real tree, the TARGETS regression
//      guard, and the --check end-to-end on a clean tree.
//   2. Golden parity on the REAL REPO: python3 --check and tsx --check produce
//      byte-identical stdout/stderr/exit; tsx update mode leaves README /
//      getting-started / architecture with ZERO drift (the repo is in-sync).
//      Skipped when python3 is absent.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as uc from '../../src/scripts/update_counts.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'update_counts.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'update_counts.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

afterEach(() => {
    vi.restoreAllMocks();
});

// Suppress the stderr warning apply_to_text emits on a missed pattern (the
// unittest test_missing_pattern_does_not_crash expects no crash, not silence).
function withSilentStderr<T>(fn: () => T): T {
    const se = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
        return fn();
    } finally {
        se.mockRestore();
    }
}

// --- Layer 1: ported behavioural spec (apply_to_text) -----------------------

describe('update_counts.apply_to_text — ported from pytest', () => {
    it('replaces single number in match', () => {
        const text = 'Browse all 54 commands] today.';
        const counts = { commands: 57 };
        const patterns: Array<[string, string]> = [['(Browse all )(\\d+)( commands\\])', 'commands']];
        const [newText, drifts] = uc.apply_to_text(text, patterns, counts);
        expect(newText).toContain('Browse all 57 commands]');
        expect(drifts).toEqual([['commands', 54, 57]]);
    });

    it('no drift when number matches', () => {
        const text = 'Browse all 57 commands].';
        const counts = { commands: 57 };
        const patterns: Array<[string, string]> = [['(Browse all )(\\d+)( commands\\])', 'commands']];
        const [newText, drifts] = uc.apply_to_text(text, patterns, counts);
        expect(newText).toBe(text);
        expect(drifts).toEqual([]);
    });

    it('missing pattern does not crash', () => {
        const text = 'unrelated content';
        const counts = { commands: 57 };
        const patterns: Array<[string, string]> = [['(Browse all )(\\d+)( commands\\])', 'commands']];
        const [newText, drifts] = withSilentStderr(() => uc.apply_to_text(text, patterns, counts));
        expect(newText).toBe(text);
        expect(drifts).toEqual([]);
    });

    it('multiple patterns applied independently', () => {
        const text = 'Has 100 skills and 54 commands.';
        const counts = { skills: 112, commands: 57 };
        const patterns: Array<[string, string]> = [
            ['(Has )(\\d+)( skills)', 'skills'],
            ['(and )(\\d+)( commands)', 'commands'],
        ];
        const [newText, drifts] = uc.apply_to_text(text, patterns, counts);
        expect(newText).toContain('Has 112 skills');
        expect(newText).toContain('and 57 commands');
        const sorted = (d: Array<[string, number, number]>): Array<[string, number, number]> =>
            [...d].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
        expect(sorted(drifts)).toEqual(
            sorted([
                ['skills', 100, 112],
                ['commands', 54, 57],
            ]),
        );
    });

    it('same pattern multiple matches all updated', () => {
        const text = 'Browse all 54 commands] and Browse all 54 commands] later.';
        const counts = { commands: 57 };
        const patterns: Array<[string, string]> = [['(Browse all )(\\d+)( commands\\])', 'commands']];
        const [newText, drifts] = uc.apply_to_text(text, patterns, counts);
        expect((newText.match(/Browse all 57 commands\]/g) ?? []).length).toBe(2);
        expect(drifts.length).toBe(2);
    });
});

describe('update_counts.count — sanity against the real tree', () => {
    it('skills non-zero', () => {
        expect(uc.count('skills')).toBeGreaterThan(0);
    });
    it('rules non-zero', () => {
        expect(uc.count('rules')).toBeGreaterThan(0);
    });
    it('commands non-zero', () => {
        expect(uc.count('commands')).toBeGreaterThan(0);
    });
    it('guidelines counts nested', () => {
        expect(uc.count('guidelines')).toBeGreaterThan(0);
    });
    it('personas non-zero', () => {
        expect(uc.count('personas')).toBeGreaterThan(0);
    });
});

describe('update_counts.TARGETS — regression guard', () => {
    it('stronger-skills baseline is not tracked', () => {
        const paths = uc.TARGETS.map(([rel]) => rel);
        expect(paths).not.toContain('agents/roadmaps/road-to-stronger-skills.md');
        expect(paths).not.toContain('agents/roadmaps/skipped/road-to-stronger-skills.md');
    });
});

// --- Layer 2: golden parity on the REAL REPO -------------------------------

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

describe.skipIf(!py3)('update_counts — golden parity (python3 vs tsx)', () => {
    it('--check stdout/stderr/exit byte-identical', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('--check passes on a clean tree (exit 0)', () => {
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(0);
    });

    it('update mode reproduces committed docs with ZERO drift', () => {
        const targets = uc.TARGETS.map(([rel]) => path.join(REPO_ROOT, rel));
        const before = targets.map((p) => fs.readFileSync(p, 'utf-8'));
        try {
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
            expect(ts.status).toBe(0);
            // The repo is in-sync, so update mode must leave every target byte-identical.
            targets.forEach((p, i) => {
                expect(fs.readFileSync(p, 'utf-8')).toBe(before[i]);
            });
        } finally {
            // Restore defensively even though zero-drift is expected.
            targets.forEach((p, i) => fs.writeFileSync(p, before[i] as string, 'utf-8'));
        }
    });
});
