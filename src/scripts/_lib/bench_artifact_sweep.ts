/**
 * Live wiring of the artifact corpus into `bench_ab_v2_run` (`--corpus artifact`).
 *
 * Per task × arm × seed × ladder: an isolated arm (temp HOME, config dir,
 * workspace outside the repo, network per task), the fixture seeded into the
 * workspace, then the parity loop with the claude host resumed by session id.
 * One JSONL line per run lands in the reports directory. Nothing here prices
 * or aggregates; a stats pass reads these lines.
 *
 * Unverified on a real host (no paid run was made when this landed): the
 * per-arm config dir carries no credentials, so the host authenticates only
 * through an inherited `ANTHROPIC_API_KEY`; and the user-scope plugin does not
 * load under a temp HOME, so the `package` arm loads this checkout with
 * `--plugin-dir`. Both are stated, not assumed to work.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

import * as v1 from '../bench_ab_task_runner.js';
import { ARMS, type ArmSpec } from './bench_ab_arms.js';
import { LADDER_NAMES, type ArtifactTask } from './bench_artifact_corpus.js';
import { grade_primary } from './bench_artifact_graders.js';
import { dispose, isolate_arm, seed_workspace, type ArmIsolation } from './bench_artifact_isolation.js';
import { parity_loop, type ArtifactHost, type HostTurn } from './bench_artifact_parity.js';

interface SweepArgs {
    tasks: Record<string, unknown>[];
    arms: string[];
    args: { seeds: number; model: string; budget: number; timeout: number; mode: string; max_usd?: number | null };
    repo_root: string;
    reports_dir: string;
}

/** The claude CLI as an `ArtifactHost`: `--print` to start, `--resume <id>` to follow up. */
export function claude_host(iso: ArmIsolation, spec: ArmSpec, opts: { model: string; budget: number; timeout: number; repo_root: string }): ArtifactHost {
    const call = (prompt: string, resume: string | null): HostTurn => {
        const binary = v1.claude_executable();
        if (binary === null) return { session_id: null, errored: true, reason: 'claude CLI not found', tokens: null, turns: null };
        const cmd = v1.live_args(prompt, {
            setting_sources: spec.setting_sources,
            model: opts.model,
            max_budget: opts.budget > 0 ? opts.budget : null,
            plugin_dir: spec.setting_sources === null ? opts.repo_root : null,
        });
        const at = cmd.indexOf('--');
        cmd.splice(at, 0, ...iso.host_flags, ...(resume ? ['--resume', resume] : []));
        const r = spawnSync(binary, cmd, { cwd: iso.workspace, encoding: 'utf-8', timeout: opts.timeout * 1000, env: { ...process.env, ...iso.env } });
        try {
            const o = JSON.parse(r.stdout ?? '') as Record<string, unknown>;
            const u = (o['usage'] ?? {}) as Record<string, number>;
            const keys = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'];
            const tokens = keys.every((k) => typeof u[k] === 'number') ? keys.reduce((a, k) => a + (u[k] as number), 0) : null;
            return {
                session_id: typeof o['session_id'] === 'string' ? o['session_id'] : null,
                errored: Boolean(o['is_error']),
                tokens,
                turns: typeof o['num_turns'] === 'number' ? o['num_turns'] : null,
                usd: typeof o['total_cost_usd'] === 'number' ? o['total_cost_usd'] : null,
            };
        } catch {
            return { session_id: null, errored: true, reason: `unparseable host output (exit ${r.status})`, tokens: null, turns: null };
        }
    };
    return { start: async (p) => call(p, null), resume: async (id, p) => call(p, id) };
}

export async function run_artifact_sweep(a: SweepArgs): Promise<number> {
    if (a.args.mode !== 'live') {
        process.stderr.write('bench_ab_v2: --corpus artifact supports --mode live and dry-run; grader checks run via bench_artifact_selftest\n');
        return 2;
    }
    fs.mkdirSync(a.reports_dir, { recursive: true });
    const out = path.join(a.reports_dir, `artifact-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
    const ab = path.join(a.repo_root, 'internal', 'bench', 'ab');
    // Belt and braces over the per-call `--budget`: stop once reported spend reaches the sweep cap.
    const cap = a.args.max_usd ?? null;
    let spent = 0;
    for (const t of a.tasks as unknown as ArtifactTask[]) {
        for (const arm of a.arms) {
            for (let seed = 0; seed < a.args.seeds; seed += 1) {
                for (const ladder of LADDER_NAMES) {
                    if (cap !== null && spent >= cap) {
                        process.stdout.write(`bench_ab_v2: sweep cap $${cap} reached ($${spent.toFixed(2)} reported) — stopping; later runs were not started → ${path.relative(a.repo_root, out)}\n`);
                        return 0;
                    }
                    const iso = isolate_arm(arm, t.id, t.network, { repo_root: a.repo_root });
                    try {
                        seed_workspace(iso, path.join(ab, t.fixture));
                        const host = claude_host(iso, ARMS[arm] as ArmSpec, { ...a.args, repo_root: a.repo_root });
                        const run = await parity_loop({ task: t, arm, ladder, host, grade: () => grade_primary(iso.workspace, t) });
                        spent += run.usd_total ?? 0;
                        fs.appendFileSync(out, JSON.stringify({ ...run, seed, model: a.args.model }) + '\n');
                        process.stdout.write(`  ${t.id} ${arm} seed=${seed} ladder=${ladder}: ${run.outcome}\n`);
                    } finally {
                        dispose(iso);
                    }
                }
            }
        }
    }
    process.stdout.write(`bench_ab_v2: artifact runs → ${path.relative(a.repo_root, out)}\n`);
    return 0;
}

/**
 * Synchronous entry for the runner's `main(): number`: returns 0 now and sets
 * `process.exitCode` when the sweep settles, so a failure still exits non-zero.
 */
export function start_artifact_sweep(a: SweepArgs): number {
    void run_artifact_sweep(a).then(
        (code) => {
            process.exitCode = code;
        },
        (e: unknown) => {
            process.stderr.write(`bench_ab_v2: artifact sweep failed: ${(e as Error).message}\n`);
            process.exitCode = 1;
        },
    );
    return 0;
}
