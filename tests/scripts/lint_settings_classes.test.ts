// Tests for src/scripts/lint_settings_classes.ts — Phase 1 of
// road-to-zero-ceremony-settings.
//
// Three layers, matching the gate-authoring paired-fixture floor:
//   1. unit coverage of the four public helpers;
//   2. the REAL repo tree passes AND its denominator is asserted — a gate that
//      scanned nothing also exits 0, so the exit code alone proves nothing;
//   3. the CLI self-test, which is where the planted-violation, boundary, and
//      dead-scan-root cases live (it drives the real binary).
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_settings_classes.js';

const REPO_ROOT = mod.REPO_ROOT;

function runCli(args: string[]): { code: number; stdout: string; stderr: string } {
    try {
        const stdout = execFileSync('./scripts-run', ['src/scripts/lint_settings_classes', ...args], {
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

describe('lint_settings_classes — helpers', () => {
    it('templateLeaves treats an EMPTY map as a leaf', () => {
        // The parity walk drops `{}` because it has no entries to recurse into.
        // A dropped key is a key with no class, which is what this gate exists
        // to prevent — so an empty map is a leaf here, deliberately.
        expect(mod.templateLeaves({ a: {}, b: { c: 1 } })).toEqual(['a', 'b.c']);
    });

    it('templateLeaves treats a list as a leaf, not a branch', () => {
        expect(mod.templateLeaves({ a: [1, 2, 3] })).toEqual(['a']);
    });

    it('parseContractRows reads key rows and ignores prose tables', () => {
        const text = [
            '| Class | Who may write it |',
            '|---|---|',
            '| **A — preference** | the agent |',
            '',
            '| Key | Class | Default | Why |',
            '|---|---|---|---|',
            '| `alpha.one` | B | `false` | because |',
            '| `beta` | C | `"x"` | because |',
        ].join('\n');
        const rows = mod.parseContractRows(text);
        expect(rows.map((r) => [r.key, r.cls])).toEqual([
            ['alpha.one', 'B'],
            ['beta', 'C'],
        ]);
        expect(rows[0]?.line).toBe(7);
    });

    it('parseDeclaredCounts returns null for a count the contract omits', () => {
        const partial = '| A — preference | 3 |\n';
        const counts = mod.parseDeclaredCounts(partial);
        expect(counts.A).toBe(3);
        expect(counts.B).toBeNull();
        expect(counts.total).toBeNull();
    });

    it('isConservativeDefault accepts only values that cannot carry a permission', () => {
        for (const v of [false, '', 0, null, [] as never[], {}]) {
            expect(mod.isConservativeDefault(v)).toBe(true);
        }
        for (const v of [true, 'on', 1, ['x'], { a: 1 }]) {
            expect(mod.isConservativeDefault(v)).toBe(false);
        }
    });
});

describe('lint_settings_classes — the real corpus', () => {
    it('the contract and the template both exist where the gate looks', () => {
        expect(fs.existsSync(path.join(REPO_ROOT, mod.TEMPLATE_RELATIVE))).toBe(true);
        expect(fs.existsSync(path.join(REPO_ROOT, mod.CONTRACT_RELATIVE))).toBe(true);
    });

    it('passes on the real tree AND publishes a non-zero denominator', () => {
        const { code, stdout } = runCli([]);
        expect(code).toBe(0);
        // Asserting the exit code alone would also pass for a gate whose scan
        // root had moved. Pin the published count and require it to be real.
        const m = /^scanned: (\d+)$/m.exec(stdout);
        expect(m).not.toBeNull();
        expect(Number.parseInt(m?.[1] ?? '0', 10)).toBeGreaterThan(100);
    });

    it('--quiet changes the output, not the verdict', () => {
        const loud = runCli([]);
        const quiet = runCli(['--quiet']);
        expect(quiet.code).toBe(loud.code);
        expect(loud.stdout).toContain('settings key(s) classified');
        expect(quiet.stdout).not.toContain('settings key(s) classified');
        // The machine-read denominator survives --quiet; CI passes that flag,
        // and a count only visible without it is not a count.
        expect(quiet.stdout).toMatch(/^scanned: \d+$/m);
    });

    it('every class in the contract is one this gate accepts', () => {
        const text = fs.readFileSync(path.join(REPO_ROOT, mod.CONTRACT_RELATIVE), 'utf-8');
        const rows = mod.parseContractRows(text);
        expect(rows.length).toBeGreaterThan(100);
        for (const row of rows) {
            expect(mod.CLASSES).toContain(row.cls);
        }
    });
});

describe('lint_settings_classes — discrimination', () => {
    it('the CLI self-test proves the rejecting cases still reject', () => {
        const { code, stdout } = runCli(['--self-test']);
        expect(code).toBe(0);
        expect(stdout).toContain('case(s) behaved');
        // The floor is asserted inside runSelfTest; assert here that the suite
        // did not silently shrink to the accept case.
        const m = /(\d+) rejecting, floor (\d+)/.exec(stdout);
        expect(m).not.toBeNull();
        expect(Number.parseInt(m?.[1] ?? '0', 10)).toBeGreaterThanOrEqual(
            Number.parseInt(m?.[2] ?? '99', 10),
        );
    });
});
