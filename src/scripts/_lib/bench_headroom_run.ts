/**
 * Live execution of the orchestrated arms (test-first, review): one clone, every step a
 * separate host call with the arm's package setup. The record shape stays in
 * `bench_ab_v2_run.ts`; this module only runs the steps.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

import * as v1 from '../bench_ab_task_runner.js';
import type { ArmSpec } from './bench_ab_arms.js';
import { trial_container, type ContainerCtx } from './bench_ab_container.js';
import * as scoring from './bench_ab_scoring_v2.js';
import { plugin_scope, reset_fixture } from './bench_ab_workspace.js';
import * as headroom from './bench_headroom_arms.js';

type Dict = Record<string, unknown>;

export interface OrchestratedOpts {
    model: string | null;
    max_budget: number | null;
    timeout: number;
    seed?: number;
    container?: ContainerCtx | null;
    reviewer?: ((prompt: string) => Dict) | null;
}

export interface OrchestratedRun {
    res: headroom.OrchestratedResult;
    /** The final author run with every step's usage summed into it. */
    run: Dict;
    fixture: string;
    clone: string;
}

export function run_orchestrated_arm(task: Dict, arm: string, spec: ArmSpec, opts: OrchestratedOpts): OrchestratedRun {
    const in_container = Boolean(opts.container) && !spec.host_only;
    const [clone, fixture] = reset_fixture(task, arm, opts.seed ?? 0, in_container ? undefined : plugin_scope(spec));
    const author_call = (prompt: string): Dict =>
        v1.run_live({ ...task, prompt }, clone, opts.timeout, {
            setting_sources: spec.setting_sources,
            max_budget: opts.max_budget,
            model: opts.model,
            effort: spec.effort ?? null,
            no_session_persistence: true,
            container: in_container ? trial_container(opts.container as ContainerCtx, spec) : null,
        }) as unknown as Dict;
    const requirement = String(task['prompt'] ?? '');
    let res: headroom.OrchestratedResult;
    if (spec.orchestration === 'test-first') {
        const patch = path.join(path.dirname(path.dirname(fixture)), 'oracle-v2', `${String(task['id'])}.patch`);
        res = headroom.run_test_first({
            requirement,
            clone,
            call: (s) => author_call(s.prompt),
            exec: (command, cwd) => spawnSync('sh', ['-c', command], { cwd, timeout: 60_000 }).status ?? -1,
            tests_pass_on_reference: (src) => headroom.tests_pass_on_reference(fixture, patch, src),
        });
    } else {
        const reviewer = opts.reviewer;
        if (!reviewer) throw new Error(`${arm} needs the slim reviewer (opts.reviewer)`);
        res = headroom.run_review({
            requirement,
            clone,
            call: (s) => (s.role === 'reviewer' ? reviewer(s.prompt) : author_call(s.prompt)),
            diff: () => headroom.fixture_diff(fixture, clone),
            passes_now: () => scoring.score_task_v2(task, { fixture_root: fixture, clone_root: clone, transcript: '' }).capability_pass,
        });
    }
    const run: Dict = {
        ...res.final_run,
        errored: res.errored,
        tokens: res.tokens,
        tokens_breakdown: res.tokens_breakdown,
        wall_time_seconds: res.wall_time_seconds,
    };
    return { res, run, fixture, clone };
}
