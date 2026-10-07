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
 * Arms are INTERLEAVED, one call each per round, and the rounds cycle through
 * all six ORDERS of the three calls: interleaving spreads slow drift across the
 * arms, and the full permutation cycle balances the position of every call and
 * its direct predecessor WITHIN a round (GC after the heavier arm, cache
 * warmth) — exactly so when the round count is a multiple of six. Across a round
 * boundary it does not: the first call of a round follows the previous round's
 * last call, and those six transitions are unbalanced (two are a call following
 * itself). A third
 * reading, inside the same rotation, times the feeder's own work (`graphState` + `graphUntestedVerdict`) in isolation on the
 * `with` tree, because the difference of two noisy totals is a weaker number
 * than a direct one.
 *
 * WHAT IT DOES NOT CLAIM. One machine, one generated repository shape. The size
 * is a flag rather than a constant so a reader can re-take the reading at the
 * scale they care about; the published page names the machine and the flags it
 * was taken with. Not a gate: it prints and exits 0 on any completed run.
 *
 * `--repo P --edit F` takes the third reading only, over an EXISTING repository
 * and its own graph: no hook call and no feeder row written, but NOT read-only.
 * `loadGraph` re-emits the repository's SQLite twin
 * (`agents/runtime/state/code-graph-v1.sqlite3`) whenever no valid one exists,
 * and the unbilled warm-up round absorbs that write. A generated tree
 * prices the walk; it does not price opening a real index, whose load time grows
 * with the graph and is the larger term on a repository of any size.
 *
 * Usage:
 *   ./scripts-run src/scripts/bench_graph_feeder_latency [--runs N] [--files N]
 *     [--format text|json]
 *   ./scripts-run src/scripts/bench_graph_feeder_latency --repo P --edit F [--runs N]
 *   ./scripts-run src/scripts/bench_graph_feeder_latency --load-split GRAPH_JSON [--runs N]
 *
 * `--load-split` decomposes the load term `--repo` reports (`benchLoadSplit`)
 * over a scratch copy of the graph file, so it writes nothing to the repository.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

import { gitEnv } from './_lib/git_env.js';
import { graphUntestedVerdict } from './_lib/graph_feeder_record.js';
import { LexicalIndex } from './_lib/lexical_index.js';
import { buildFromRepo } from './code_graph/build.js';
import { graphState, NATIVE_CACHE_REL } from './code_graph/detect.js';
import { loadGraph } from './code_graph/query.js';
import { emitSqliteTwin, sqliteTwinPath } from './code_graph/sqlite_store.js';
import type { CodeEdge, CodeGraph } from './code_graph/types.js';
import { validateGraph } from './code_graph/validate.js';
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
    /** The `without` tree's state — `absent`, or that arm is not the no-feeder baseline. */
    graphStateWithout: string;
    /** Exit codes seen per arm — a shadow arm must not move them. */
    exitCodes: { with: number[]; without: number[] };
    with: Distribution;
    without: Distribution;
    /** `with.p50 - without.p50`, and the same for p95. */
    delta: { p50: number; p95: number };
    /** The feeder's own work, timed directly on the `with` tree. */
    feederOnly: Distribution;
    /**
     * Every verdict the timed feeder calls returned. `graphUntestedVerdict`
     * turns any throw into `null`, so a broken graph load would otherwise be
     * timed as if it were the real walk.
     */
    feederVerdicts: (string | null)[];
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

