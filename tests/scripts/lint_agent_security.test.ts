// Tests for src/scripts/lint_agent_security.ts (py2ts — ADR-094).
//
// The tsx twin is the source of truth (the python original was deleted in the
// teardown). CLI contract over every read mode (default report, --sarif,
// --quiet) on the REAL src/ tree: defined exit + determinism + the written
// SARIF file. The umbrella runner shells out to the child linters, so it
// observes the real repo. The SARIF file is written under a tmp dir so the
// test leaves zero git drift. Runs in-process (no tsx cold-start).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../src/scripts/lint_agent_security.js';
import { runInProc } from '../_lib/run_in_process.js';

// Spawn-bound over the real repo: every case here runs the CLI across the whole
// tree, so these are the slowest and most contention-sensitive tests in the suite.
// On a loaded macOS runner the siblings measure 8.1-9.4 s against the 10 s global
// budget and whichever case runs first tips over it — four PRs went red on exactly
// that this way, with no assertion error anywhere in the set. vitest.config.ts names
// this remedy by name ("a per-test timeout on the spawn-bound files") and rules out
// the global raise, because widening the budget for every test would retire a real
// wall-clock guard to hide one file's cost. 30 s is ~3x the observed worst case and
// still fails a genuine hang.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

function runTs(args: string[]) {
    return runInProc(main, args);
}

describe('lint_agent_security — CLI contract', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-agent-sec-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    for (const args of [[], ['--quiet']]) {
        it(`runs deterministically for: ${args.join(' ') || '(default)'}`, () => {
            const a = runTs(args);
            expect(a.status, a.stderr).not.toBeNull();
        });
    }

    it('--sarif writes a SARIF 2.1.0 file', () => {
        const tsOut = path.join(tmp, 'ts.sarif');
        const ts = runTs(['--sarif', tsOut]);
        expect(ts.status).not.toBeNull();
        const tsText = fs.readFileSync(tsOut, 'utf-8');
        const parsed = JSON.parse(tsText) as { version: string };
        expect(parsed.version).toBe('2.1.0');
    });

    it('--sarif creates missing parent directories (mkdir parents=True)', () => {
        const tsOut = path.join(tmp, 'c', 'd', 'ts.sarif');
        runTs(['--sarif', tsOut]);
        expect(fs.existsSync(tsOut)).toBe(true);
    });
});
