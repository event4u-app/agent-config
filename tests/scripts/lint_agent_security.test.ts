// Tests for src/scripts/lint_agent_security.ts (py2ts — ADR-094).
//
// The tsx twin is the source of truth (the python original was deleted in the
// teardown). CLI contract over every read mode (default report, --sarif,
// --quiet) on the REAL src/ tree: defined exit + determinism + the written
// SARIF file. The umbrella runner shells out to the child linters, so it
// observes the real repo. The SARIF file is written under a tmp dir so the
// test leaves zero git drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_agent_security.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function runTs(args: string[]) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
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
            const b = runTs(args);
            expect(b.stdout).toBe(a.stdout);
            expect(b.status).toBe(a.status);
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
