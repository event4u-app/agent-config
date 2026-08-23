/**
 * The cost ledger — the only sanctioned route from a charged figure back into
 * a modeled one.
 *
 * The gap being closed is narrow, and the roadmap's own reproduction pass
 * corrected it: the read-back already existed (`resume-scan.sh` reads
 * `cost.json .charged_usd` and sums it as `spent_usd`). What did not exist was
 * any path from that number back into `manifest.cost_per_second_usd` — money
 * was spent, recorded, and never read into the model it contradicted.
 *
 * The load-bearing assertion here is `null` ≠ `0`. A missing price and a free
 * render are different facts, and `0` erases the difference in the one
 * direction that silently lowers every future estimate.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LEDGER_PATH, costDiffWarnings } from '../../src/scripts/lint_adapter_tier.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SMOKE = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'smoke-trace.sh');

function append(args: string[], ledger: string) {
    return spawnSync('bash', [SMOKE, 'cost-ledger', 'append', ...args, '--ledger', ledger], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
    });
}

function tmpLedger(): string {
    return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cost-ledger-')), 'cost-ledger.jsonl');
}

describe('cost-ledger append', () => {
    it('keeps charged null rather than coercing it to 0', () => {
        const ledger = tmpLedger();
        const res = append(['--adapter', 'fal', '--model', 'a/b', '--modeled', '0.08', '--charged', 'null'], ledger);
        expect(res.status, res.stderr).toBe(0);
        const row = JSON.parse(fs.readFileSync(ledger, 'utf8').trim()) as Record<string, unknown>;
        expect(row.charged).toBeNull();
        expect(row.charged).not.toBe(0);
        expect(row.modeled).toBe(0.08);
        expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('treats an omitted charged as null, not as a free render', () => {
        const ledger = tmpLedger();
        expect(append(['--adapter', 'fal', '--model', 'a/b', '--modeled', '0.08'], ledger).status).toBe(0);
        const row = JSON.parse(fs.readFileSync(ledger, 'utf8').trim()) as { charged: unknown };
        expect(row.charged).toBeNull();
    });

    it('records a KNOWN zero charge as 0 — distinct from unknown', () => {
        const ledger = tmpLedger();
        expect(
            append(['--adapter', 'comfyui', '--model', 'local', '--modeled', '0.0', '--charged', '0.0'], ledger).status,
        ).toBe(0);
        const row = JSON.parse(fs.readFileSync(ledger, 'utf8').trim()) as { charged: unknown };
        expect(row.charged).toBe(0);
        expect(row.charged).not.toBeNull();
    });

    it('appends rather than overwriting — a ledger is append-only', () => {
        const ledger = tmpLedger();
        append(['--adapter', 'fal', '--model', 'a/b', '--modeled', '0.08'], ledger);
        append(['--adapter', 'fal', '--model', 'c/d', '--modeled', '0.16'], ledger);
        expect(fs.readFileSync(ledger, 'utf8').trim().split('\n')).toHaveLength(2);
    });

    it('refuses a non-numeric cost instead of writing a string into a number field', () => {
        const ledger = tmpLedger();
        const res = append(['--adapter', 'fal', '--model', 'a/b', '--modeled', 'cheap'], ledger);
        expect(res.status).not.toBe(0);
        expect(fs.existsSync(ledger)).toBe(false);
    });

    it('requires both adapter and model', () => {
        const ledger = tmpLedger();
        expect(append(['--adapter', 'fal'], ledger).status).not.toBe(0);
    });

    it('every row in the committed ledger parses and carries the five fields', () => {
        const abs = path.join(REPO_ROOT, LEDGER_PATH);
        expect(fs.existsSync(abs)).toBe(true);
        const rows = fs
            .readFileSync(abs, 'utf8')
            .trim()
            .split('\n')
            .filter((l) => l !== '')
            .map((l) => JSON.parse(l) as Record<string, unknown>);
        expect(rows.length).toBeGreaterThanOrEqual(1);
        for (const r of rows) {
            for (const k of ['adapter', 'model', 'modeled', 'charged', 'date']) {
                expect(Object.keys(r)).toContain(k);
            }
            // No committed row may claim a charge that was never measured.
            if (r.charged !== null) expect(typeof r.charged).toBe('number');
        }
    });
});

describe('lint_adapter_tier --cost-diff', () => {
    it('reports skipped — never passed — when the base ref cannot be diffed', () => {
        const w = costDiffWarnings(REPO_ROOT, 'refs/does/not/exist');
        expect(w).toHaveLength(1);
        expect(w[0]).toMatch(/skipped, not passed/);
    });

    it('is silent on a diff that changes no manifest cost', () => {
        // HEAD against itself: an empty diff, so nothing to warn about. This
        // pins that the warning is driven by the diff and not by mere presence
        // of the flag.
        expect(costDiffWarnings(REPO_ROOT, 'HEAD')).toEqual([]);
    });
});

describe('lint_adapter_tier --cost-diff — the positive direction, in an isolated repo', () => {
    /**
     * A throwaway git repo with the same two paths, so the warning can be
     * driven in BOTH directions. Asserting only the silent case would pass
     * against a function that never warns at all — which is precisely the
     * failure mode a diff-scoped check is prone to.
     */
    function repo(): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cost-diff-'));
        // GIT_DIR is DELETED, not blanked. `GIT_DIR=''` does not mean "unset" —
        // git took it as a directory and initialised the fixture repo somewhere
        // other than `dir`, so every later diff reported "could not diff" and
        // the positive case looked like a missing feature.
        const gitEnv = { ...process.env };
        delete gitEnv.GIT_DIR;
        delete gitEnv.GIT_WORK_TREE;
        delete gitEnv.GIT_INDEX_FILE;
        const git = (...args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: gitEnv });
        git('init', '-q');
        git('config', 'user.email', 't@e.st');
        git('config', 'user.name', 'test');
        const manifestDir = path.join(dir, 'src', 'scripts', 'ai-video', 'lib', 'model-capabilities');
        fs.mkdirSync(manifestDir, { recursive: true });
        fs.mkdirSync(path.join(dir, 'agents', 'evidence', 'ai-video'), { recursive: true });
        fs.writeFileSync(
            path.join(manifestDir, 'fal.json'),
            JSON.stringify({ models: { 'a/b': { cost_per_second_usd: 0.08 } } }, null, 2),
        );
        fs.writeFileSync(path.join(dir, 'agents', 'evidence', 'ai-video', 'cost-ledger.jsonl'), '');
        git('add', '-A');
        git('commit', '-qm', 'base');
        return dir;
    }

    function bump(dir: string, value: number) {
        const f = path.join(dir, 'src', 'scripts', 'ai-video', 'lib', 'model-capabilities', 'fal.json');
        fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('0.08', String(value)));
    }

    it('warns when a manifest cost changed and no ledger row was added', () => {
        const dir = repo();
        bump(dir, 0.21);
        const w = costDiffWarnings(dir, 'HEAD');
        expect(w).toHaveLength(1);
        expect(w[0]).toMatch(/cost_per_second_usd/);
        expect(w[0]).toMatch(/cite the ledger rows/);
    });

    it('stays silent when the same diff cites the ledger', () => {
        const dir = repo();
        bump(dir, 0.21);
        fs.appendFileSync(
            path.join(dir, 'agents', 'evidence', 'ai-video', 'cost-ledger.jsonl'),
            JSON.stringify({ adapter: 'fal', model: 'a/b', modeled: 0.08, charged: 0.21, date: '2026-08-23' }) + '\n',
        );
        expect(costDiffWarnings(dir, 'HEAD')).toEqual([]);
    });

    it('is a warning, never a failure — a human may re-model an estimate', () => {
        const dir = repo();
        bump(dir, 0.21);
        // The warning exists; the gate's exit code is decided elsewhere and is
        // not raised by it. Re-modelling is legitimate; doing it silently after
        // a measurement contradicted the model is what gets surfaced.
        expect(costDiffWarnings(dir, 'HEAD').length).toBeGreaterThan(0);
    });
});
