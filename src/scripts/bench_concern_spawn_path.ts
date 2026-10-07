#!/usr/bin/env tsx
/**
 * Wall time of one blocking `pre_tool_use` concern through the SPAWN path —
 * interpreter start included — as p50 and p95.
 *
 * `road-to-a-ratification-fence-that-follows-its-imports` 4.1, the receiver for
 * the half of the archived plumbing roadmap's AC-3 that was carried "as the
 * narrowing it is". `concern_sla_ms` measures in-process concern work only, so
 * `sla_ms x 3` could not be judged as a spawn timeout: the tree had no
 * spawn-path number. This produces one.
 *
 * It replicates `dispatch_hook._run_concern`'s isolated branch rather than
 * calling it (that function is private plumbing and editing it to export a
 * helper would be a gated change for a measurement): the same `tsx` binary the
 * dispatcher resolves from `node_modules/.bin`, the same envelope builder
 * (`_build_envelope`), the same hardened env, the envelope on stdin, and the
 * concern's own `--platform` argument. What it does not include is the
 * dispatcher's own start-up, which happens once per event, not once per
 * concern.
 *
 * It gates nothing and wires nothing. Whether a timeout of `sla_ms x 3` is
 * tenable is a READING of its output, made by whoever reads it, and one
 * machine's p95 is that machine's.
 *
 * Usage:
 *     npx tsx src/scripts/bench_concern_spawn_path.ts [--runs 20] [--concern block-no-verify]
 *
 * Exit 0 on a measurement, 2 when the concern or `tsx` cannot be found.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { hardenedSpawnEnv } from './_lib/spawn_env.js';
import { _build_envelope } from './hooks/dispatch_hook.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

/** Nearest-rank percentile over a sorted copy. */
export function percentile(samples: readonly number[], p: number): number {
    if (samples.length === 0) {
        return Number.NaN;
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
    return sorted[Math.min(rank, sorted.length) - 1] as number;
}

function concernScript(name: string): string | null {
    const manifest = parseYaml(fs.readFileSync(path.join(REPO, 'src/scripts/hook_manifest.yaml'), 'utf8')) as {
        concerns?: Record<string, { script?: string; severity?: string }>;
    };
    const def = manifest.concerns?.[name];
    return def?.script === undefined ? null : path.join(REPO, def.script);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let runs = 20;
    let concern = 'block-no-verify';
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--runs') {
            runs = Number(argv[i + 1] ?? runs);
            i += 1;
        } else if (argv[i] === '--concern') {
            concern = argv[i + 1] ?? concern;
            i += 1;
        }
    }
    const script = concernScript(concern);
    const tsx = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
    if (script === null || !fs.existsSync(script) || !fs.existsSync(tsx)) {
        process.stderr.write(`bench_concern_spawn_path: concern ${concern} or ${tsx} not found\n`);
        return 2;
    }
    const payload = JSON.stringify({
        session_id: 'bench',
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
    });
    const envelope = _build_envelope(
        {
            platform: 'claude',
            event: 'pre_tool_use',
            native_event: 'PreToolUse',
        } as Parameters<typeof _build_envelope>[0],
        payload,
    );
    const input = JSON.stringify(envelope);
    const env = hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: REPO });

    const samples: number[] = [];
    const codes = new Set<number | null>();
    for (let i = 0; i < runs; i += 1) {
        const t0 = performance.now();
        const proc = spawnSync(tsx, [script, '--platform', 'claude'], {
            input,
            encoding: 'utf-8',
            cwd: REPO,
            env,
            timeout: 30_000,
        });
        samples.push(performance.now() - t0);
        codes.add(proc.status);
    }
    const cpu = os.cpus()[0]?.model ?? 'unknown cpu';
    process.stdout.write(
        [
            `concern: ${concern} (${path.relative(REPO, script)})`,
            `runner: ${os.platform()} ${os.arch()} · ${cpu} · ${String(os.cpus().length)} cpus · node ${process.version}`,
            `runs: ${String(runs)} · exit codes: ${[...codes].join(', ')}`,
            `p50: ${percentile(samples, 50).toFixed(1)} ms`,
            `p95: ${percentile(samples, 95).toFixed(1)} ms`,
            `max: ${Math.max(...samples).toFixed(1)} ms`,
        ].join('\n') + '\n',
    );
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}
