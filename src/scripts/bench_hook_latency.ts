#!/usr/bin/env tsx
/**
 * bench_hook_latency — standing, published hook-dispatch latency harness.
 *
 * road-to-credible-install Phase 1: the 9.8.0 external review measured
 * ~1.6 s p50 per PreToolUse dispatch (CLI → bash → tsx → per-concern tsx
 * re-spawn). The precompiled single-process dispatcher (dist/hooks/
 * dispatch.js) replaces that chain; THIS harness is the re-runnable proof
 * and the regression net. An external reviewer runs it from a fresh clone:
 *
 *     npm ci && npm run build:cli && npm run build:hooks
 *     ./scripts-run src/scripts/bench_hook_latency            # measure + print
 *     ./scripts-run src/scripts/bench_hook_latency --gate     # enforce budget
 *     ./scripts-run src/scripts/bench_hook_latency --update   # record numbers
 *     ./scripts-run src/scripts/bench_hook_latency --via-cli  # real consumer path
 *
 * Method (pinned so numbers reproduce):
 *   - N invocations per hook event (default 50, --runs N) with a synthetic
 *     payload on stdin and a throwaway temp workspace as --project-dir
 *     (concern state lands there, never in the repo). Two invocation paths:
 *       default    — `node dist/hooks/dispatch.js --platform claude
 *                    --event <e>` (the bare bundle).
 *       --via-cli  — the EXACT command line `hooks/hooks.json` installs
 *                    (bash wrapper + project-shim probe +
 *                    `agent-config dispatch:hook … --native-event …
 *                    --min-version 1`), i.e. the path consumers actually
 *                    pay per hook event (road-to-hook-latency-repair
 *                    Phase 1).
 *   - AGENT_CONFIG_REPLAY=1 (feedback-dir writes off — measures dispatch,
 *     not audit-trail I/O).
 *   - Wall-clock per invocation around spawnSync; p50/p95 per event.
 *
 * Gate semantics (--gate):
 *   - pre_tool_use p95 must be ≤ budgets_ms.pre_tool_use.p95_ci
 *   - every event p95 must be ≤ budgets_ms.any_hook_event.p95_ci
 *   - when docs/hook-latency.json exists AND its recorded invocation_path
 *     matches this run's path, a p95 regression beyond
 *     regression_gate.max_regression_pct fails (mismatched paths skip the
 *     regression net — absolute budgets still bind).
 *   Budgets: src/config/hook-latency-budget.json (pre-registered, owner +
 *   review date — see the Phase-6 budget-ownership lint).
 *
 * Baseline history (--baseline "<hardware class>"): appends this run to the
 * `history` array in docs/hook-latency.json — invocation path, hardware
 * class, per-event p50/p95 — WITHOUT touching the top-level results the
 * regression net compares against. Used to commit the pre-fix CLI-path
 * numbers before the Phase-2 levers landed.
 *
 * Exit codes: 0 green · 1 budget/regression exceeded · 2 internal error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build_claude_hook_matrix } from './_lib/claude_settings_hooks.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BUNDLE = path.join(REPO_ROOT, 'dist', 'hooks', 'dispatch.js');
/**
 * Override the measured dispatcher bundle (`--bundle <path>`), so a
 * two-version comparison on ONE machine is a flag rather than a throwaway
 * script. Added for road-to-per-turn-hook-economy step 0.5, whose decisive
 * probe is exactly that: the same events, the same method, two bundles built
 * from two trees, same hardware. The measured process is the bundle itself —
 * a bundle from another tree carries that tree's manifest resolution, so pass
 * `--project-dir`-shaped state via the workspace as usual.
 *
 * Deliberately measurement-only: `--gate` and `--update` refuse an override,
 * because a budget row and a regression baseline describe THIS tree's bundle
 * and a foreign reading must never be written into either.
 */
let BUNDLE_OVERRIDE: string | null = null;
const CLI_BIN = path.join(REPO_ROOT, 'dist', 'cli', 'agent-config.js');
const SHIM = path.join(REPO_ROOT, 'agent-config');
const MANIFEST_PATH = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const BUDGET_PATH = path.join(REPO_ROOT, 'src', 'config', 'hook-latency-budget.json');
const RESULTS_PATH = path.join(REPO_ROOT, 'docs', 'hook-latency.json');

const EVENTS: readonly string[] = [
    'pre_tool_use',
    'post_tool_use',
    'user_prompt_submit',
    'stop',
    'session_start',
    'session_end',
];

/** snake_case hook event → the platform-native name hooks.json passes. */
const NATIVE_EVENT: Readonly<Record<string, string>> = {
    pre_tool_use: 'PreToolUse',
    post_tool_use: 'PostToolUse',
    user_prompt_submit: 'UserPromptSubmit',
    stop: 'Stop',
    session_start: 'SessionStart',
    session_end: 'SessionEnd',
};

export type InvocationPath = 'bundle' | 'cli';

interface EventResult {
    event: string;
    runs: number;
    p50_ms: number;
    p95_ms: number;
    max_ms: number;
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, idx)] as number;
}

