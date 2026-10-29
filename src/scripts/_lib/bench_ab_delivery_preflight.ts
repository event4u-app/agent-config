/**
 * Step 2.1 — prove each arm's delivery before the first paid trial.
 *
 * Runs the arm's own command line through the zero-cost probe and checks the
 * `system/init` skill list against the arm's contract. The end-of-run
 * activation audit stays as the second check; this one only moves the
 * obvious mis-wiring in front of the spend.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import * as v1 from '../bench_ab_task_runner.js';
import { ARMS, neighbour_env, neighbour_plugin_dir, type ArmSpec } from './bench_ab_arms.js';
import {
    delivery_verdict,
    package_skill_names,
    probe_env,
    run_delivery_probe,
    type ProbeResult,
} from './bench_ab_delivery_probe.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Returns the first failure, or null when every arm is wired as declared. */
export function delivery_preflight(
    arms: readonly string[],
    opts: {
        binary: string;
        model: string | null;
        max_budget: number | null;
        package_skills?: ReadonlySet<string>;
        env?: NodeJS.ProcessEnv;
        timeout_ms?: number;
        probe?: (binary: string, args: readonly string[], o: { cwd: string; env: Record<string, string>; timeout_ms?: number }) => ProbeResult;
        log?: (line: string) => void;
    },
): string | null {
    const env = opts.env ?? process.env;
    const pkg = opts.package_skills ?? package_skill_names(path.join(REPO_ROOT, 'src', 'skills'));
    const probe = opts.probe ?? run_delivery_probe;
    const log = opts.log ?? ((l: string) => process.stderr.write(l + '\n'));
    for (const arm of arms) {
        const spec = ARMS[arm] as ArmSpec;
        const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-preflight-'));
        try {
            const args = v1.live_args('delivery pre-flight', {
                setting_sources: spec.setting_sources,
                max_budget: opts.max_budget,
                model: opts.model,
                plugin_dir: neighbour_plugin_dir(spec, env),
                strict_mcp: spec.isolate_neighbour === true,
                stream: true,
            });
            const extra = spec.isolate_neighbour ? neighbour_env(path.join(cwd, 'data'), env) : null;
            const res = probe(opts.binary, args, { cwd, env: probe_env(env, extra), ...(opts.timeout_ms === undefined ? {} : { timeout_ms: opts.timeout_ms }) });
            if (!res.ok) return `${arm}: ${res.reason}`;
            const verdict = delivery_verdict(arm, spec.setting_sources, res.init, pkg);
            if (!verdict.ok) return verdict.reason;
            log(`bench_ab_v2: pre-flight ok — ${verdict.reason}`);
        } finally {
            fs.rmSync(cwd, { recursive: true, force: true });
        }
    }
    return null;
}

/**
 * The runner's host gate: 1 when the host CLI is missing or an arm is mis-wired,
 * null to continue. The selftest exists to run with no network and no key, so
 * it needs neither; codex emits no `system/init` to read.
 */
export function preflight_exit(
    arms: readonly string[],
    o: { selftest: boolean; host: string; model: string | null; budget: number | null },
): number | null {
    if (o.selftest) return null;
    if (v1.claude_executable() === null) {
        process.stderr.write('claude CLI not found\n');
        return 1;
    }
    if (o.host === 'codex') {
        process.stderr.write('bench_ab_v2: delivery pre-flight skipped — the codex host emits no system/init event to read\n');
        return null;
    }
    const failure = delivery_preflight(arms, {
        binary: v1.claude_executable() as string,
        model: o.model,
        max_budget: o.budget && o.budget > 0 ? o.budget : null,
    });
    if (failure === null) return null;
    process.stderr.write(`bench_ab_v2: delivery pre-flight FAILED — ${failure}. No trial was run.\n`);
    return 1;
}
