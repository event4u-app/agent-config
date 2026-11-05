/**
 * Live wiring of the artifact corpus into `bench_ab_v2_run` (`--corpus artifact`).
 *
 * Per task × arm × seed × ladder: an isolated arm (temp HOME, config dir,
 * workspace outside the repo, network per task), the fixture seeded into the
 * workspace, then the parity loop with the claude host resumed by session id.
 * One JSONL line per run lands in the reports directory. Nothing here prices
 * or aggregates; a stats pass reads these lines.
 *
 * The per-arm config dir carries no credentials, so the host authenticates
 * with the configured subscription token of the chosen `--account` (the same
 * pool container sweeps use), and only falls back to an inherited
 * `ANTHROPIC_API_KEY` when no token is configured. The first live sweep without
 * that wiring errored on all 108 runs at $0. The user-scope plugin does not load
 * under a temp HOME, so the `package` arm loads this checkout with
 * `--plugin-dir`. `--isolation container` is not honoured on this path: the
 * isolation is a temp HOME and workspace outside the repository.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

import * as v1 from '../bench_ab_task_runner.js';
import { ARMS, type ArmSpec } from './bench_ab_arms.js';
import { container_env, read_token_pool, select_account } from './bench_ab_container.js';
import { LADDER_NAMES, type ArtifactTask } from './bench_artifact_corpus.js';
import { grade_primary } from './bench_artifact_graders.js';
import { dispose, isolate_arm, seed_workspace, type ArmIsolation } from './bench_artifact_isolation.js';
import { parity_loop, type ArtifactHost, type HostTurn } from './bench_artifact_parity.js';

interface SweepArgs {
    tasks: Record<string, unknown>[];
    arms: string[];
    args: { seeds: number; model: string; budget: number; timeout: number; mode: string; max_usd?: number | null; account?: string | null };
    repo_root: string;
    reports_dir: string;
}

/**
 * The host process environment: the caller's, overlaid by the arm isolation. With
 * a subscription token, credentials that would override it are dropped and the
 * token is set; without one the inherited environment stands as it was.
 */
export function host_env(base: NodeJS.ProcessEnv, iso_env: Record<string, string>, token: string | null): Record<string, string> {
    const merged: NodeJS.ProcessEnv = { ...base, ...iso_env };
    if (token !== null) return container_env(merged, token);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(merged)) if (typeof v === 'string') out[k] = v;
    return out;
}

/** One host turn read from the CLI's JSON envelope; an error keeps the host's own message. */
export function host_turn_from_envelope(o: Record<string, unknown>, _status: number | null): HostTurn {
    const u = (o['usage'] ?? {}) as Record<string, number>;
    const keys = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'];
    const tokens = keys.every((k) => typeof u[k] === 'number') ? keys.reduce((a, k) => a + (u[k] as number), 0) : null;
    const errored = Boolean(o['is_error']);
    const msg = typeof o['result'] === 'string' ? o['result'].trim().slice(0, 200) : '';
    return {
        session_id: typeof o['session_id'] === 'string' ? o['session_id'] : null,
        errored,
        ...(errored ? { reason: msg ? `host error: ${msg}` : 'host error' } : {}),
        tokens,
        turns: typeof o['num_turns'] === 'number' ? o['num_turns'] : null,
        usd: typeof o['total_cost_usd'] === 'number' ? o['total_cost_usd'] : null,
    };
}

/** The claude CLI as an `ArtifactHost`: `--print` to start, `--resume <id>` to follow up. */
export function claude_host(iso: ArmIsolation, spec: ArmSpec, opts: { model: string; budget: number; timeout: number; repo_root: string; token?: string | null }): ArtifactHost {
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
        const r = spawnSync(binary, cmd, { cwd: iso.workspace, encoding: 'utf-8', timeout: opts.timeout * 1000, env: host_env(process.env, iso.env, opts.token ?? null) });
        try {
            return host_turn_from_envelope(JSON.parse(r.stdout ?? '') as Record<string, unknown>, r.status);
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
    const token = sweep_token(a.args.account ?? null);
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
                        const host = claude_host(iso, ARMS[arm] as ArmSpec, { ...a.args, repo_root: a.repo_root, token });
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
 * The subscription token the sweep runs on: the named account, else the first
 * configured one. No token configured and none named → null, so an inherited
 * `ANTHROPIC_API_KEY` still works; a named account without a token is an error.
 */
function sweep_token(account: string | null): string | null {
    try {
        return select_account(read_token_pool(), account).token;
    } catch (e) {
        if (account !== null) throw e;
        return null;
    }
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