/**
 * Size of the synthetic `tool_response` body, in characters (`--payload-bytes`).
 *
 * The default 0 keeps the historical minimal payload, so every recorded number
 * and the CI gate stay comparable. A non-zero value is the **large-payload
 * cell** of the § 2 matrix in `road-to-per-turn-hook-economy`: D-2 is that the
 * dispatcher re-serialises the whole envelope — tool result included — once per
 * concern, so the cost the payload adds is what step 1.2's A/B measures.
 * Deliberately measurement-only, like `--bundle`: a padded payload must never
 * write a budget row or a regression baseline.
 */
let PAYLOAD_BYTES = 0;

/**
 * Events a `tool_response` belongs on. The § 2 matrix pads a `PostToolUse` with
 * a large tool response and a `Stop` with a large *transcript* — two different
 * fixtures, not one field sprayed across every slot. Padding `stop` was tried
 * and is wrong twice over: the shape does not occur, and `spawnSync` throws
 * EPIPE because a dispatcher that never drains a body it has no reason to read
 * exits while the parent is still writing. The transcript cell is a separate
 * fixture and is not implemented here.
 */
const TOOL_EVENTS: ReadonlySet<string> = new Set(['pre_tool_use', 'post_tool_use']);

function syntheticPayload(event: string, workspace: string): string {
    // Claude-shaped payload; concerns read tool_name/tool_input for
    // pre/post_tool_use. A plain Read is the common non-matching case —
    // the fast path consumers pay on every tool call.
    const body: Record<string, unknown> = {
        session_id: 'bench-hook-latency',
        cwd: workspace,
        hook_event_name: event,
        tool_name: 'Read',
        tool_input: { file_path: path.join(workspace, 'README.md') },
    };
    if (PAYLOAD_BYTES > 0 && TOOL_EVENTS.has(event)) {
        // Filler with no JSON metacharacters, so the cost measured is
        // serialisation volume rather than escaping. The FIELD differs per slot
        // and that matters: `tool_response` does not exist on a `PreToolUse`
        // payload, so padding it there would measure a shape the host never
        // sends — the same objection this file raises against padding `stop`.
        const filler = 'x'.repeat(PAYLOAD_BYTES);
        if (event === 'post_tool_use') {
            body['tool_response'] = filler;
        } else {
            body['tool_input'] = { ...(body['tool_input'] as object), description: filler };
        }
    }
    return JSON.stringify(body);
}

/**
 * The verbatim per-event command `hooks/hooks.json` installs — taken from
 * build_claude_hook_matrix(), the SAME generator that writes hooks.json and
 * the consumer settings entries, so the bench cannot drift from the
 * installed command. The bench sets CLAUDE_PROJECT_DIR to the throwaway
 * workspace (which carries a symlink to the repo shim, exactly the layout a
 * shim-carrying project has), so the probe takes the same branch a consumer
 * pays and concern state stays out of the repo.
 */
let _matrixCache: Record<string, string> | null = null;
function hooksJsonCommand(event: string): string {
    _matrixCache ??= build_claude_hook_matrix(MANIFEST_PATH);
    const native = NATIVE_EVENT[event] ?? event;
    const cmd = _matrixCache[native];
    if (cmd === undefined) {
        throw new Error(`no hook-matrix entry for ${event} (${native}) in ${MANIFEST_PATH}`);
    }
    return cmd;
}

export function benchEvent(
    event: string,
    runs: number,
    workspace: string,
    via: InvocationPath = 'bundle',
): EventResult {
    const durations: number[] = [];
    const payload = syntheticPayload(event, workspace);
    const command: [string, string[]] =
        via === 'cli'
            ? ['bash', ['-c', hooksJsonCommand(event)]]
            : [
                  process.execPath,
                  [
                      BUNDLE_OVERRIDE ?? BUNDLE,
                      '--platform',
                      'claude',
                      '--event',
                      event,
                      '--project-dir',
                      workspace,
                  ],
              ];
    for (let i = 0; i < runs; i += 1) {
        const started = performance.now();
        const proc = spawnSync(command[0], command[1], {
            input: payload,
            encoding: 'utf-8',
            env: { ...process.env, AGENT_CONFIG_REPLAY: '1', CLAUDE_PROJECT_DIR: workspace },
            timeout: 60000,
        });
        const elapsed = performance.now() - started;
        if (proc.error) {
            throw new Error(`dispatch failed on ${event}: ${proc.error.message}`);
        }
        durations.push(elapsed);
    }
    durations.sort((a, b) => a - b);
    return {
        event,
        runs,
        p50_ms: Math.round(percentile(durations, 50)),
        p95_ms: Math.round(percentile(durations, 95)),
        max_ms: Math.round(durations[durations.length - 1] as number),
    };
}

