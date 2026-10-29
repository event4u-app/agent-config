#!/usr/bin/env tsx
/**
 * showcase_run — start a paid showcase tier (road-to-a-baseline-that-has-to-catch-up
 * step 5.1; planning in `_lib/showcase_plan.ts`).
 *
 * Usage: showcase_run --tier quick|full --max-usd <usd> [--model <id>] [--plan] [--dry-run]
 *   --plan     print the plan and exit; spends nothing
 *   --dry-run  hand the plan to bench_ab_v2_run in dry-run mode (lists runs, no spend,
 *              no budget needed)
 *
 * Refuses without --max-usd and in CI. The tier only runs through the existing
 * v2 harness (`bench_ab_v2_run --corpus artifact`) — kill K6, no second harness.
 *
 * Exit: the harness's exit code · 2 refused or usage error.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import process from 'node:process';

import { load_artifact_corpus } from './_lib/bench_artifact_corpus.js';
import { REPO_ROOT } from './_lib/bench_artifact_graders.js';
import { planShowcase, renderPlan, type ShowcaseTier } from './_lib/showcase_plan.js';

const USAGE = 'usage: showcase_run --tier quick|full --max-usd <usd> [--model <id>] [--plan] [--dry-run]\n';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

export function main(argv: string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): number {
    let tier: ShowcaseTier | null = null;
    let max_usd: number | null = null;
    let model = DEFAULT_MODEL;
    let planOnly = false;
    let dry = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        const v = argv[i + 1];
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            return 0;
        } else if (a === '--plan') planOnly = true;
        else if (a === '--dry-run') dry = true;
        else if (a === '--tier' && (v === 'quick' || v === 'full')) {
            tier = v;
            i += 1;
        } else if (a === '--max-usd' && v !== undefined) {
            max_usd = Number(v);
            i += 1;
        } else if (a === '--model' && v !== undefined) {
            model = v;
            i += 1;
        } else {
            process.stderr.write(USAGE);
            return 2;
        }
    }
    if (tier === null) {
        process.stderr.write(USAGE);
        return 2;
    }
    const corpus = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-artifact-v2.yaml');
    const all = load_artifact_corpus(corpus).map((t) => t.id);
    const r = planShowcase({ tier, max_usd, all_tasks: all, model, env, dry_run: dry || planOnly });
    if (!r.ok) {
        process.stderr.write(`showcase_run: refused — ${r.reason}\n`);
        return 2;
    }
    process.stdout.write(renderPlan(r.plan));
    if (planOnly) return 0;
    const res = spawnSync(path.join(REPO_ROOT, 'scripts-run'), ['src/scripts/bench_ab_v2_run', ...r.plan.argv], { cwd: REPO_ROOT, stdio: 'inherit', env });
    return res.status ?? 2;
}

if (process.argv[1] !== undefined && /showcase_run\.(ts|js)$/.test(process.argv[1])) {
    process.exitCode = main();
}
