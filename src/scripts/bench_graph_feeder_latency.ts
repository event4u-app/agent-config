#!/usr/bin/env node
/**
 * What the graph feeder costs the stop slot (`road-to-a-graph-that-feeds-the-gate`
 * step 3.5).
 *
 * `_lib/graph_feeder_record.ts` withdrew its "costs nothing" claim and left the
 * latency unmeasured. It matters because the feeder runs inside the blocking
 * `turn-end-gate` concern: a host that timed the stop hook out would discard F's
 * refusal, so a slow shadow arm weakens the gate it is meant to feed.
 *
 * WHAT IS MEASURED. The hook's own `main()`, in-process, with the stdin override
 * the in-process dispatcher uses — the route a host actually takes, so a spawn
 * or `tsx` start-up cost does not drown the difference. Two arms over the SAME
 * generated repository and the SAME turn (an absolute-path edit to a production
 * file, no test touched, a completion claim, so detector F fires):
 *
 *   with    — a native graph exists and the edit is uncommitted, so the feeder
 *             takes its full path: `git` freshness probes, a graph open, an
 *             `untested` walk, a row append.
 *   without — the identical tree with no graph cache, so the feeder stops at
 *             `absent`. This is the cost a consumer who never builds a graph
 *             pays, and the baseline the feeder's increment is read against.
 *
 * Arms are INTERLEAVED, one call each per round, and the order ALTERNATES per
 * round: interleaving spreads slow drift across both arms, and alternating
 * spreads the order effects (GC after the heavier arm, cache warmth) as well. A third reading times the
 * feeder's own work (`graphState` + `graphUntestedVerdict`) in isolation on the
 * `with` tree, because the difference of two noisy totals is a weaker number
 * than a direct one.
 *
 * WHAT IT DOES NOT CLAIM. One machine, one generated repository shape. The size
 * is a flag rather than a constant so a reader can re-take the reading at the
 * scale they care about; the published page names the machine and the flags it
 * was taken with. Not a gate: it prints and exits 0 on any completed run.
 *
 * `--repo P --edit F` takes the third reading only, over an EXISTING repository
 * and its own graph — read-only, no hook call, no row written. A generated tree
 * prices the walk; it does not price opening a real index, whose load time grows
 * with the graph and is the larger term on a repository of any size.
 *
 * Usage:
 *   ./scripts-run src/scripts/bench_graph_feeder_latency [--runs N] [--files N]
 *     [--format text|json]
 *   ./scripts-run src/scripts/bench_graph_feeder_latency --repo P --edit F [--runs N]
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

import { graphUntestedVerdict } from './_lib/graph_feeder_record.js';
import { buildFromRepo } from './code_graph/build.js';
import { graphState, NATIVE_CACHE_REL } from './code_graph/detect.js';
import { clearHookStdinOverride, setHookStdinOverride } from './hooks/hook_stdin.js';
import { main as turnEndGateMain } from './hooks/turn_end_gate_hook.js';

export interface Distribution {
    n: number;
    p50: number;
    p95: number;
    max: number;
}

export interface LatencyReport {
    runs: number;
    files: number;
    graphState: string;
    /** Exit codes seen per arm — a shadow arm must not move them. */
    exitCodes: { with: number[]; without: number[] };
    with: Distribution;
    without: Distribution;
    /** `with.p50 - without.p50`, and the same for p95. */
    delta: { p50: number; p95: number };
    /** The feeder's own work, timed directly on the `with` tree. */
    feederOnly: Distribution;
    node: string;
    platform: string;
    cpu: string;
}

/** Nearest-rank percentile over an ascending array. */
export function percentile(sorted: readonly number[], p: number): number {
    if (sorted.length === 0) return Number.NaN;
    const rank = Math.ceil((p / 100) * sorted.length);
    return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] as number;
}

export function distribution(samples: readonly number[]): Distribution {
    const s = [...samples].sort((a, b) => a - b);
    const r = (x: number): number => Math.round(x * 100) / 100;
    return { n: s.length, p50: r(percentile(s, 50)), p95: r(percentile(s, 95)), max: r(s[s.length - 1] ?? Number.NaN) };
}

const GIT_ENV = {
    ...process.env,
    GIT_AUTHOR_NAME: 'bench',
    GIT_AUTHOR_EMAIL: 'bench@example.com',
    GIT_COMMITTER_NAME: 'bench',
    GIT_COMMITTER_EMAIL: 'bench@example.com',
};

function git(dir: string, args: string[]): void {
    execFileSync('git', ['-C', dir, ...args], { env: GIT_ENV, stdio: 'ignore' });
}

/**
 * A committed repository of `files` production modules chained by imports, one
 * test file covering the first module only, and the edited `src/service.ts`
 * left uncommitted — the shape a real stop sees mid-session.
 */
