#!/usr/bin/env tsx
/**
 * bench_hook_ab — interleaved A/B timing of hook bundles, per hot event.
 *
 * `bench_hook_latency.ts` owns the published numbers and the budget gate; it
 * measures ONE bundle per run, so two runs of it compare two moments of a
 * machine, not two bundles. This compares variants inside one run: every round
 * runs each variant once, in turn, so load on the machine lands on all of them
 * alike — the method the 2026-11-20 hook-system analysis used
 * (road-to-a-hook-system-that-pays-for-what-it-does 3.1). A `node -e 0` control
 * is always included, so the fixed cost of a node start is visible beside the
 * dispatch.
 *
 *     ./scripts-run internal/bench/core/bench_hook_ab \
 *         --variant pin=/tmp/pin/dist/hooks/dispatch.js \
 *         --variant head=dist/hooks/dispatch.js --runs 40
 *     ./scripts-run internal/bench/core/bench_hook_ab --trace
 *
 * A variant bundle must sit at `<root>/dist/hooks/dispatch.js` inside a
 * package-root-shaped directory (it reads `../../src/…`). Without `--variant`
 * the one variant is this checkout's `dist/hooks/dispatch.js`.
 *
 * `--trace` prints, per event and variant, the non-builtin modules a dispatch
 * loads at runtime (`_lib/hook_load_trace.ts`) instead of timing.
 *
 * Exit codes: 0 · 2 usage or a missing bundle.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HOT_EVENTS, nodeModulesLoads, syntheticPayload, traceLoads } from '../../../src/scripts/_lib/hook_load_trace.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export interface Variant {
    readonly label: string;
    readonly bundle: string;
}

export interface Args {
    readonly variants: readonly Variant[];
    readonly runs: number;
    readonly events: readonly string[];
    readonly trace: boolean;
}

export function parseArgs(argv: readonly string[]): Args | string {
    const variants: Variant[] = [];
    let runs = 30;
    let events: string[] = [...HOT_EVENTS];
    let trace = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        const v = argv[i + 1];
        if (a === '--trace') trace = true;
        else if (a === '--variant' && v !== undefined) {
            const at = v.indexOf('=');
            if (at <= 0) return `--variant needs label=path, got ${v}`;
            variants.push({ label: v.slice(0, at), bundle: path.resolve(v.slice(at + 1)) });
            i += 1;
        } else if (a === '--runs' && v !== undefined) {
            runs = Number(v);
            if (!Number.isInteger(runs) || runs < 1) return `--runs needs a positive integer, got ${v}`;
            i += 1;
        } else if (a === '--events' && v !== undefined) {
            events = v.split(',').filter((e) => e !== '');
            i += 1;
        } else return `unknown argument ${String(a)}`;
    }
    if (variants.length === 0) variants.push({ label: 'head', bundle: path.join(REPO, 'dist', 'hooks', 'dispatch.js') });
    return { variants, runs, events, trace };
}

/** p-quantile by nearest rank over a copy, so the caller's order is kept. */
export function quantile(xs: readonly number[], p: number): number {
    if (xs.length === 0) return Number.NaN;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))] as number;
}

function timeOnce(args: readonly string[], input: string): number {
    const started = performance.now();
    spawnSync(process.execPath, args, { input, encoding: 'utf-8', env: { ...process.env, AGENT_CONFIG_REPLAY: '1' } });
    return performance.now() - started;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const parsed = parseArgs(argv);
    if (typeof parsed === 'string') {
        process.stderr.write(`bench_hook_ab: ${parsed}\n`);
        return 2;
    }
    for (const v of parsed.variants) {
        if (!fs.existsSync(v.bundle)) {
            process.stderr.write(`bench_hook_ab: no bundle at ${v.bundle} (variant ${v.label}) — npm run build:hooks\n`);
            return 2;
        }
    }
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-hook-ab-'));
    try {
        process.stdout.write(`node ${process.version} · ${os.platform()} ${os.arch()} · ${os.cpus()[0]?.model ?? '?'} · runs ${String(parsed.runs)}\n`);
        for (const event of parsed.events) {
            process.stdout.write(`\n${event}\n`);
            if (parsed.trace) {
                for (const v of parsed.variants) {
                    const t = traceLoads(v.bundle, event, workspace);
                    const nm = nodeModulesLoads(t.modules);
                    const own = t.modules.filter((m) => !nm.includes(m)).map((m) => path.relative(path.dirname(v.bundle), m));
                    const parts = [...own, ...(nm.length > 0 ? [`${String(nm.length)} file(s) from node_modules`] : [])];
                    process.stdout.write(`  ${v.label}: exit ${String(t.exit)} · ${parts.length === 0 ? 'nothing outside the bundle' : parts.join(', ')}\n`);
                }
                continue;
            }
            const input = syntheticPayload(event, workspace);
            const cells = [
                { label: 'node -e 0', args: ['-e', '0'], t: [] as number[] },
                ...parsed.variants.map((v) => ({
                    label: v.label,
                    args: [v.bundle, '--platform', 'claude', '--event', event, '--project-dir', workspace],
                    t: [] as number[],
                })),
            ];
            for (const c of cells) for (let w = 0; w < 3; w += 1) timeOnce(c.args, input);
            for (let r = 0; r < parsed.runs; r += 1) for (const c of cells) c.t.push(timeOnce(c.args, input));
            const base = quantile(cells[1]?.t ?? [], 0.5);
            for (const c of cells) {
                const p50 = quantile(c.t, 0.5);
                const delta = c === cells[0] || c === cells[1] ? '' : `  Δp50 ${(p50 - base >= 0 ? '+' : '') + (p50 - base).toFixed(1)} ms`;
                process.stdout.write(
                    `  ${c.label.padEnd(12)} p50 ${p50.toFixed(1).padStart(6)}  p90 ${quantile(c.t, 0.9).toFixed(1).padStart(6)}  min ${quantile(c.t, 0).toFixed(1).padStart(6)}${delta}\n`,
                );
            }
        }
        return 0;
    } finally {
        fs.rmSync(workspace, { recursive: true, force: true });
    }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(main());
}