/**
 * One dispatcher invocation that reads stdin, parses it, and exits — the
 * transport-isolation cell of the § 2 matrix.
 *
 * `b-payload-read-parse-dominates`, option (a), council 2026-08-20 (2/2
 * quorum). Phase 1 removed ten of eleven envelope stringifies and moved
 * nothing; Phase 2 removed the body from six of eleven concerns and moved
 * nothing. What is left between the small and large cells happens ONCE per
 * event, before any concern runs: `readFd0ToEnd` drains the pipe and
 * `_build_envelope` parses it. This measures exactly that, through the SAME
 * bundle, interpreter and spawn as the slot reading it is a share of — so the
 * constant terms cancel in the delta.
 *
 * Deliberately the real bundle with `--read-exit` rather than a standalone
 * probe: a probe would re-implement the audited retrying reader, and that copy
 * is the drift `hook_stdin` exists to prevent.
 */
export function benchReadExit(
    event: string,
    runs: number,
    workspace: string,
): EventResult {
    const durations: number[] = [];
    const payload = syntheticPayload(event, workspace);
    for (let i = 0; i < runs; i += 1) {
        const started = performance.now();
        const proc = spawnSync(
            process.execPath,
            [
                BUNDLE_OVERRIDE ?? BUNDLE,
                '--platform',
                'claude',
                '--event',
                event,
                '--project-dir',
                workspace,
                '--read-exit',
            ],
            {
                input: payload,
                encoding: 'utf-8',
                env: { ...process.env, AGENT_CONFIG_REPLAY: '1', CLAUDE_PROJECT_DIR: workspace },
                timeout: 60000,
            },
        );
        const elapsed = performance.now() - started;
        if (proc.error) {
            throw new Error(`read-exit failed on ${event}: ${proc.error.message}`);
        }
        if (!(proc.stderr ?? '').includes('--read-exit ok')) {
            // A silent no-op here would report the fastest possible number and
            // measure nothing — the failure mode this whole cell exists to avoid
            // in the OTHER direction. Refuse instead of publishing it.
            throw new Error(
                `read-exit produced no confirmation on ${event}; the flag may not be ` +
                    `wired in the measured bundle (${BUNDLE_OVERRIDE ?? BUNDLE}). ` +
                    `stderr: ${(proc.stderr ?? '').trim().slice(0, 200)}`,
            );
        }
        durations.push(elapsed);
    }
    durations.sort((a, b) => a - b);
    return {
        event: `read_exit:${event}`,
        runs,
        p50_ms: Math.round(percentile(durations, 50)),
        p95_ms: Math.round(percentile(durations, 95)),
        max_ms: Math.round(durations[durations.length - 1] as number),
    };
}

/** One row of the transport-share decomposition. */
export interface ReadExitCell {
    event: string;
    payload_bytes: number;
    slot_small_p50_ms: number;
    slot_large_p50_ms: number;
    read_exit_small_p50_ms: number;
    read_exit_large_p50_ms: number;
    /** Large-minus-small on the full dispatch. */
    slot_delta_ms: number;
    /** Large-minus-small on read + parse alone. */
    transport_delta_ms: number;
    /**
     * `transport_delta / slot_delta`, as a percentage, or `null` when the slot
     * delta is not positive.
     *
     * `null` is a real answer and must not be rendered as 0: a run whose large
     * cell is no slower than its small one says the fixture did not reproduce
     * the gap on this machine, which is different from saying transport is free.
     */
    transport_share_pct: number | null;
}

/**
 * The four measurements the option asks for, in one invocation.
 *
 * Both payload sizes are needed for the SHARE, and taking them in one run is
 * the point: two separate runs would compare across whatever else the machine
 * was doing, which is the cross-runner shape § 2 of the roadmap refuses as a
 * repo fact. Arms alternate per repetition for the same reason.
 */
export function benchReadExitCell(
    event: string,
    runs: number,
    workspace: string,
    payloadBytes: number,
): ReadExitCell {
    const saved = PAYLOAD_BYTES;
    try {
        PAYLOAD_BYTES = 0;
        const slotSmall = benchEvent(event, runs, workspace, 'bundle');
        const probeSmall = benchReadExit(event, runs, workspace);
        PAYLOAD_BYTES = payloadBytes;
        const slotLarge = benchEvent(event, runs, workspace, 'bundle');
        const probeLarge = benchReadExit(event, runs, workspace);
        const slot_delta_ms = slotLarge.p50_ms - slotSmall.p50_ms;
        const transport_delta_ms = probeLarge.p50_ms - probeSmall.p50_ms;
        return {
            event,
            payload_bytes: payloadBytes,
            slot_small_p50_ms: slotSmall.p50_ms,
            slot_large_p50_ms: slotLarge.p50_ms,
            read_exit_small_p50_ms: probeSmall.p50_ms,
            read_exit_large_p50_ms: probeLarge.p50_ms,
            slot_delta_ms,
            transport_delta_ms,
            transport_share_pct:
                slot_delta_ms > 0
                    ? Math.round((transport_delta_ms / slot_delta_ms) * 100)
                    : null,
        };
    } finally {
        PAYLOAD_BYTES = saved;
    }
}