export async function makeFixture(root: string, files: number, withGraph: boolean): Promise<string> {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(root, withGraph ? 'with-' : 'without-')));
    fs.mkdirSync(path.join(dir, 'src'));
    fs.mkdirSync(path.join(dir, 'tests'));
    fs.writeFileSync(path.join(dir, 'src', 'service.ts'), 'export function handle(x: string): string {\n    return x;\n}\n');
    for (let i = 0; i < files; i++) {
        const prev = i === 0 ? './service.js' : `./mod${i - 1}.js`;
        const prevFn = i === 0 ? 'handle' : `run${i - 1}`;
        fs.writeFileSync(
            path.join(dir, 'src', `mod${i}.ts`),
            `import { ${prevFn} } from '${prev}';\n\nexport function run${i}(x: string): string {\n    return ${prevFn}(x) + '${i}';\n}\n`,
        );
    }
    fs.writeFileSync(
        path.join(dir, 'tests', 'mod0.test.ts'),
        "import { run0 } from '../src/mod0.js';\n\nexport function check(): boolean {\n    return run0('a') === 'a0';\n}\n",
    );
    git(dir, ['init', '-q']);
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'fixture']);
    if (withGraph) await buildFromRepo(dir, path.join(dir, NATIVE_CACHE_REL));
    fs.writeFileSync(path.join(dir, 'src', 'service.ts'), 'export function handle(x: string): string {\n    return x.trim();\n}\n');
    return dir;
}

function writeTranscript(dir: string, home: string, tag: string): string {
    const file = path.join(home, `transcript-${tag}.jsonl`);
    const lines = [
        { type: 'user', message: { content: 'mach das fertig' } },
        {
            type: 'assistant',
            message: {
                content: [{ type: 'tool_use', name: 'Edit', input: { file_path: path.join(dir, 'src', 'service.ts') } }],
            },
        },
        { type: 'assistant', message: { content: [{ type: 'text', text: 'Fertig. Der Service trimmt jetzt.' }] } },
    ];
    fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    return file;
}

/** One in-process stop. A fresh session id per call keeps every call on the live path. */
function timeStop(dir: string, transcriptPath: string, session: string): { ms: number; rc: number } {
    setHookStdinOverride(
        JSON.stringify({
            schema_version: 1,
            platform: 'claude',
            event: 'stop',
            native_event: 'Stop',
            session_id: session,
            workspace_root: dir,
            payload: { transcript_path: transcriptPath },
            settings: {},
        }),
    );
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = (() => true) as typeof process.stderr.write;
    const t0 = performance.now();
    try {
        const rc = turnEndGateMain();
        return { ms: performance.now() - t0, rc };
    } finally {
        process.stderr.write = write;
        clearHookStdinOverride();
    }
}

/** Assigning `undefined` to `process.env` stores the string "undefined"; an unset variable must be deleted. */
function restoreEnv(key: string, value: string | undefined): void {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
}

export async function bench(opts: { runs?: number; files?: number }): Promise<LatencyReport> {
    const runs = Math.max(1, opts.runs ?? 30);
    const files = Math.max(1, opts.files ?? 200);
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'graph-feeder-latency-')));
    const home = path.join(root, 'home');
    fs.mkdirSync(home);
    const savedEnv = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, CFG: process.env.EVENT4U_CONFIG_HOME };
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    process.env.EVENT4U_CONFIG_HOME = path.join(home, '.event4u', 'agent-config');
    try {
        const withDir = await makeFixture(root, files, true);
        const withoutDir = await makeFixture(root, files, false);
        const tWith = writeTranscript(withDir, home, 'with');
        const tWithout = writeTranscript(withoutDir, home, 'without');
        const state = graphState(withDir);

        // Warm both paths once so module-level initialisation is not billed to round one.
        timeStop(withDir, tWith, 'warm-with');
        timeStop(withoutDir, tWithout, 'warm-without');

        const a: number[] = [];
        const b: number[] = [];
        const exitCodes = { with: [] as number[], without: [] as number[] };
        for (let i = 0; i < runs; i++) {
            const withFirst = i % 2 === 0;
            const y0 = withFirst ? null : timeStop(withoutDir, tWithout, `without-${i}`);
            const x = timeStop(withDir, tWith, `with-${i}`);
            const y = y0 ?? timeStop(withoutDir, tWithout, `without-${i}`);
            a.push(x.ms);
            b.push(y.ms);
            if (!exitCodes.with.includes(x.rc)) exitCodes.with.push(x.rc);
            if (!exitCodes.without.includes(y.rc)) exitCodes.without.push(y.rc);
        }

        const feeder: number[] = [];
        const edit = [path.join(withDir, 'src', 'service.ts')];
        for (let i = 0; i < runs; i++) {
            const t0 = performance.now();
            graphUntestedVerdict(withDir, graphState(withDir), edit);
            feeder.push(performance.now() - t0);
        }

        const w = distribution(a);
        const wo = distribution(b);
        const round = (x: number): number => Math.round(x * 100) / 100;
        return {
            runs,
            files,
            graphState: state,
            exitCodes,
            with: w,
            without: wo,
            delta: { p50: round(w.p50 - wo.p50), p95: round(w.p95 - wo.p95) },
            feederOnly: distribution(feeder),
            node: process.version,
            platform: `${os.platform()} ${os.release()} ${os.arch()}`,
            cpu: `${os.cpus()[0]?.model ?? 'unknown'} x${os.cpus().length}`,
        };
    } finally {
        restoreEnv('HOME', savedEnv.HOME);
        restoreEnv('USERPROFILE', savedEnv.USERPROFILE);
        restoreEnv('EVENT4U_CONFIG_HOME', savedEnv.CFG);
        fs.rmSync(root, { recursive: true, force: true });
    }
}

