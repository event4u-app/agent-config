/**
 * The mirror is only worth its minutes if three things stay true of the real
 * tree, so these read the real workflows and config rather than fixtures:
 *   1. every step of a mirrored job either runs locally or is declared CI-only
 *      with a reason — nothing is skipped silently;
 *   2. the gates that turned PR #2949 red four pushes in a row are among the
 *      mirrored steps, so the next instance is caught before the push;
 *   3. the two long gate jobs keep running after a failure, so one CI run
 *      reports every red step instead of the first.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { LOCAL_JOB_ID, loadConfig, planJobs, unreproducibleSteps } from '../../src/scripts/ci_mirror.js';

const ROOT = path.resolve(__dirname, '../..');
const config = loadConfig(ROOT);
const plans = planJobs(ROOT, config);

describe('ci_mirror plan — the real workflows', () => {
    it('resolves every configured job, plus the local-only job', () => {
        expect(plans.map((p) => `${p.workflow}:${p.job}`)).toEqual([
            ...config.jobs.map((j) => `${j.workflow}:${j.job}`),
            LOCAL_JOB_ID,
        ]);
    });

    it('drops no gate the old pre-push preflight ran: each is mirrored from CI or kept local with a reason', () => {
        // The preflight task was the pre-push hook's largest block before the
        // mirror replaced it. A gate it ran that no mirrored step and no
        // local-only entry carries would leave the push path silently.
        const taskfile = fs.readFileSync(path.join(ROOT, 'taskfiles/ci-fast.yml'), 'utf8');
        const from = taskfile.indexOf('\n  preflight:\n');
        const rest = taskfile.slice(from + 1);
        const next = rest.slice(1).search(/\n  [a-z][\w:-]*:\n/);
        const block = next === -1 ? rest : rest.slice(0, next + 1);
        const gates = [...new Set([...block.matchAll(/scripts-run src\/scripts\/([a-z_]+)/g)].map((m) => m[1] ?? ''))];
        expect(gates.length).toBeGreaterThan(15);
        const carried = plans.flatMap((p) => p.steps.filter((s) => s.kind === 'run').map((s) => s.run ?? '')).join('\n');
        const exempt = new Set(['check_branch_freshness']); // the hook runs it itself, before the mirror
        expect(gates.filter((g) => !exempt.has(g) && !carried.includes(g))).toEqual([]);
    });

    it('can render every expression of every mirrored step', () => {
        expect(plans.flatMap((p) => unreproducibleSteps(p).map((u) => `${p.workflow}:${p.job} › ${u.step}: ${u.reason}`))).toEqual([]);
    });

    it('names only steps that exist (a renamed step must not silently become mirrored or unmarked)', () => {
        for (const entry of [...config.ci_only_steps, ...config.owner_decision_steps]) {
            const plan = plans.find((p) => p.workflow === entry.workflow && p.job === entry.job);
            expect(plan, `${entry.workflow}:${entry.job}`).toBeDefined();
            expect(plan!.steps.map((s) => s.name), entry.step).toContain(entry.step);
        }
    });

    it('gives every CI-only step a reason', () => {
        for (const c of config.ci_only_steps) expect(c.reason.length, c.step).toBeGreaterThan(40);
    });

    it.each([
        ['open decision in a ready roadmap', /lint_decision_classes/],
        ['roadmap step ticked without a receipt', /check_step_receipts/],
        ['new active roadmap without an offset', /estate/i],
        ['roadmap dashboard committed', /roadmap-dashboard-untracked-check|update_roadmap_progress.*--untracked-mode|roadmap-progress-check/],
        ['tracked-but-ignored file', /tracked.but.ignored|check_tracked_but_ignored/i],
        ['typecheck', /npm run typecheck/],
    ])('mirrors the gate that catches: %s', (_label, re) => {
        const runnable = plans.flatMap((p) => p.steps.filter((s) => s.kind === 'run').map((s) => `${s.name}\n${s.run ?? ''}`));
        expect(runnable.some((text) => re.test(text))).toBe(true);
    });
});

describe('collect-all — CI reports every failure of a run, not the first', () => {
    const SETUP = /^(Check out repository|Set up Node|Install Node deps|Set up Task|Fetch the baseline branch)$/;
    it.each([
        ['consistency.yml', 'consistency'],
        ['rule-backstops.yml', 'rule-backstops'],
    ])('%s: every gate step runs after an earlier failure', (file, job) => {
        const doc = parseYaml(fs.readFileSync(path.join(ROOT, '.github/workflows', file), 'utf8')) as {
            jobs: Record<string, { steps: Array<{ name?: string; run?: string; if?: string }> }>;
        };
        const offenders = (doc.jobs[job]?.steps ?? [])
            .filter((s) => s.run && !SETUP.test(String(s.name ?? '')))
            .filter((s) => !/\b(always|failure|cancelled)\s*\(/.test(String(s.if ?? '')))
            .map((s) => s.name);
        expect(offenders).toEqual([]);
    });
});