/** Human-readable decomposition, one line per fact. */
export function renderReadExitCell(cell: ReadExitCell): string {
    const share =
        cell.transport_share_pct === null
            ? 'n/a — the large cell was not slower than the small one in this run'
            : `${String(cell.transport_share_pct)}%`;
    return (
        `read-exit cell · ${cell.event} · payload ${String(cell.payload_bytes)}B\n` +
        `  full dispatch    small ${String(cell.slot_small_p50_ms).padStart(5)} ms · ` +
        `large ${String(cell.slot_large_p50_ms).padStart(5)} ms · delta ${String(cell.slot_delta_ms)} ms\n` +
        `  read + parse     small ${String(cell.read_exit_small_p50_ms).padStart(5)} ms · ` +
        `large ${String(cell.read_exit_large_p50_ms).padStart(5)} ms · delta ${String(cell.transport_delta_ms)} ms\n` +
        `  transport share of the large-payload delta: ${share}\n`
    );
}

/**
 * Same-run control: a bare `node -e 0`, measured through the identical
 * spawnSync harness the slots use.
 *
 * WHY this exists (road-to-hook-latency-gate-noise). Every slot reading is
 * `process spawn + interpreter start + bundle load + concern work`, and only
 * the last term is ours. The first two scale with whatever else the shared CI
 * runner is doing, which is why the SAME commit measured `pre_tool_use` p95
 * 107 ms and 187 ms eight minutes apart on 2026-08-19 — a 45 ms swing with no
 * diff between them. An absolute wall-clock cap therefore reads runner load as
 * if it were code cost, and a cap that sits INSIDE its own metric's spread
 * (150 against an observed 107-187) fails by construction rather than on a
 * regression.
 *
 * The control isolates the process-spawn term so `slot - control` is closer to
 * this tree's own cost than the raw reading is. It is measurement only — see
 * `normalizedRows` for why it does not gate yet.
 *
 * MEASURED LIMIT, first CI reading (2026-08-19): it under-corrects, and by a
 * lot. The same commit read slot 101 / control 45 / excess 56 ms on darwin and
 * slot 151 / control 26 / excess 124 ms on a GitHub ubuntu runner — the control
 * went DOWN while the slot went UP. `node -e 0` covers interpreter startup
 * only, while a dispatch also loads a ~1 MB bundle and runs the concern chain,
 * and that term is both the dominant one and the one that varies. So the excess
 * is NOT invariant across hardware classes; whether it is nonetheless more
 * stable than the absolute reading across runs on the SAME runner class is the
 * open question the observe-only collection exists to answer.
 */
export function benchControl(runs: number, workspace: string): EventResult {
    const durations: number[] = [];
    for (let i = 0; i < runs; i += 1) {
        const started = performance.now();
        const proc = spawnSync(process.execPath, ['-e', '0'], {
            encoding: 'utf-8',
            env: { ...process.env, AGENT_CONFIG_REPLAY: '1', CLAUDE_PROJECT_DIR: workspace },
            timeout: 60000,
        });
        const elapsed = performance.now() - started;
        if (proc.error) {
            throw new Error(`control spawn failed: ${proc.error.message}`);
        }
        durations.push(elapsed);
    }
    durations.sort((a, b) => a - b);
    return {
        event: 'control_node_start',
        runs,
        p50_ms: Math.round(percentile(durations, 50)),
        p95_ms: Math.round(percentile(durations, 95)),
        max_ms: Math.round(durations[durations.length - 1] as number),
    };
}

export interface NormalizedRow {
    event: string;
    p95_ms: number;
    control_p95_ms: number;
    /** Wall-clock this tree adds on top of a bare interpreter start. */
    excess_ms: number;
    /** slot / control — 1.0 would mean the dispatcher costs nothing. */
    ratio: number;
}

/**
 * Per-slot readings normalized against the same run's control.
 *
 * OBSERVE-ONLY, deliberately, and the reason is the same one the
 * `per_turn_composite` row states for itself: definition before bar. No bar can
 * be pre-registered here yet, because no historical run recorded a control — so
 * every candidate number would be invented rather than measured, which the
 * budget file's own contract forbids. Arming it is a config change once the
 * nightly has published enough control-carrying runs to set `p95_excess_ci`
 * from real data; no code change is needed.
 *
 * `excess_ms` is the gating candidate rather than `ratio`: the ratio's
 * denominator is the noisiest term, so a slow runner moves it in the direction
 * that makes the gate look GREEN — the wrong way for a safety net to fail.
 */
export function normalizedRows(
    results: readonly EventResult[],
    control: EventResult,
): NormalizedRow[] {
    return results.map((r) => ({
        event: r.event,
        p95_ms: r.p95_ms,
        control_p95_ms: control.p95_ms,
        excess_ms: r.p95_ms - control.p95_ms,
        ratio: control.p95_ms === 0 ? 0 : Math.round((r.p95_ms / control.p95_ms) * 100) / 100,
    }));
}

export interface AppliedCap {
    /** The budget key this cap comes from, so a message names its own source. */
    name: string;
    cap_ms: number;
    /** false → the breach is reported and does NOT fail the build. */
    blocking: boolean;
}

