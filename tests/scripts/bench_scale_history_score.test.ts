/**
 * Confinement tests for internal/bench/scale-history/score.ts — the council
 * PR-review finding that the path-validation rejection branches were
 * untested. Bench artifacts are untrusted LLM output; every escape shape
 * must be refused with exit 2 and no lint run.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterAll, describe, expect, it } from 'vitest';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');
const SCORE = path.join(REPO, 'internal', 'bench', 'scale-history', 'score.ts');
const BENCH = path.join(REPO, 'internal', 'bench', 'scale-history');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');

const cleanup: string[] = [];
afterAll(() => {
    for (const p of cleanup) fs.rmSync(p, { recursive: true, force: true });
});

function run(args: string[]): { status: number | null; stderr: string; stdout: string } {
    const res = spawnSync(TSX, [SCORE, ...args], { cwd: REPO, encoding: 'utf8' });
    return { status: res.status, stderr: res.stderr, stdout: res.stdout };
}

describe('score.ts confinement (untrusted bench artifacts)', () => {
    it('accepts the committed dry sample (happy path)', () => {
        const res = run(['--dry']);
        expect(res.status).toBe(0);
        const parsed = JSON.parse(res.stdout);
        expect(parsed.gate_defects_total).toBeGreaterThan(0);
    });

    it('refuses a path outside the bench root', () => {
        const res = run(['--artifact', os.tmpdir()]);
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('artifact refused');
    });

    it('refuses dot-dot traversal that escapes the bench root', () => {
        const res = run(['--artifact', path.join(BENCH, '..', '..', '..', 'src')]);
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('artifact refused');
    });

    it('refuses a symlink inside the bench root pointing outside', () => {
        const link = path.join(BENCH, 'escape-link-test');
        fs.rmSync(link, { force: true });
        fs.symlinkSync(os.tmpdir(), link);
        cleanup.push(link);
        const res = run(['--artifact', link]);
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('artifact refused');
    });

    it('refuses a symlinked artifact root even when the target is inside the bench root', () => {
        const link = path.join(BENCH, 'inside-link-test');
        fs.rmSync(link, { force: true });
        fs.symlinkSync(path.join(BENCH, 'sample-artifact'), link);
        cleanup.push(link);
        const res = run(['--artifact', link]);
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('artifact refused');
    });

    it('refuses a missing path', () => {
        const res = run(['--artifact', path.join(BENCH, 'does-not-exist')]);
        expect(res.status).toBe(2);
    });
});

describe('walkers do not follow symlinks inside a scanned tree', () => {
    it('a symlinked dir to an outside tree contributes zero findings', () => {
        const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-symlink-'));
        cleanup.push(scratch);
        // Outside tree with a would-be finding.
        const outside = path.join(scratch, 'outside');
        fs.mkdirSync(outside, { recursive: true });
        fs.writeFileSync(path.join(outside, 'bad.sql'), 'DROP TABLE users;\n');
        // Scanned tree containing ONLY a symlink to it.
        const scanned = path.join(scratch, 'scanned');
        fs.mkdirSync(scanned, { recursive: true });
        fs.symlinkSync(outside, path.join(scanned, 'link'));

        const res = spawnSync(
            TSX,
            [path.join(REPO, 'src', 'scripts', 'lint_persistence.ts'), '--dir', scanned, '--stack', 'raw-sql', '--format', 'json'],
            { cwd: REPO, encoding: 'utf8' },
        );
        const parsed = JSON.parse(res.stdout);
        expect(parsed.findings).toEqual([]);
    });
});
