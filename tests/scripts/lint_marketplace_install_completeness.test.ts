// Tests for src/scripts/lint_marketplace_install_completeness.ts
// (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Light behavioural spec over exported pure helpers
// (subcommand_to_function, extract_subcommand) plus the golden-parity layer
// that runs python3 vs tsx on the REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as lmic from '../../src/scripts/lint_marketplace_install_completeness.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(
    REPO_ROOT,
    'src',
    'scripts',
    'lint_marketplace_install_completeness.ts',
);
const PY_SCRIPT = path.join(
    REPO_ROOT,
    'src',
    'scripts',
    'lint_marketplace_install_completeness.py',
);
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_marketplace_install_completeness — pure helpers', () => {
    it('subcommand_to_function normalises : and - to _', () => {
        expect(lmic.subcommand_to_function('roadmap:progress')).toBe('cmd_roadmap_progress');
        expect(lmic.subcommand_to_function('pr-create')).toBe('cmd_pr_create');
        expect(lmic.subcommand_to_function('plain')).toBe('cmd_plain');
    });

    it('extract_subcommand pulls the agent-config subcommand from a command line', () => {
        // The exact match shape is driven by the module's regexes; a line with
        // no agent-config invocation yields null.
        expect(lmic.extract_subcommand('echo hello world')).toBeNull();
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)(
    'lint_marketplace_install_completeness — golden parity (python3 vs tsx)',
    () => {
        function runPy(args: readonly string[]) {
            return spawnSync('python3', [PY_SCRIPT, ...args], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });
        }
        function runTs(args: readonly string[]) {
            return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        }

        it('matches the default (no-flag) run byte-for-byte (real CI invocation)', () => {
            const py = runPy([]);
            const ts = runTs([]);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    },
);