/**
 * Every cap that applies to one slot, tightest first.
 *
 * `pre_tool_use` carries a slot-specific cap AND the shared `any_hook_event`
 * one, and previously only the specific cap was consulted for that slot. That
 * was harmless while it was both the tighter of the two and blocking — which is
 * the shipped configuration today (175 vs 250, neither advisory).
 *
 * Returning both anyway is the fail-closed shape: `blocking` defaults to TRUE
 * on an absent key, so an older or hand-edited budget file cannot silently
 * demote a cap, and if a future config ever does mark the tight cap advisory,
 * `pre_tool_use` still stays inside the blocking gate rather than dropping out
 * of it — the one slot the whole budget exists for. A test pins that.
 */
export function capsFor(budget: Budget, event: string): AppliedCap[] {
    const any = budget.budgets_ms.any_hook_event;
    const caps: AppliedCap[] = [
        { name: 'any_hook_event', cap_ms: any.p95_ci, blocking: any.blocking ?? true },
    ];
    if (event === 'pre_tool_use') {
        const specific = budget.budgets_ms.pre_tool_use;
        caps.push({
            name: 'pre_tool_use',
            cap_ms: specific.p95_ci,
            blocking: specific.blocking ?? true,
        });
    }
    return caps.sort((a, b) => a.cap_ms - b.cap_ms);
}

/** The tightest cap applying to a slot — the threshold a re-measure targets. */
export function capFor(budget: Budget, event: string): number {
    return capsFor(budget, event)[0]?.cap_ms ?? Number.POSITIVE_INFINITY;
}

function loadJson<T>(p: string): T | null {
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
    } catch {
        return null;
    }
}

export interface Budget {
    budgets_ms: {
        pre_tool_use: { p95_ci: number; blocking?: boolean };
        any_hook_event: { p95_ci: number; blocking?: boolean };
    };
    regression_gate: { max_regression_pct: number };
    gate_remeasure?: { attempts?: number };
    normalized?: {
        observe_only?: boolean;
        control?: string;
        p95_excess_ci?: number | null;
    };
    per_turn_composite?: {
        definition?: string;
        aggregation?: string;
        tool_calls?: number;
        observe_only?: boolean;
        p50_ci?: number | null;
    };
}

/**
 * The per-turn composite (D-1 / step 4.1): the number a user experiences on one
 * agentic turn, which no per-slot budget can represent. A single tool call fires
 * `pre_tool_use` AND `post_tool_use`, so ten tool calls pay twenty dispatches
 * plus the prompt and stop slots.
 *
 * Derived, never separately measured — feeding it the same `results` the slot
 * rows come from is what keeps the two from disagreeing. `tool_calls` is read
 * from the budget file rather than hardcoded, so the definition lives with the
 * row it gates.
 *
 * Returns null when a slot the definition needs is missing from `results` (a
 * partial run), because a composite computed over a subset would silently read
 * LOW — which is the direction that makes a cap look met.
 */
export function perTurnComposite(
    results: readonly EventResult[],
    tool_calls: number,
): { ms: number; parts: Record<string, number> } | null {
    const p50 = (event: string): number | null => {
        const r = results.find((x) => x.event === event);
        return r === undefined ? null : r.p50_ms;
    };
    const pre = p50('pre_tool_use');
    const post = p50('post_tool_use');
    const ups = p50('user_prompt_submit');
    const stop = p50('stop');
    if (pre === null || post === null || ups === null || stop === null) return null;
    return {
        ms: (pre + post) * tool_calls + ups + stop,
        parts: { pre_tool_use: pre, post_tool_use: post, user_prompt_submit: ups, stop },
    };
}

interface HistoryEntry {
    recorded_at: string;
    invocation_path: InvocationPath;
    hardware: string;
    node: string;
    platform: string;
    runs_per_event: number;
    results: EventResult[];
}

interface ResultsDoc {
    _comment?: string;
    invocation_path?: InvocationPath;
    results: EventResult[];
    history?: HistoryEntry[];
    [key: string]: unknown;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    // Reset the measurement-only globals per invocation. Their guard below is
    // per-call, so leaving them set let a second `main()` in the same process —
    // `main(['--bundle', …])` then `main(['--update'])` — write a foreign or
    // padded reading into this tree's budget row and regression baseline, the
    // exact outcome the guard's own message says must never happen. Found by
    // the R2 review.
    BUNDLE_OVERRIDE = null;
    PAYLOAD_BYTES = 0;

    const gate = argv.includes('--gate');
    const update = argv.includes('--update');
    const viaCli = argv.includes('--via-cli');
    const via: InvocationPath = viaCli ? 'cli' : 'bundle';
    const baselineIdx = argv.indexOf('--baseline');
    const baselineHardware = baselineIdx >= 0 ? (argv[baselineIdx + 1] ?? null) : null;
    if (baselineIdx >= 0 && (baselineHardware === null || baselineHardware.startsWith('--'))) {
        process.stderr.write('bench_hook_latency: --baseline requires a "<hardware class>" label\n');
        return 2;
    }
    const runsIdx = argv.indexOf('--runs');
    const runs = runsIdx >= 0 ? Number.parseInt(argv[runsIdx + 1] ?? '50', 10) : 50;

