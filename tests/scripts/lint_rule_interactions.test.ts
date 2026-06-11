// Tests for src/scripts/lint_rule_interactions.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Coverage: constants spot-checks (ALLOWED_RELATIONS,
// ANCHOR_PARTNERS, ANCHOR_RULE, REQUIRED_PAIR_FIELDS) and a golden-parity layer
// (python3 vs tsx on the REAL REPO across default + --quiet) asserting
// byte-identical stdout/stderr/exit. Skipped without python3. CI invokes
// `lint_rule_interactions --quiet`.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_rule_interactions.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_rule_interactions.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_rule_interactions.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_rule_interactions — constants', () => {
    it('ALLOWED_RELATIONS holds the six relation kinds', () => {
        expect(new Set(mod.ALLOWED_RELATIONS)).toEqual(
            new Set(['overrides', 'narrows', 'defers_to', 'restates', 'gates', 'complements']),
        );
    });
    it('ANCHOR_RULE is non-destructive-by-default', () => {
        expect(mod.ANCHOR_RULE).toBe('non-destructive-by-default');
    });
    it('ANCHOR_PARTNERS holds the five anchor partners', () => {
        expect(new Set(mod.ANCHOR_PARTNERS)).toEqual(
            new Set([
                'autonomous-execution',
                'scope-control',
                'commit-policy',
                'ask-when-uncertain',
                'verify-before-complete',
            ]),
        );
    });
    it('REQUIRED_PAIR_FIELDS holds the required pair keys', () => {
        expect(new Set(mod.REQUIRED_PAIR_FIELDS)).toEqual(
            new Set(['id', 'rules', 'relation', 'conflict', 'resolution', 'evidence']),
        );
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('lint_rule_interactions — golden parity (python3 vs tsx)', () => {
    const runPy = (args: readonly string[]) =>
        spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    const runTs = (args: readonly string[]) =>
        spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

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