function git(dir: string, args: string[]): void {
    // An inherited GIT_DIR (every git hook exports one) overrides `-C`, which
    // would commit the fixture onto the host repository.
    const env = {
        ...gitEnv(),
        GIT_AUTHOR_NAME: 'bench',
        GIT_AUTHOR_EMAIL: 'bench@example.com',
        GIT_COMMITTER_NAME: 'bench',
        GIT_COMMITTER_EMAIL: 'bench@example.com',
    };
    execFileSync('git', ['-C', dir, ...args], { env, stdio: 'ignore' });
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
        // The specifier is assembled so `prepack-check`, which scans shipped
        // sources for relative imports, does not read fixture text as one.
        `import { run0 } from '${['..', 'src', 'mod0.js'].join('/')}';\n\nexport function check(): boolean {\n    return run0('a') === 'a0';\n}\n`,
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

/**
 * Every order of the three calls. Cycling through all six puts each call first
 * equally often AND, within a round, gives every call each other call as its
 * direct predecessor equally often; rotating the start of one fixed cycle only
 * does the former. The round-boundary transitions are not balanced.
 */
export const ORDERS: readonly (readonly number[])[] = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
];

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
        const stateWithout = graphState(withoutDir);

        const edit = [path.join(withDir, 'src', 'service.ts')];
        const feederCall = (): { ms: number; verdict: string | null } => {
            const t0 = performance.now();
            const v = graphUntestedVerdict(withDir, graphState(withDir), edit).verdict;
            return { ms: performance.now() - t0, verdict: v };
        };

        // Warm every path once so module-level initialisation is not billed to round one.
        timeStop(withDir, tWith, 'warm-with');
        timeStop(withoutDir, tWithout, 'warm-without');
        feederCall();

        const a: number[] = [];
        const b: number[] = [];
        const feeder: number[] = [];
        const feederVerdicts: (string | null)[] = [];
        const exitCodes = { with: [] as number[], without: [] as number[] };
        for (let i = 0; i < runs; i++) {
            const calls = [
                (): void => {
                    const x = timeStop(withDir, tWith, `with-${i}`);
                    a.push(x.ms);
                    if (!exitCodes.with.includes(x.rc)) exitCodes.with.push(x.rc);
                },
                (): void => {
                    const y = timeStop(withoutDir, tWithout, `without-${i}`);
                    b.push(y.ms);
                    if (!exitCodes.without.includes(y.rc)) exitCodes.without.push(y.rc);
                },
                (): void => {
                    const f = feederCall();
                    feeder.push(f.ms);
                    if (!feederVerdicts.includes(f.verdict)) feederVerdicts.push(f.verdict);
                },
            ];
            for (const k of ORDERS[i % ORDERS.length] ?? []) calls[k]?.();
        }

        const w = distribution(a);
        const wo = distribution(b);
        const round = (x: number): number => Math.round(x * 100) / 100;
        return {
            runs,
            files,
            graphState: state,
            graphStateWithout: stateWithout,
            exitCodes,
            with: w,
            without: wo,
            delta: { p50: round(w.p50 - wo.p50), p95: round(w.p95 - wo.p95) },
            feederOnly: distribution(feeder),
            feederVerdicts,
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
    /** Every distinct verdict across the billed rounds — a swallowed load failure reads `null`. */
    verdicts: (string | null)[];
    feederOnly: Distribution;
}

/**
 * The feeder's work alone over an existing repository's graph. Writes no feeder
 * row and calls no hook, but it is NOT read-only: `graphUntestedVerdict` ->
 * `loadGraph` re-emits `agents/runtime/state/code-graph-v1.sqlite3` into the
 * measured repository whenever no valid twin exists, and the unbilled warm-up
 * round absorbs that write, so billed rounds price whatever path the twin left
 * (twin-backed when the emit succeeded, the JSON path when it failed).
 */
export function benchRepo(opts: { repo: string; edit: string; runs?: number | undefined }): RepoReport {
    const runs = Math.max(1, opts.runs ?? 30);
    const repo = path.resolve(opts.repo);
    const edit = [path.resolve(repo, opts.edit)];
    let state = graphState(repo);
    const verdicts: (string | null)[] = [];
    const samples: number[] = [];
    for (let i = 0; i <= runs; i++) {
        const t0 = performance.now();
        state = graphState(repo);
        const verdict = graphUntestedVerdict(repo, state, edit).verdict;
        // Round zero is the warm-up and is not billed.
        if (i > 0) {
            samples.push(performance.now() - t0);
            if (!verdicts.includes(verdict)) verdicts.push(verdict);
        }
    }
    return { runs, repo: path.basename(repo), edit: opts.edit, graphState: state, verdicts, feederOnly: distribution(samples) };
}

