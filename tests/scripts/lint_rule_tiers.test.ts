// Tests for src/scripts/lint_rule_tiers.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Focused differential coverage of the public helper
// parse_tier plus a golden-parity layer that runs python3 vs tsx on the REAL
// REPO across the real CI args (default + --quiet), asserting byte-identical
// stdout/stderr/exit. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_rule_tiers.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_rule_tiers.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_rule_tiers.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_rule_tiers — behavioural spec (parse_tier)', () => {
    it('returns the tier value from frontmatter', () => {
        expect(mod.parse_tier('---\ntier: 2a\nname: x\n---\nbody\n')).toBe('2a');
    });

    it('returns null when there is no opening fence', () => {
        expect(mod.parse_tier('no fence\ntier: 1\n')).toBeNull();
    });

    it('returns null when tier is absent', () => {
        expect(mod.parse_tier('---\nname: x\n---\nbody\n')).toBeNull();
    });

    it('strips quotes around the tier value', () => {
        expect(mod.parse_tier('---\ntier: "safety-floor"\n---\n')).toBe('safety-floor');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_rule_tiers — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    for (const args of [[], ['--quiet']]) {
        it(`matches \`${args.join(' ') || '(default)'}\` byte-for-byte`, () => {
            const py = runPy(args);
            const ts = runTs(args);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