    const payloadIdx = argv.indexOf('--payload-bytes');
    if (payloadIdx >= 0) {
        const raw = argv[payloadIdx + 1];
        const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
            process.stderr.write('bench_hook_latency: --payload-bytes requires a non-negative integer\n');
            return 2;
        }
        if (gate || update || baselineIdx >= 0) {
            process.stderr.write(
                'bench_hook_latency: --payload-bytes is measurement-only — a padded payload must ' +
                    "never write this tree's budget row or regression baseline\n",
            );
            return 2;
        }
        PAYLOAD_BYTES = parsed;
    }

    // `--read-exit-cell <bytes>`: the transport-isolation cell. Measurement-only
    // for the same reason `--payload-bytes` is — it PADS the payload, so it must
    // never write a budget row or a regression baseline.
    const readExitIdx = argv.indexOf('--read-exit-cell');
    let readExitBytes: number | null = null;
    if (readExitIdx >= 0) {
        const raw = argv[readExitIdx + 1];
        const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            process.stderr.write(
                'bench_hook_latency: --read-exit-cell requires a positive integer byte count\n',
            );
            return 2;
        }
        if (gate || update || baselineIdx >= 0) {
            process.stderr.write(
                'bench_hook_latency: --read-exit-cell is measurement-only — a padded payload must ' +
                    "never write this tree's budget row or regression baseline\n",
            );
            return 2;
        }
        if (viaCli) {
            process.stderr.write(
                'bench_hook_latency: --read-exit-cell drives the bundle directly and does not use ' +
                    'the --via-cli shim path — pick one\n',
            );
            return 2;
        }
        readExitBytes = parsed;
    }

    const bundleIdx = argv.indexOf('--bundle');
    if (bundleIdx >= 0) {
        const raw = argv[bundleIdx + 1];
        if (raw === undefined || raw.startsWith('--')) {
            process.stderr.write('bench_hook_latency: --bundle requires a path\n');
            return 2;
        }
        if (gate || update || baselineIdx >= 0) {
            process.stderr.write(
                'bench_hook_latency: --bundle is measurement-only — it cannot be combined with ' +
                    '--gate, --update or --baseline (a foreign bundle must never be written ' +
                    "into this tree's budget or regression baseline)\n",
            );
            return 2;
        }
        if (viaCli) {
            process.stderr.write(
                'bench_hook_latency: --bundle overrides the bundle path, which the --via-cli ' +
                    'path does not use (the shim resolves its own) — pick one\n',
            );
            return 2;
        }
        BUNDLE_OVERRIDE = path.resolve(raw);
    }

    const measured_bundle = BUNDLE_OVERRIDE ?? BUNDLE;
    if (!fs.existsSync(measured_bundle)) {
        process.stderr.write(
            `bench_hook_latency: bundle missing at ${measured_bundle} — run \`npm run build:hooks\` first\n`,
        );
        return 2;
    }
    if (viaCli) {
        // The CLI path exercises shim → dist/cli → bundle; a missing link
        // would make the hooks.json probe silently `exit 0` and the bench
        // would time bash startup instead of a dispatch.
        if (!fs.existsSync(CLI_BIN)) {
            process.stderr.write(
                `bench_hook_latency: CLI missing at ${CLI_BIN} — run \`npm run build:cli\` first\n`,
            );
            return 2;
        }
        if (!fs.existsSync(SHIM)) {
            process.stderr.write(`bench_hook_latency: repo shim missing at ${SHIM}\n`);
            return 2;
        }
    }
    const budget = loadJson<Budget>(BUDGET_PATH);
    if (budget === null) {
        process.stderr.write(`bench_hook_latency: budget file missing/invalid at ${BUDGET_PATH}\n`);
        return 2;
    }

    if (readExitBytes !== null) {
        // Its own mode: the cell alternates two payload sizes internally, so
        // running it alongside the ordinary sweep would report a padded number
        // under an unpadded label.
        const cellWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-hook-readexit-'));
        try {
            // `post_tool_use` only. That is where the large cell lives: a
            // `tool_response` does not exist on a `PreToolUse` payload, which is
            // the same objection `syntheticPayload` raises against padding `stop`.
            const cell = benchReadExitCell('post_tool_use', runs, cellWorkspace, readExitBytes);
            process.stdout.write(renderReadExitCell(cell));
            process.stdout.write(
                'ℹ️  measurement only (no gate) — this cell never writes a budget row\n',
            );
        } finally {
            fs.rmSync(cellWorkspace, { recursive: true, force: true });
        }
        return 0;
    }

    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-hook-bench-'));
    const results: EventResult[] = [];
    let control: EventResult | null = null;
    try {
        if (viaCli) {
            // Stage the workspace like a real consumer project so the
            // installed command's probes take the branch consumers pay:
            //   - node_modules/@event4u/agent-config → the package (bundle
            //     fast path candidate 1),
            //   - ./agent-config shim → the CLI fallback (resolved through
            //     the symlink; the shim self-resolves symlinks).
            const scope = path.join(workspace, 'node_modules', '@event4u');
            fs.mkdirSync(scope, { recursive: true });
            fs.symlinkSync(REPO_ROOT, path.join(scope, 'agent-config'));
            fs.symlinkSync(path.join(REPO_ROOT, 'src', 'scripts', 'agent-config'), path.join(workspace, 'agent-config'));
        }
        for (const event of EVENTS) {
            const r = benchEvent(event, runs, workspace, via);
            results.push(r);
            process.stdout.write(
                `${event.padEnd(20)} p50 ${String(r.p50_ms).padStart(5)} ms · p95 ${String(r.p95_ms).padStart(5)} ms · max ${String(r.max_ms).padStart(5)} ms (n=${r.runs}, via ${via}${PAYLOAD_BYTES > 0 ? `, payload ${PAYLOAD_BYTES}B` : ''}${BUNDLE_OVERRIDE === null ? '' : ` @ ${BUNDLE_OVERRIDE}`})\n`,
            );
        }

        // Both of these need the workspace, so they run before the `finally`
        // below tears it down.
        control = benchControl(runs, workspace);
        process.stdout.write(
            `${'control (node -e 0)'.padEnd(20)} p50 ${String(control.p50_ms).padStart(5)} ms · p95 ${String(control.p95_ms).padStart(5)} ms · max ${String(control.max_ms).padStart(5)} ms (n=${control.runs})\n`,
        );

        // Breach re-measure (--gate only). A single p95 over the cap is not yet
        // evidence of a regression: a load spike inside one 50-run sample moves
        // p95 upward and never downward, so re-measuring and keeping the MINIMUM
        // is the estimator that discards the spike instead of recording it.
        //
        // SHIPS DISABLED (`gate_remeasure.attempts` is 1). The budget file's
        // `why_not_a_retry_or_best_of_n` rejected it as the first move on
        // measured grounds: the spread is between runner CLASSES (p50
        // 111-148 ms), not noise within one machine, so a slow runner measures
        // slow twice. Two CI runs of this mechanism agree — it recovered
        // 151→150 and 160→153, i.e. 1-7 ms against a 42 ms spread. The cap was
        // re-derived to 175 instead; this stays as the escalation that block
        // names, reachable by setting `attempts` to 3, and costs nothing while
        // it is off.
        const attempts = Math.max(1, budget.gate_remeasure?.attempts ?? 1);
        if (gate && attempts > 1) {
            for (let i = 0; i < results.length; i += 1) {
                const first = results[i] as EventResult;
                if (first.p95_ms <= capFor(budget, first.event)) continue;
                let best = first;
                const readings = [first.p95_ms];
                for (let attempt = 1; attempt < attempts; attempt += 1) {
                    const again = benchEvent(first.event, runs, workspace, via);
                    readings.push(again.p95_ms);
                    if (again.p95_ms < best.p95_ms) best = again;
                    if (best.p95_ms <= capFor(budget, first.event)) break;
                }
                results[i] = best;
                process.stdout.write(
                    `ℹ️  ${first.event}: over cap on the first sample — re-measured, p95 readings ` +
                        `${readings.join(' / ')} ms, keeping the minimum (${best.p95_ms} ms)\n`,
                );
            }
        }
    } finally {
        fs.rmSync(workspace, { recursive: true, force: true });
    }

    let failed = false;
    const prior = loadJson<ResultsDoc>(RESULTS_PATH);
    const priorPath: InvocationPath = prior?.invocation_path ?? 'bundle';
    for (const r of results) {
        if (gate) {
            for (const applied of capsFor(budget, r.event)) {
                if (r.p95_ms <= applied.cap_ms) continue;
                if (applied.blocking) {
                    process.stderr.write(
                        `❌  ${r.event}: p95 ${r.p95_ms} ms exceeds the pre-registered budget ` +
                            `(${applied.cap_ms} ms, ${applied.name})\n`,
                    );
                    failed = true;
                } else {
                    process.stdout.write(
                        `⚠️  ${r.event}: p95 ${r.p95_ms} ms over the advisory budget ` +
                            `(${applied.cap_ms} ms, ${applied.name}) — reported, not blocking; ` +
                            `see budgets_ms.${applied.name}.blocking in ${path.basename(BUDGET_PATH)}\n`,
                    );
                }
            }
        }
        if (gate && prior !== null && priorPath === via) {
            const prev = prior.results.find((x) => x.event === r.event);
            if (prev !== undefined && prev.p95_ms > 0) {
                const regressionPct = ((r.p95_ms - prev.p95_ms) / prev.p95_ms) * 100;
                if (regressionPct > budget.regression_gate.max_regression_pct) {
                    process.stderr.write(
                        `❌  ${r.event}: p95 regressed ${Math.round(regressionPct)}% vs recorded ` +
                            `${prev.p95_ms} ms (allowed: ${budget.regression_gate.max_regression_pct}%)\n`,
                    );
                    failed = true;
                }
            }
        }
    }
    if (gate && prior !== null && priorPath !== via) {
        process.stdout.write(
            `ℹ️  regression net skipped — recorded baseline is via ${priorPath}, this run is via ${via}\n`,
        );
    }

    // Control-normalized rows. Printed on EVERY run for the same reason the
    // composite below is: a row that only appears under --gate makes the local
    // reading and the CI reading incomparable, and comparing them is the whole
    // point of an instrument built to tell code cost apart from runner load.
    if (control !== null) {
        const normCfg = budget.normalized;
        const bar = normCfg?.p95_excess_ci ?? null;
        const armed = normCfg?.observe_only === false && bar !== null;
        process.stdout.write(
            `normalized vs control (node start p95 ${control.p95_ms} ms) — ` +
                `${armed ? `excess budget ${String(bar)} ms` : 'observe-only'}\n`,
        );
        for (const row of normalizedRows(results, control)) {
            process.stdout.write(
                `  ${row.event.padEnd(20)} excess ${String(row.excess_ms).padStart(4)} ms · ` +
                    `ratio ${row.ratio.toFixed(2)}\n`,
            );
        }
        if (armed && gate) {
            for (const row of normalizedRows(results, control)) {
                if (row.excess_ms > (bar as number)) {
                    process.stderr.write(
                        `❌  ${row.event}: control-normalized excess ${row.excess_ms} ms exceeds ` +
                            `the budget (${String(bar)} ms)\n`,
                    );
                    failed = true;
                }
            }
        }
    }

    // Per-turn composite (D-1 / step 4.1). Printed on EVERY run, gate or not,
    // because an observe-only row that only appears under --gate would leave
    // the local reading and the CI reading incomparable.
    const compositeCfg = budget.per_turn_composite;
    const composite =
        compositeCfg === undefined
            ? null
            : perTurnComposite(results, compositeCfg.tool_calls ?? 10);
    if (compositeCfg !== undefined) {
        const calls = compositeCfg.tool_calls ?? 10;
        if (composite === null) {
            process.stdout.write(
                `ℹ️  per-turn composite not computed — a slot the definition needs is missing from this run\n`,
            );
        } else {
            const ceiling = compositeCfg.p50_ci ?? null;
            const observe = compositeCfg.observe_only !== false;
            const label =
                observe || ceiling === null ? 'observe-only' : `budget ${String(ceiling)} ms`;
            process.stdout.write(
                `per-turn composite  ${String(composite.ms).padStart(5)} ms ` +
                    `= (pre ${composite.parts['pre_tool_use']} + post ${composite.parts['post_tool_use']}) × ${calls}` +
                    ` + ups ${composite.parts['user_prompt_submit']} + stop ${composite.parts['stop']}` +
                    ` (p50, ${label})\n`,
            );
            // observe_only is the arming switch for step 4.2 and is honoured
            // even when a ceiling is present, so a number can be recorded for
            // one release before it starts failing builds.
            if (gate && !observe && ceiling !== null && composite.ms > ceiling) {
                process.stderr.write(
                    `❌  per-turn composite: ${composite.ms} ms exceeds the pre-registered ` +
                        `budget (${ceiling} ms)\n`,
                );
                failed = true;
            }
        }
    }

    if (update || baselineHardware !== null) {
        const existing = prior ?? ({ results: [] } as ResultsDoc);
        const history: HistoryEntry[] = existing.history ?? [];
        if (baselineHardware !== null) {
            history.push({
                recorded_at: new Date().toISOString(),
                invocation_path: via,
                hardware: baselineHardware,
                node: process.version,
                platform: `${os.platform()}-${os.arch()}`,
                runs_per_event: runs,
                results,
            });
        }
        const doc: ResultsDoc = update
            ? {
                  _comment:
                      'Recorded hook-dispatch latency (bench_hook_latency --update). Method pinned in src/scripts/bench_hook_latency.ts; budgets in src/config/hook-latency-budget.json. Re-run from a fresh clone to reproduce. `history` entries (--baseline) are point-in-time records — the top-level results are the regression base.',
                  recorded_at: new Date().toISOString(),
                  node: process.version,
                  platform: `${os.platform()}-${os.arch()}`,
                  hardware_note:
                      'see hook-latency-budget.json hardware_reference — CI numbers are the gated ones',
                  invocation_path: via,
                  runs_per_event: runs,
                  results,
                  ...(composite === null
                      ? {}
                      : {
                            per_turn_composite: {
                                ms: composite.ms,
                                tool_calls: compositeCfg?.tool_calls ?? 10,
                                aggregation: 'p50',
                                parts: composite.parts,
                            },
                        }),
                  ...(history.length > 0 ? { history } : {}),
              }
            : { ...existing, history };
        fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(doc, null, 4)}\n`);
        process.stdout.write(
            `recorded → ${path.relative(REPO_ROOT, RESULTS_PATH)}${update ? '' : ' (history entry only)'}\n`,
        );
    }

    if (failed) return 1;
    process.stdout.write(gate ? '✅  hook-latency budget met\n' : 'ℹ️  measurement only (no gate)\n');
    return 0;
}

const _selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath)) {
    process.exit(main());
}