export interface RepoReport {
    runs: number;
    repo: string;
    edit: string;
    graphState: string;
    verdict: string | null;
    feederOnly: Distribution;
}

/** The feeder's work alone over an existing repository's graph. Writes nothing. */
export function benchRepo(opts: { repo: string; edit: string; runs?: number | undefined }): RepoReport {
    const runs = Math.max(1, opts.runs ?? 30);
    const repo = path.resolve(opts.repo);
    const edit = [path.resolve(repo, opts.edit)];
    let state = graphState(repo);
    let verdict: string | null = null;
    const samples: number[] = [];
    for (let i = 0; i <= runs; i++) {
        const t0 = performance.now();
        state = graphState(repo);
        verdict = graphUntestedVerdict(repo, state, edit).verdict;
        // Round zero is the warm-up and is not billed.
        if (i > 0) samples.push(performance.now() - t0);
    }
    return { runs, repo: path.basename(repo), edit: opts.edit, graphState: state, verdict, feederOnly: distribution(samples) };
}

function renderRepo(r: RepoReport): string {
    const d = r.feederOnly;
    return [
        `graph-feeder work over ${r.repo} — edit ${r.edit}, graph state ${r.graphState}, verdict ${r.verdict}`,
        `n ${d.n} · p50 ${d.p50} ms · p95 ${d.p95} ms · max ${d.max} ms`,
    ].join('\n');
}

function render(r: LatencyReport): string {
    const row = (name: string, d: Distribution): string =>
        `| ${name} | ${d.n} | ${d.p50} | ${d.p95} | ${d.max} |`;
    return [
        `graph-feeder latency — ${r.runs} rounds, ${r.files} generated modules, graph state ${r.graphState}`,
        `machine: ${r.cpu}, ${r.platform}, node ${r.node}`,
        '',
        '| arm | n | p50 ms | p95 ms | max ms |',
        '|---|---|---|---|---|',
        row('stop hook, with feeder', r.with),
        row('stop hook, without feeder', r.without),
        row('feeder work alone', r.feederOnly),
        '',
        `delta: p50 ${r.delta.p50} ms, p95 ${r.delta.p95} ms`,
        `exit codes: with ${JSON.stringify(r.exitCodes.with)}, without ${JSON.stringify(r.exitCodes.without)}`,
    ].join('\n');
}

interface Args {
    runs?: number;
    files?: number;
    repo?: string;
    edit?: string;
    format: 'text' | 'json';
}

function parseArgs(argv: readonly string[]): Args | null {
    const out: Args = { format: 'text' };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const v = argv[i + 1];
        if (a === '--runs' || a === '--files') {
            const n = Number(v);
            if (!Number.isInteger(n) || n < 1) return null;
            if (a === '--runs') out.runs = n;
            else out.files = n;
            i++;
        } else if ((a === '--repo' || a === '--edit') && v !== undefined && v !== '') {
            if (a === '--repo') out.repo = v;
            else out.edit = v;
            i++;
        } else if (a === '--format' && (v === 'text' || v === 'json')) {
            out.format = v;
            i++;
        } else {
            return null;
        }
    }
    // Both or neither: a repository with no edit to price is not a reading.
    if ((out.repo === undefined) !== (out.edit === undefined)) return null;
    return out;
}

async function cli(): Promise<number> {
    const args = parseArgs(process.argv.slice(2));
    if (args === null) {
        process.stderr.write(
            'usage: bench_graph_feeder_latency [--runs N] [--files N] [--format text|json]\n' +
                '       bench_graph_feeder_latency --repo P --edit F [--runs N] [--format text|json]\n',
        );
        return 2;
    }
    if (args.repo !== undefined && args.edit !== undefined) {
        const r = benchRepo({ repo: args.repo, edit: args.edit, runs: args.runs });
        process.stdout.write(args.format === 'json' ? `${JSON.stringify(r, null, 2)}\n` : `${renderRepo(r)}\n`);
        return 0;
    }
    const r = await bench(args);
    process.stdout.write(args.format === 'json' ? `${JSON.stringify(r, null, 2)}\n` : `${render(r)}\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    cli().then(
        (rc) => process.exit(rc),
        (e: unknown) => {
            process.stderr.write(`bench_graph_feeder_latency: ${String(e)}\n`);
            process.exit(2);
        },
    );
}