export interface LoadSplitReport {
    runs: number;
    graph: string;
    bytes: number;
    nodes: number;
    edges: number;
    /** `loadGraph`'s JSON path, stage by stage, each a distribution over the billed rounds. */
    stages: { read: Distribution; parse: Distribution; validate: Distribution; twinEmit: Distribution; maps: Distribution; lexical: Distribution };
    /** Billed rounds in which `emitSqliteTwin` returned true; 0 means every stop pays the attempt again. */
    twinWritten: number;
    /** The whole `loadGraph` over the same copy with its twin removed first: the term the stages decompose. */
    loadGraph: Distribution;
}

/**
 * Decompose `loadGraph`'s JSON path (`code_graph/query.ts`) over a COPY of a
 * graph cache, so the measured repository is never written. Each round removes
 * the copy's twin first, then times the stages `loadGraph` runs when no valid
 * twin exists: read, `JSON.parse`, `validateGraph`, `emitSqliteTwin`, and the
 * node and edge maps, and the lexical index. The stages re-implement that sequence
 * rather than instrument it, so the whole `loadGraph` is timed in the same round
 * as the check that the split accounts for the term it names. Foreign-graph
 * adaptation is not timed: a native cache never takes it.
 */
export function benchLoadSplit(opts: { graph: string; runs?: number | undefined }): LoadSplitReport {
    const runs = Math.max(1, opts.runs ?? 5);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feeder-load-split-'));
    const copy = path.join(root, 'code-graph-v1.json');
    fs.copyFileSync(opts.graph, copy);
    const twin = sqliteTwinPath(copy);
    const read: number[] = [];
    const parse: number[] = [];
    const validate: number[] = [];
    const twinEmit: number[] = [];
    const maps: number[] = [];
    const lexical: number[] = [];
    const whole: number[] = [];
    let twinWritten = 0;
    let nodes = 0;
    let edges = 0;
    const push = (m: Map<string, CodeEdge[]>, k: string, e: CodeEdge): void => {
        const arr = m.get(k);
        if (arr) arr.push(e);
        else m.set(k, [e]);
    };
    try {
        for (let i = 0; i <= runs; i++) {
            fs.rmSync(twin, { force: true });
            const t0 = performance.now();
            const raw = fs.readFileSync(copy, 'utf-8');
            const t1 = performance.now();
            const parsed = JSON.parse(raw) as unknown;
            const t2 = performance.now();
            const v = validateGraph(parsed);
            if (!v.ok) throw new Error(`invalid graph at ${opts.graph}: ${v.errors.slice(0, 3).join('; ')}`);
            const graph = parsed as CodeGraph;
            const t3 = performance.now();
            const wrote = emitSqliteTwin(graph, raw, copy);
            const t4 = performance.now();
            const byId = new Map(graph.nodes.map((n) => [n.id, n]));
            const outM = new Map<string, CodeEdge[]>();
            const inM = new Map<string, CodeEdge[]>();
            for (const e of graph.edges) {
                push(outM, e.source, e);
                push(inM, e.target, e);
            }
            const t45 = performance.now();
            new LexicalIndex(graph.nodes.map((n) => ({ id: n.id, text: `${n.label} ${n.id}` })));
            const t5 = performance.now();
            fs.rmSync(twin, { force: true });
            const t6 = performance.now();
            loadGraph(copy).close();
            const t7 = performance.now();
            void byId;
            nodes = graph.nodes.length;
            edges = graph.edges.length;
            // Round zero is the warm-up and is not billed.
            if (i === 0) continue;
            read.push(t1 - t0);
            parse.push(t2 - t1);
            validate.push(t3 - t2);
            twinEmit.push(t4 - t3);
            maps.push(t45 - t4);
            lexical.push(t5 - t45);
            whole.push(t7 - t6);
            if (wrote) twinWritten++;
        }
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
    return {
        runs,
        graph: path.basename(opts.graph),
        bytes: fs.statSync(opts.graph).size,
        nodes,
        edges,
        stages: {
            read: distribution(read),
            parse: distribution(parse),
            validate: distribution(validate),
            twinEmit: distribution(twinEmit),
            maps: distribution(maps),
            lexical: distribution(lexical),
        },
        twinWritten,
        loadGraph: distribution(whole),
    };
}

function renderLoadSplit(r: LoadSplitReport): string {
    const row = (name: string, d: Distribution): string => `| ${name} | ${d.n} | ${d.p50} | ${d.p95} | ${d.max} |`;
    return [
        `loadGraph JSON path over a copy of ${r.graph}: ${r.bytes} bytes, ${r.nodes} nodes, ${r.edges} edges, ${r.runs} billed rounds`,
        '',
        '| stage | n | p50 ms | p95 ms | max ms |',
        '|---|---|---|---|---|',
        row('read file', r.stages.read),
        row('JSON.parse', r.stages.parse),
        row('validateGraph', r.stages.validate),
        row('emitSqliteTwin', r.stages.twinEmit),
        row('node + edge maps', r.stages.maps),
        row('lexical index', r.stages.lexical),
        row('whole loadGraph', r.loadGraph),
        '',
        `twin written in ${r.twinWritten} of ${r.runs} rounds`,
    ].join('\n');
}

function renderRepo(r: RepoReport): string {
    const d = r.feederOnly;
    return [
        `graph-feeder work over ${r.repo} — edit ${r.edit}, graph state ${r.graphState}, verdicts ${JSON.stringify(r.verdicts)}`,
        `n ${d.n} · p50 ${d.p50} ms · p95 ${d.p95} ms · max ${d.max} ms`,
        // A stop follows an edit, so the realistic state is `edited`; on a clean
        // tree the git probes answer differently and the reading prices that.
        ...(r.graphState === 'edited' ? [] : [`note: graph state is ${r.graphState}, not edited — a stop normally follows an uncommitted edit`]),
    ].join('\n');
}

function render(r: LatencyReport): string {
    const row = (name: string, d: Distribution): string =>
        `| ${name} | ${d.n} | ${d.p50} | ${d.p95} | ${d.max} |`;
    return [
        `graph-feeder latency — ${r.runs} rounds, ${r.files} generated modules, graph state ${r.graphState} (without arm: ${r.graphStateWithout})`,
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
        `feeder verdicts: ${JSON.stringify(r.feederVerdicts)}`,
    ].join('\n');
}

export interface Args {
    runs?: number;
    files?: number;
    repo?: string;
    edit?: string;
    loadSplit?: string;
    format: 'text' | 'json';
}

export function parseArgs(argv: readonly string[]): Args | null {
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
        } else if ((a === '--repo' || a === '--edit') && v !== undefined && v !== '' && !v.startsWith('--')) {
            if (a === '--repo') out.repo = v;
            else out.edit = v;
            i++;
        } else if (a === '--load-split' && v !== undefined && v !== '' && !v.startsWith('--')) {
            out.loadSplit = v;
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
    // `--files` sizes the generated fixture, which `--repo` mode never builds.
    if (out.repo !== undefined && out.files !== undefined) return null;
    // `--load-split` reads one graph file; it neither builds a fixture nor prices an edit.
    if (out.loadSplit !== undefined && (out.repo !== undefined || out.files !== undefined)) return null;
    return out;
}

async function cli(): Promise<number> {
    const args = parseArgs(process.argv.slice(2));
    if (args === null) {
        process.stderr.write(
            'usage: bench_graph_feeder_latency [--runs N] [--files N] [--format text|json]\n' +
                '       bench_graph_feeder_latency --repo P --edit F [--runs N] [--format text|json]\n' +
                '       bench_graph_feeder_latency --load-split GRAPH_JSON [--runs N] [--format text|json]\n',
        );
        return 2;
    }
    if (args.loadSplit !== undefined) {
        const r = benchLoadSplit({ graph: args.loadSplit, runs: args.runs });
        process.stdout.write(args.format === 'json' ? `${JSON.stringify(r, null, 2)}\n` : `${renderLoadSplit(r)}\n`);
        return 0;
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
