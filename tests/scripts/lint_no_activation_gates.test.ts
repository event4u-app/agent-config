// Tests for src/scripts/lint_no_activation_gates.ts — Phase 1.5 of
// road-to-always-on-orchestration.
//
// Three layers, matching the sibling `lint_settings_classes` gate's shape:
//   1. the REAL repo tree passes AND its denominator is asserted;
//   2. --quiet changes the output, not the verdict;
//   3. the CLI self-test — where the planted-reintroduction, allowlist, and
//      dead-scan-root cases live (it drives the real binary).
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_no_activation_gates.js';

const REPO_ROOT = mod.REPO_ROOT;

function runCli(args: string[]): { code: number; stdout: string; stderr: string } {
    try {
        const stdout = execFileSync('./scripts-run', ['src/scripts/lint_no_activation_gates', ...args], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return { code: 0, stdout, stderr: '' };
    } catch (e) {
        const err = e as { status?: number; stdout?: string; stderr?: string };
        return { code: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
}

describe('lint_no_activation_gates — the real corpus', () => {
    it('the template exists where the gate looks', () => {
        expect(fs.existsSync(path.join(REPO_ROOT, mod.TEMPLATE_RELATIVE))).toBe(true);
    });

    it('passes on the real tree AND publishes a non-zero denominator', () => {
        const { code, stdout } = runCli([]);
        expect(code).toBe(0);
        const m = /^scanned: (\d+)$/m.exec(stdout);
        expect(m).not.toBeNull();
        expect(Number.parseInt(m?.[1] ?? '0', 10)).toBeGreaterThan(100);
    });

    it('--quiet changes the output, not the verdict', () => {
        const loud = runCli([]);
        const quiet = runCli(['--quiet']);
        expect(quiet.code).toBe(loud.code);
        expect(loud.stdout).toContain('no activation-gate-shaped settings key found');
        expect(quiet.stdout).not.toContain('no activation-gate-shaped settings key found');
        // The machine-read denominator survives --quiet.
        expect(quiet.stdout).toMatch(/^scanned: \d+$/m);
    });
});

describe('lint_no_activation_gates — discrimination', () => {
    it('the CLI self-test proves the rejecting cases still reject', () => {
        const { code, stdout } = runCli(['--self-test']);
        expect(code).toBe(0);
        expect(stdout).toContain('case(s) behaved');
        // The gate declares minRejectCases: 4 — assert the real run cleared
        // it, rather than re-deriving the printed `floor` (which reports the
        // total-case minimum, not the reject-case minimum, and would only
        // coincidentally match here).
        const m = /(\d+) rejecting,/.exec(stdout);
        expect(m).not.toBeNull();
        expect(Number.parseInt(m?.[1] ?? '0', 10)).toBeGreaterThanOrEqual(4);
    });
});
