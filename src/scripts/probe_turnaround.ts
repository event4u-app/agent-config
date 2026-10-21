#!/usr/bin/env tsx
/**
 * Turnaround instrument — round-trips, batch size, blocking waits, context floor.
 *
 * WHY IT EXISTS. `agents/evidence/analysis/agent-turnaround-2026-08-30.md`
 * measured that a user request in this package costs 42.6 API round-trips and a
 * file change costs 58 tool calls, and its fifth finding is that NONE of it was
 * measurable before: no instrument in the tree reported round-trips per request,
 * tool-call batch size, or the blocking-wait tail, so no gate could have caught
 * any of them growing. That analysis was a throwaway script. This is the
 * committed form of it — `road-to-agent-turnaround` Phase 1.1.
 *
 * THE UNIT IS `requestId`, NOT THE ROW. The host writes `thinking`, `text` and
 * `tool_use` as SEPARATE JSONL rows that share one `requestId`, so counting rows
 * inflates every per-call figure. That was the first wrong answer the original
 * measurement produced, and it is why this file groups before it counts.
 *
 * WHAT IT REPORTS, per corpus:
 *   - API calls per real user request      (F1)
 *   - mean tool-call batch size            (F1 — measured 1.00, i.e. fully serial)
 *   - the >60 s blocking tail and its share of tool time  (F2)
 *   - that tail split by cause, `unknown` always printed (road-to-blocking-time-by-cause)
 *   - the first-call context floor         (F3 cross-check)
 *   - turn ends by ask shape, usage-limit pauses split night/day, and turn-end
 *     refusals by detector — every class table with an `unknown` row and a sum
 *     check
 *   - with `--git FROM..TO`, merged changes, true merges, net ticked steps and
 *     archived roadmaps per night window
 *
 * A MEASUREMENT, NOT A GATE — by default. `--against-baseline` compares against
 * `src/config/turnaround-budget.json` and is the only mode that can exit
 * non-zero. Whether that mode may run in CI is answered in the config's own
 * `_comment`, because a transcript store is machine-local and a fresh clone has
 * none: a CI gate over it would be green-because-empty, the exact
 * gate-that-scans-nothing-exits-green failure this repository names elsewhere.
 *
 * Usage:
 *   ./scripts-run src/scripts/probe_turnaround [--store PATH] [--limit N]
 *   ./scripts-run src/scripts/probe_turnaround --json
 *   ./scripts-run src/scripts/probe_turnaround --against-baseline
 *   ./scripts-run src/scripts/probe_turnaround --steps [--json]   (per closed roadmap step: model ·
 *       change · verify · ceremony · wait · refusal · unknown, and minutes per change class)
 *   ./scripts-run src/scripts/probe_turnaround --workspace PATH --git 2026-09-28..2026-10-13 [--ref main]
 *   ./scripts-run src/scripts/probe_turnaround --store PATH --against-baseline --queue-root CHECKOUT
 *
 * `--queue-root` gives an exit 1 of the gating mode a reader: it upserts one
 * record into CHECKOUT's self-repair store, which the prompt-time hook injects
 * as the queue line. The same verdict again, any day → the same record, folded.
 *
 * The MEASURING session is excluded by default — see `recentSessions`.
 *
 * Exit codes: 0 = reported (or within baseline) · 1 = baseline regression, an
 * empty corpus under `--against-baseline`, or a class table whose rows do not
 * sum to its total · 2 = usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectRefusalStats, DETECTOR_IDS, type RefusalStats } from './_lib/turn_end_refusals.js';
import {
    checkSum,
    classifyTurnEnd,
    median,
    readCiMinutes,
    readEstateAtRef,
    standingRules,
    isUsageLimitPause,
    isUsageLimitReset,
    nightKey,
    readCommitFacts,
    type EstateFigures,
    type NightTally,
    type Tally,
    tallyExclusive,
    tallyNights,
    TURN_END_CLASSES,
} from './_lib/turnaround_throughput.js';
import { defaultStore, isInjectedBody, userText } from './conformance_scan.js';
import { upsertFinding } from './_lib/self_repair_store.js';
import { readSteps, STEP_CLASSES, summariseSteps } from './_lib/step_anatomy.js';

const _FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_FILE), '..', '..');
export const BUDGET_REL = 'src/config/turnaround-budget.json';

/** The blocking-tail threshold, in seconds. Fixed by the source measurement. */
export const BLOCKING_SECONDS = 60;

type Entry = Record<string, unknown>;

/**
 * What a blocking call waited on. A CLOSED set, and `unknown` is a row of its
 * own rather than a fallback folded into a named cause: a share hidden inside
 * `ci-wait` would confirm whatever hypothesis it was folded into.
 */
export const BLOCKING_CAUSES = [
    'ci-wait',
    'subagent-wait',
    'test',
    'build',
    'network',
    'sleep-poll',
    'mcp',
    // Added by 2.2: the first reading's unknown share was mostly a question
    // waiting on the human, which no agent-side mitigation can shorten.
    'user-wait',
    'unknown',
] as const;
export type BlockingCause = (typeof BLOCKING_CAUSES)[number];

/** Non-shell tools, by exact name. A shell call is classified by its command. */
const TOOL_CAUSE: Readonly<Record<string, BlockingCause>> = {
    Agent: 'subagent-wait',
    Task: 'subagent-wait',
    TaskOutput: 'subagent-wait',
    Monitor: 'sleep-poll',
    WebFetch: 'network',
    WebSearch: 'network',
    AskUserQuestion: 'user-wait',
    ExitPlanMode: 'user-wait',
};

/**
 * Shell rules, matched against each command SEGMENT's leading words in order.
 * The first segment any rule matches decides; a segment no rule matches is
 * skipped, so `cd ../lane; ./scripts-run …/ci_settle 12` reads as the settle it
 * is and not as the `cd` in front of it.
 */
const SHELL_RULES: ReadonlyArray<readonly [RegExp, BlockingCause]> = [
    [/^(\S*\/)?scripts-run \S*ci_settle\b/, 'ci-wait'],
    [/^(npm exec (--\S+ )*-- |npx (--\S+ )*)?(\S*\/)?agent-config ci:settle\b/, 'ci-wait'],
    [/^gh (run watch|pr checks)\b/, 'ci-wait'],
    [/^(sleep|until|while|watch)\b/, 'sleep-poll'],
    [/^((npx |\S*node_modules\/\.bin\/)?(vitest|jest|pytest|phpunit)\b|npm (run )?test\b|task (ci|test)\b)/, 'test'],
    [/^(task (sync|generate-tools|build)\b|npm (ci|install|run build)\b|(npx )?tsc\b|make\b|esbuild\b)/, 'build'],
    [/^(git (push|fetch|pull|clone)\b|curl\b|wget\b|gh (pr (merge|create)|api)\b)/, 'network'],
    [/^(\S*\/)?scripts-run \S*council_cli run\b/, 'network'],
    // A provider CLI invoked directly rather than through `council_cli`: the
    // wait is the same remote round-trip. Added by 3.4 — one council seat in the
    // second window was reached this way and read as `unknown`.
    [/^(codex exec\b|claude (-p|--print)\b)/, 'network'],
];

/** A segment that only changes directory or sets a variable waited on nothing. */
const NOISE_SEGMENT = /^(cd\b|export\b|set\b|[A-Za-z_][A-Za-z0-9_]*=\S*$)/;

/**
 * Assignments that PREFIX a command in the same segment —
 * `AGENT_CONFIG_BROWSER_SUITES=1 npx vitest run`. `NOISE_SEGMENT` anchors at the
 * end and so only sees an assignment that is the whole segment; this strips the
 * prefix form so the command behind it can match. Added by 3.4: in the second
 * window this one shape held ~80 of 179 unknown blocking minutes, all of them
 * test runs.
 */
const ENV_PREFIX = /^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/;

/**
 * Git's GLOBAL options sit between `git` and the subcommand, so `git -C <path>
 * push` does not match a rule anchored on `git push`. Strips them so the
 * subcommand decides. Added by 3.4 — this package's own token-efficiency rule
 * tells agents to write `git -C <path> …`, so the shape is common here.
 */
const GIT_GLOBAL_OPTS = /^git\s+(?:(?:-[Cc]|--git-dir|--work-tree|--namespace|--exec-path)(?:[= ]\S+)\s+|--(?:no-pager|bare|literal-pathspecs|paginate)\s+)+/;

/** Strip what sits in FRONT of the command a segment actually ran. */
function commandHead(seg: string): string {
    return seg.replace(ENV_PREFIX, '').replace(GIT_GLOBAL_OPTS, 'git ');
}

/** A loop keyword in front of a body: `for …; do sleep 60` reads as the sleep. */
const LOOP_KEYWORD = /^(do|then|else)\s+/;

/**
 * Split a shell command at `;`, `&&`, `||`, `|` and newlines that sit OUTSIDE
 * quotes. A separator inside `"…"` or `'…'`, or escaped with a backslash, is
 * part of an argument — splitting there would read a commit message as a
 * command. Not a shell parser: subshells, `$(…)` and heredocs are not modelled.
 */
function shellSegments(cmd: string): string[] {
    const out: string[] = [];
    let cur = '';
    let quote: '' | '"' | "'" = '';
    for (let i = 0; i < cmd.length; i++) {
        const ch = cmd[i] as string;
        if (quote === '' && ch === '\\' && i + 1 < cmd.length) {
            cur += ch + (cmd[i + 1] as string);
            i++;
            continue;
        }
        if (quote !== '') {
            if (ch === quote) quote = '';
            cur += ch;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            cur += ch;
            continue;
        }
        const two = cmd.slice(i, i + 2);
        if (two === '&&' || two === '||') {
            out.push(cur);
            cur = '';
            i++;
            continue;
        }
        if (ch === ';' || ch === '|' || ch === '\n') {
            out.push(cur);
            cur = '';
            continue;
        }
        cur += ch;
    }
    out.push(cur);
    return out;
}

/**
 * Exactly one cause per call; `unknown` when no rule matches. A compound
 * command takes the cause of its FIRST matching segment, so `git commit && git
 * push` reads as the push — the whole call's time lands on that one cause.
 */
export function classifyBlockingCall(tool: string, input: unknown): BlockingCause {
    if (tool.startsWith('mcp__')) return 'mcp';
    const byName = TOOL_CAUSE[tool];
    if (byName !== undefined) return byName;
    if (tool !== 'Bash' || !isObj(input) || typeof input['command'] !== 'string') return 'unknown';
    for (const raw of shellSegments(input['command'])) {
        const seg = raw.trim().replace(LOOP_KEYWORD, '');
        if (seg === '' || NOISE_SEGMENT.test(seg)) continue;
        const head = commandHead(seg);
        for (const [re, cause] of SHELL_RULES) if (re.test(head)) return cause;
    }
    return 'unknown';
}

/** A shell call that pushes: any segment whose command is `git push`. */
export function isGitPushCall(tool: string, input: unknown): boolean {
    if (tool !== 'Bash' || !isObj(input) || typeof input['command'] !== 'string') return false;
    return shellSegments(input['command']).some((raw) => /^git push\b/.test(commandHead(raw.trim().replace(LOOP_KEYWORD, ''))));
}

/**
 * The in-memory record of one blocking call. `summary` is bounded and never
 * printed or serialised by `main`: command text names local paths and hosts,
 * and the published reading carries counts and minutes only.
 */
export interface BlockingCall {
    tool: string;
    summary: string;
    cause: BlockingCause;
    seconds: number;
}

const SUMMARY_CHARS = 120;

function summarise(tool: string, input: unknown): string {
    const body = isObj(input) && typeof input['command'] === 'string' ? input['command'] : JSON.stringify(input ?? {});
    return `${tool}: ${body}`.slice(0, SUMMARY_CHARS);
}

function isObj(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export interface Turnaround {
    sessions: number;
    userRequests: number;
    apiCalls: number;
    callsPerRequest: number;
    toolCalls: number;
    /** Requests that carried at least one tool_use block. */
    toolUsingRequests: number;
    meanBatchSize: number;
    toolSeconds: number;
    blockingCalls: number;
    blockingSeconds: number;
    blockingShare: number;
    contextFloorMin: number;
    contextFloorMax: number;
    /** Blocking calls and seconds per cause; every cause present, `unknown` included. */
    blockingByCause: Record<BlockingCause, { calls: number; seconds: number }>;
}

function emptyByCause(): Turnaround['blockingByCause'] {
    return Object.fromEntries(BLOCKING_CAUSES.map((c) => [c, { calls: 0, seconds: 0 }])) as Turnaround['blockingByCause'];
}

const ZERO: Turnaround = {
    sessions: 0,
    userRequests: 0,
    apiCalls: 0,
    callsPerRequest: 0,
    toolCalls: 0,
    toolUsingRequests: 0,
    meanBatchSize: 0,
    toolSeconds: 0,
    blockingCalls: 0,
    blockingSeconds: 0,
    blockingShare: 0,
    contextFloorMin: 0,
    contextFloorMax: 0,
    blockingByCause: emptyByCause(),
};

function ms(iso: unknown): number | null {
    if (typeof iso !== 'string') return null;
    const t = Date.parse(iso);
    return Number.isNaN(t) ? null : t;
}

/**
 * The N most recently modified transcript files under `store`, excluding the
 * MEASURING session.
 *
 * The exclusion is not hygiene, it is correctness, and it was found by the
 * instrument failing its own baseline. Two consecutive runs minutes apart
 * reported `calls_per_request` 81.42 then 81.61: the measuring session was
 * adding API calls to the newest transcript while its user-request denominator
 * stayed at one, so the probe was reading its own execution as a regression.
 * The source analysis excluded the measuring session for the same reason and
 * said so; this reproduces that rather than rediscovering it a third time.
 *
 * Identified by `CLAUDE_CODE_SESSION_ID` where the host exports it — the file
 * is `<sessionId>.jsonl` — and otherwise by dropping the single
 * most-recently-modified file, which is the same session by construction on any
 * machine actually running this. `--include-current` opts back in for an
 * offline corpus where nothing is being written.
 */
export function recentSessions(store: string, limit: number, includeCurrent = false): string[] {
    if (!fs.existsSync(store)) return [];
    const all = fs
        .readdirSync(store)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => ({ f, m: fs.statSync(path.join(store, f)).mtimeMs }))
        .sort((a, b) => b.m - a.m);
    if (!includeCurrent && all.length > 0) {
        const sid = process.env['CLAUDE_CODE_SESSION_ID'];
        const idx =
            sid !== undefined && sid !== ''
                ? all.findIndex((x) => x.f === `${sid}.jsonl`)
                : 0;
        if (idx >= 0) all.splice(idx, 1);
    }
    return all.slice(0, limit).map(({ f }) => path.join(store, f));
}

export function measure(files: readonly string[]): Turnaround {
    return measureDetailed(files).turnaround;
}

/** Aggregate only: counts and minutes, never text. */
export interface Throughput {
    /** The last assistant text before each real user request, and at end of file. */
    turnEnds: Tally;
    pauses: { total: number; night: number; day: number; unknown: number; pausedMinutes: number; unresolved: number };
    /** `git push` calls and their median wall-clock, pre-push hook included. */
    push: { calls: number; medianSeconds: number | null };
    /**
     * Step 2.1's unit: `nightKey` nights holding an assistant turn, and those of
     * them that also hold a usage-limit banner. Sorted `YYYY-MM-DD`, no text.
     */
    nights: { active: string[]; paused: string[] };
}

const TURN_END_NAMED = TURN_END_CLASSES.filter((c) => c !== 'unknown');

/** `measure`, plus the per-call blocking records the cause table is built from. */
export function measureDetailed(files: readonly string[]): {
    turnaround: Turnaround;
    blocking: BlockingCall[];
    throughput: Throughput;
} {
    const requestIds = new Set<string>();
    /** requestId → tool_use blocks in it. */
    const batch = new Map<string, number>();
    /** tool_use id → the timestamp the assistant emitted it. */
    const emittedAt = new Map<string, number>();
    /** tool_use id → what was called, kept only until its result arrives. */
    const calledWith = new Map<string, { tool: string; input: unknown }>();
    const durations: number[] = [];
    const blockingCalls: BlockingCall[] = [];
    const contextFloors: number[] = [];
    let userRequests = 0;
    let sessions = 0;
    const turnEndTexts: string[] = [];
    const pauses: Throughput['pauses'] = { total: 0, night: 0, day: 0, unknown: 0, pausedMinutes: 0, unresolved: 0 };
    const pushSeconds: number[] = [];
    const activeNights = new Set<string>();
    const pauseNights = new Set<string>();

    for (const file of files) {
        let sawFloor = false;
        let sawAny = false;
        let lastText: string | null = null;
        let pauseOpen = false;
        let pausedAt: number | null = null;
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
            if (!line.trim()) continue;
            let e: Entry;
            try {
                e = JSON.parse(line) as Entry;
            } catch {
                continue;
            }
            if (e['isSidechain'] === true) continue;
            sawAny = true;
            const msg = e['message'];

            if (isUsageLimitPause(e)) {
                const t = ms(e['timestamp']);
                pauses.total += 1;
                if (t === null) pauses.unknown += 1;
                else if (nightKey(t) !== null) {
                    pauses.night += 1;
                    pauseNights.add(nightKey(t) as string);
                } else pauses.day += 1;
                if (pauseOpen) pauses.unresolved += 1;
                pauseOpen = true;
                pausedAt = t;
                continue;
            }
            if (isUsageLimitReset(e)) {
                const t = ms(e['timestamp']);
                if (pausedAt !== null && t !== null) pauses.pausedMinutes += (t - pausedAt) / 60_000;
                pauseOpen = false;
                pausedAt = null;
                continue;
            }

            if (e['type'] === 'user') {
                // The SAME predicate the conformance scan uses, imported rather
                // than re-typed: a skill body and a slash-command header arrive
                // in the user role and are not requests. Counting them would
                // deflate calls-per-request by inventing a denominator.
                const text = userText(e);
                if (text !== null && !isInjectedBody(text)) {
                    userRequests += 1;
                    if (lastText !== null) turnEndTexts.push(lastText);
                    lastText = null;
                }
                if (isObj(msg) && Array.isArray(msg['content'])) {
                    const at = ms(e['timestamp']);
                    for (const b of msg['content']) {
                        if (!isObj(b) || b['type'] !== 'tool_result') continue;
                        const id = String(b['tool_use_id'] ?? '');
                        const started = emittedAt.get(id);
                        if (started === undefined || at === null) continue;
                        const seconds = (at - started) / 1000;
                        durations.push(seconds);
                        emittedAt.delete(id);
                        const call = calledWith.get(id);
                        calledWith.delete(id);
                        if (call !== undefined && isGitPushCall(call.tool, call.input)) pushSeconds.push(seconds);
                        if (seconds > BLOCKING_SECONDS) {
                            const tool = call?.tool ?? '';
                            blockingCalls.push({
                                tool,
                                summary: summarise(tool, call?.input),
                                cause: classifyBlockingCall(tool, call?.input),
                                seconds,
                            });
                        }
                    }
                }
                continue;
            }

            if (e['type'] !== 'assistant') continue;
            const turnAt = ms(e['timestamp']);
            const turnNight = turnAt === null ? null : nightKey(turnAt);
            if (turnNight !== null) activeNights.add(turnNight);
            const rid = e['requestId'];
            if (typeof rid === 'string' && rid !== '') requestIds.add(rid);

            if (!sawFloor && isObj(msg) && isObj(msg['usage'])) {
                const u = msg['usage'] as Record<string, unknown>;
                const floor =
                    Number(u['input_tokens'] ?? 0) +
                    Number(u['cache_read_input_tokens'] ?? 0) +
                    Number(u['cache_creation_input_tokens'] ?? 0);
                if (floor > 0) {
                    contextFloors.push(floor);
                    sawFloor = true;
                }
            }

            if (!isObj(msg) || !Array.isArray(msg['content'])) continue;
            const at = ms(e['timestamp']);
            let n = 0;
            for (const b of msg['content']) {
                if (isObj(b) && b['type'] === 'text' && typeof b['text'] === 'string' && b['text'].trim() !== '') {
                    lastText = b['text'];
                }
                if (!isObj(b) || b['type'] !== 'tool_use') continue;
                n += 1;
                const id = String(b['id'] ?? '');
                if (id !== '' && at !== null) {
                    emittedAt.set(id, at);
                    calledWith.set(id, { tool: String(b['name'] ?? ''), input: b['input'] });
                }
            }
            if (n > 0 && typeof rid === 'string' && rid !== '') {
                batch.set(rid, (batch.get(rid) ?? 0) + n);
            }
        }
        if (sawAny) sessions += 1;
        if (lastText !== null) turnEndTexts.push(lastText);
        if (pauseOpen) pauses.unresolved += 1;
    }

    const toolCalls = [...batch.values()].reduce((a, b) => a + b, 0);
    const toolSeconds = durations.reduce((a, b) => a + b, 0);
    const blocking = durations.filter((d) => d > BLOCKING_SECONDS);
    const blockingSeconds = blocking.reduce((a, b) => a + b, 0);
    const round = (x: number, p = 2): number => Math.round(x * 10 ** p) / 10 ** p;
    const byCause = emptyByCause();
    for (const c of blockingCalls) {
        byCause[c.cause].calls += 1;
        byCause[c.cause].seconds += c.seconds;
    }
    for (const c of BLOCKING_CAUSES) byCause[c].seconds = round(byCause[c].seconds, 1);

    const turnaround: Turnaround = {
        sessions,
        userRequests,
        apiCalls: requestIds.size,
        callsPerRequest: userRequests === 0 ? 0 : round(requestIds.size / userRequests),
        toolCalls,
        toolUsingRequests: batch.size,
        meanBatchSize: batch.size === 0 ? 0 : round(toolCalls / batch.size),
        toolSeconds: round(toolSeconds, 1),
        blockingCalls: blocking.length,
        blockingSeconds: round(blockingSeconds, 1),
        blockingShare: toolSeconds === 0 ? 0 : round(blockingSeconds / toolSeconds, 4),
        contextFloorMin: contextFloors.length === 0 ? 0 : Math.min(...contextFloors),
        contextFloorMax: contextFloors.length === 0 ? 0 : Math.max(...contextFloors),
        blockingByCause: byCause,
    };
    pauses.pausedMinutes = Math.round(pauses.pausedMinutes);
    const throughput: Throughput = {
        turnEnds: tallyExclusive(turnEndTexts, TURN_END_NAMED, (t) => [classifyTurnEnd(t)]),
        pauses,
        push: { calls: pushSeconds.length, medianSeconds: median(pushSeconds) },
        nights: {
            active: [...activeNights].sort(),
            paused: [...pauseNights].filter((n) => activeNights.has(n)).sort(),
        },
    };
    return { turnaround, blocking: blockingCalls, throughput };
}

export interface Budget {
    baseline: {
        calls_per_request: number;
        mean_batch_size: number;
        blocking_share: number;
        context_floor_max: number;
    };
    empty_corpus: 'fail' | 'report';
}

export function readBudget(root = REPO_ROOT): Budget | null {
    const p = path.join(root, BUDGET_REL);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8')) as Budget;
}

/**
 * Baseline comparison.
 *
 * `calls_per_request` is deliberately ABSENT — see the comment in the body.
 * Direction is DOWN for `blocking_share`, and UP for
 * `mean_batch_size` — a batch of 1.00 is the floor being fixed, so a higher
 * number is the improvement and the ratchet must not read it as a regression.
 * `context_floor_max` is DOWN. Getting one of these directions backwards would
 * make the gate reward the defect, which is why they are listed rather than
 * inferred from a shared helper.
 */
export function compare(t: Turnaround, b: Budget): string[] {
    const out: string[] = [];
    // `calls_per_request` is REPORTED, never compared. Twice measured unstable
    // for reasons that are not regressions: it fell 81.42 -> 72.67 when the
    // measuring session was excluded, then drifted 72.67 -> 73.73 within the
    // same afternoon because the corpus is an MTIME WINDOW and other sessions
    // in the same project store keep sliding into it. A ratchet on a number
    // that moves when nothing changed teaches the reader to ignore the gate,
    // which is the failure this repository records for gates that can only
    // block. The three metrics below are stable across the same runs.
    if (t.meanBatchSize < b.baseline.mean_batch_size) {
        out.push(
            `mean batch size ${String(t.meanBatchSize)} < baseline ${String(b.baseline.mean_batch_size)} (direction: UP — 1.00 is fully serial)`,
        );
    }
    if (t.blockingShare > b.baseline.blocking_share) {
        out.push(
            `blocking share ${String(t.blockingShare)} > baseline ${String(b.baseline.blocking_share)} (direction: DOWN)`,
        );
    }
    if (t.contextFloorMax > b.baseline.context_floor_max) {
        out.push(
            `context floor max ${String(t.contextFloorMax)} > baseline ${String(b.baseline.context_floor_max)} (direction: DOWN)`,
        );
    }
    return out;
}

type GitReading = NightTally & { range: string; ref: string };

interface Standing {
    estate: EstateFigures;
    rules: { files: number; withoutPaths: number };
    ci: Array<{ range: string; workflow: string; runs: number; medianMinutes: number | null; truncated: boolean }>;
}

const WINDOW = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

/** `FROM..TO[,FROM..TO…]` as date pairs, or `null` when any window is malformed. */
export function parseWindows(value: string): Array<[string, string]> | null {
    const out: Array<[string, string]> = [];
    for (const w of value.split(',')) {
        const m = WINDOW.exec(w.trim());
        if (m === null) return null;
        out.push([m[1] as string, m[2] as string]);
    }
    return out;
}

/** Night keys inside an inclusive `FROM..TO` range. */
function inRange(nights: readonly string[], range: string): number {
    const [from, to] = range.split('..') as [string, string];
    return nights.filter((n) => n >= from && n <= to).length;
}

function renderThroughput(tp: Throughput, refusals: RefusalStats, git: readonly GitReading[], st: Standing): string {
    const p50 = (x: number | null, unit: string): string => (x === null ? 'n/a' : `${String(Math.round(x * 10) / 10)} ${unit}`);
    const per = (n: number, d: number): string => (d === 0 ? '0' : String(Math.round((n / d) * 10) / 10));
    const lines = [
        `  turn ends                    ${String(tp.turnEnds.total)}`,
        ...Object.entries(tp.turnEnds.rows).map(([c, n]) => `    ${c.padEnd(16)}${String(n)}`),
        `  usage-limit pauses           ${String(tp.pauses.total)} (night ${String(tp.pauses.night)}, day ${String(tp.pauses.day)}, unknown ${String(tp.pauses.unknown)}), ` +
            `${String(tp.pauses.pausedMinutes)} min paused, ${String(tp.pauses.unresolved)} without a reset`,
        `  paused nights                ${String(tp.nights.paused.length)} of ${String(tp.nights.active.length)} active night(s)`,
        `  turn-end refusals            ${String(refusals.total)} in ${String(refusals.sessionsWithRefusals)} session(s) with a refusal — ` +
            `the whole refusal store, ${(refusals.earliest ?? '-').slice(0, 10)}..${(refusals.latest ?? '-').slice(0, 10)}, not the --limit window`,
        ...DETECTOR_IDS.map((d) => `    ${d.padEnd(18)}${String(refusals.byDetector[d])}`),
        `  git push                     ${String(tp.push.calls)} call(s), p50 ${p50(tp.push.medianSeconds, 's')}`,
        `  ready roadmaps at 0 ticked   ${String(st.estate.atZero)} of ${String(st.estate.ready)} (at --ref)`,
        `  open steps without blocked-by ${String(st.estate.unblocked)} of ${String(st.estate.openSteps)}`,
        `  standing rule files          ${String(st.rules.files)}, ${String(st.rules.withoutPaths)} without \`paths:\``,
    ];
    for (const ci of st.ci) {
        lines.push(
            `  ${ci.workflow} ${ci.range} (created, UTC dates)   ${String(ci.runs)} successful PR run(s), p50 ${p50(ci.medianMinutes, 'min')}` +
                (ci.truncated ? ' — TRUNCATED at the listing limit, the window holds more runs' : ''),
        );
    }
    for (const g of git) {
        lines.push(
            `  git ${g.range} @ ${g.ref} · ${String(g.calendarNights)} night(s), ${String(g.nights)} with a commit (22:00–08:00 Europe/Berlin)`,
            `    commits ${String(g.commits)} (${per(g.commits, g.calendarNights)}/night), naming a PR ${String(g.prCommits)} (${per(g.prCommits, g.calendarNights)}/night) · true merges ${String(g.trueMerges)}`,
            `    net ticked steps ${String(g.netTicked)} (${per(g.netTicked, g.calendarNights)}/night) · roadmaps archived ${String(g.archived)}`,
            `    paused nights ${String(inRange(tp.nights.paused, g.range))} of ${String(inRange(tp.nights.active, g.range))} active (transcripts in the --limit window)`,
        );
    }
    lines.push('');
    return lines.join('\n');
}

function render(t: Turnaround, store: string): string {
    const pct = (x: number): string => `${String(Math.round(x * 1000) / 10)} %`;
    return [
        `probe:turnaround · ${String(t.sessions)} session(s) · ${store}`,
        `  API calls per user request   ${String(t.callsPerRequest)}  (${String(t.apiCalls)} calls / ${String(t.userRequests)} requests)`,
        `  mean tool-call batch size    ${String(t.meanBatchSize)}  (${String(t.toolCalls)} tool calls / ${String(t.toolUsingRequests)} tool-using requests)`,
        `  blocking tail (>${String(BLOCKING_SECONDS)}s)        ${String(t.blockingCalls)} call(s), ${String(Math.round(t.blockingSeconds / 60))} min = ${pct(t.blockingShare)} of ${String(Math.round(t.toolSeconds / 60))} min tool time`,
        `  first-call context floor     ${String(t.contextFloorMin)}–${String(t.contextFloorMax)} tokens`,
        `  blocking tail by cause`,
        ...BLOCKING_CAUSES.map((c) => {
            const row = t.blockingByCause[c];
            return `    ${c.padEnd(14)}${String(row.calls)} call(s), ${String(Math.round(row.seconds / 60))} min`;
        }),
        '',
    ].join('\n');
}

/**
 * One record per verdict shape. The evidence carries the metric NAMES, never
 * values or a date: the store's fingerprint folds digits away, so a red reading
 * on a later day increments the same record, reopens it and stamps `last_seen`
 * — the date lives there, not in the text.
 */
export function queueRegression(root: string, verdict: string, now: Date): void {
    const rec = upsertFinding(root, {
        defect_class: 'model-noticed',
        source: 'self-detected',
        evidence: `probe_turnaround regression: ${verdict}`,
        suggested_surface:
            `road-to-agent-throughput-recovery owns the figures; re-run probe_turnaround --against-baseline and read ${BUDGET_REL}`,
    }, now.toISOString());
    if (rec === null) {
        process.stderr.write('probe_turnaround: the self-repair creation cap dropped this verdict; the store counts it as overflow\n');
    }
}

/**
 * `--steps`: where each closed roadmap step's wall-clock went. A report, never a
 * gate; exit 1 only when a step's classes do not sum to its total, because then
 * the split itself is wrong and no row of it can be read.
 */
function reportSteps(files: readonly string[], store: string, json: boolean): number {
    const readings = files.flatMap((f) => readSteps(f, classifyBlockingCall));
    const s = summariseSteps(readings);
    if (json) {
        process.stdout.write(`${JSON.stringify({ store, sessions: files.length, ...s }, null, 2)}\n`);
    } else {
        const lines = [
            `probe:turnaround --steps · ${String(s.steps)} closed step(s) over ${String(files.length)} session(s) in ${store}`,
            '  class      p50 s   p90 s   share',
            ...STEP_CLASSES.map((c) => {
                const r = s.byClass[c];
                return `  ${c.padEnd(9)} ${String(r.p50).padStart(6)}  ${String(r.p90).padStart(6)}  ${(r.share * 100).toFixed(1).padStart(5)} %`;
            }),
            '  change class   steps   p50 min   p90 min   mean batch',
            ...(['R0', 'R1', 'R2', 'R3'] as const).map((k) => {
                const r = s.byRisk[k];
                return `  ${k.padEnd(13)} ${String(r.steps).padStart(6)}  ${String(r.p50Min).padStart(8)}  ${String(r.p90Min).padStart(8)}  ${String(r.meanBatch).padStart(11)}`;
            }),
        ];
        process.stdout.write(`${lines.join('\n')}\n`);
    }
    if (s.sumErrors.length > 0) {
        for (const err of s.sumErrors) process.stderr.write(`❌  probe_turnaround: ${err}\n`);
        return 1;
    }
    return 0;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const arg = (flag: string, dflt: string): string => {
        const i = argv.indexOf(flag);
        return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : dflt;
    };
    for (const a of argv) {
        if (a.startsWith('-') && !['--store', '--limit', '--json', '--against-baseline', '--include-current', '--workspace', '--git', '--ref', '--rules-dir', '--ci', '--queue-root', '--steps', '-h', '--help'].includes(a)) {
            if (!argv.includes('--store') && !argv.includes('--limit')) {
                process.stderr.write(`probe_turnaround: unrecognized argument: ${a}\n`);
                return 2;
            }
        }
    }
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(
            'usage: probe_turnaround [--store PATH] [--limit N] [--json] [--against-baseline] [--include-current]\n' +
                '                        [--workspace PATH] [--git FROM..TO[,…]] [--ref REF] [--rules-dir PATH] [--ci FROM..TO[,…]]\n' +
                '                        [--queue-root CHECKOUT] [--steps]\n',
        );
        return 0;
    }
    const store = arg('--store', defaultStore(process.cwd()));
    const qi = argv.indexOf('--queue-root');
    const queueRoot = qi >= 0 ? argv[qi + 1] : undefined;
    if (qi >= 0 && (queueRoot === undefined || queueRoot.startsWith('-'))) {
        process.stderr.write('probe_turnaround: --queue-root needs the checkout whose self-repair store gets the record\n');
        return 2;
    }
    const queue = (verdict: string): void => {
        if (queueRoot !== undefined) queueRegression(queueRoot, verdict, new Date());
    };
    const limit = Number(arg('--limit', '10'));
    if (!Number.isFinite(limit) || limit < 1) {
        process.stderr.write('probe_turnaround: --limit needs a positive integer\n');
        return 2;
    }
    const gitWindows = argv.includes('--git') ? parseWindows(arg('--git', '')) : [];
    const ciWindows = argv.includes('--ci') ? parseWindows(arg('--ci', '')) : [];
    if (gitWindows === null || ciWindows === null) {
        process.stderr.write('probe_turnaround: --git and --ci need FROM..TO[,FROM..TO…] as YYYY-MM-DD..YYYY-MM-DD\n');
        return 2;
    }
    if (argv.includes('--steps')) {
        // A drain runs in a worktree, and the host files a worktree's transcripts
        // under a project directory of its own, so one store holds a fraction of
        // the steps. `--steps` reads a comma-separated list of stores as one corpus.
        const stepFiles = store
            .split(',')
            .flatMap((s) => recentSessions(s, Number.MAX_SAFE_INTEGER, argv.includes('--include-current')))
            .map((f) => ({ f, m: fs.statSync(f).mtimeMs }))
            .sort((a, b) => b.m - a.m)
            .slice(0, limit)
            .map(({ f }) => f);
        return reportSteps(stepFiles, store, argv.includes('--json'));
    }
    const files = recentSessions(store, limit, argv.includes('--include-current'));
    const detailed = files.length === 0 ? null : measureDetailed(files);
    const t = detailed?.turnaround ?? ZERO;
    const tp: Throughput = detailed?.throughput ?? {
        turnEnds: tallyExclusive([], TURN_END_NAMED, () => []),
        pauses: { total: 0, night: 0, day: 0, unknown: 0, pausedMinutes: 0, unresolved: 0 },
        push: { calls: 0, medianSeconds: null },
        nights: { active: [], paused: [] },
    };
    const workspace = arg('--workspace', REPO_ROOT);
    const ref = arg('--ref', 'HEAD');
    const rulesDir = arg('--rules-dir', path.join(process.env['HOME'] ?? '', '.claude', 'rules'));
    const ci: Standing['ci'] = ciWindows.map(([from, to]) => {
        const { minutes, truncated } = readCiMinutes(REPO_ROOT, 'tests.yml', from, to);
        return { range: `${from}..${to}`, workflow: 'tests.yml', runs: minutes.length, medianMinutes: median(minutes), truncated };
    });
    const standing: Standing = {
        estate: readEstateAtRef(REPO_ROOT, ref),
        rules: standingRules(rulesDir),
        ci,
    };
    const refusals = collectRefusalStats(workspace);
    const git: GitReading[] = gitWindows.map(([from, to]) => ({
        range: `${from}..${to}`,
        ref,
        ...tallyNights(readCommitFacts(REPO_ROOT, ref, from, to), from, to),
    }));
    const gating = argv.includes('--against-baseline');

    if (argv.includes('--json')) {
        const refusalSummary = { total: refusals.total, sessions: refusals.sessionsWithRefusals, byDetector: refusals.byDetector };
        process.stdout.write(`${JSON.stringify({ store, ...t, throughput: tp, refusals: refusalSummary, git, standing }, null, 2)}\n`);
    } else {
        process.stdout.write(render(t, store));
        process.stdout.write(renderThroughput(tp, refusals, git, standing));
    }

    const sumErrors = [
        checkSum('turn ends', tp.turnEnds.rows, tp.turnEnds.total),
        checkSum('usage-limit pauses', { night: tp.pauses.night, day: tp.pauses.day, unknown: tp.pauses.unknown }, tp.pauses.total),
        checkSum('turn-end refusals', refusals.byDetector, refusals.total),
        checkSum('blocking tail', Object.fromEntries(BLOCKING_CAUSES.map((c) => [c, t.blockingByCause[c].calls])), t.blockingCalls),
    ].filter((x): x is string => x !== null);
    if (sumErrors.length > 0) {
        for (const err of sumErrors) process.stderr.write(`❌  probe_turnaround: ${err}\n`);
        if (argv.includes('--against-baseline')) queue('class rows do not sum to their total, no verdict');
        return 1;
    }

    if (!gating) {
        if (files.length === 0) {
            // A REPORT over an empty store is honest and exits 0; only the
            // gating mode treats emptiness as a failure. The distinction is the
            // whole of step 1.3.
            process.stdout.write(
                `probe:turnaround · no transcript store at ${store} — nothing measured (report mode; ` +
                    'use --against-baseline for the fail-closed form)\n',
            );
        }
        return 0;
    }

    const budget = readBudget();
    if (budget === null) {
        process.stderr.write(`❌  probe_turnaround: ${BUDGET_REL} is missing — nothing to compare against.\n`);
        queue('baseline missing, no verdict');
        return 1;
    }
    if (files.length === 0) {
        if (budget.empty_corpus === 'fail') {
            process.stderr.write(
                `❌  probe_turnaround: empty corpus at ${store}. A baseline comparison over zero ` +
                    'sessions certifies nothing, and the config records `empty_corpus: "fail"` so it ' +
                    'refuses rather than reporting green.\n',
            );
            queue('empty corpus, no verdict');
            return 1;
        }
        process.stdout.write('probe:turnaround · empty corpus, `empty_corpus: "report"` — no verdict.\n');
        return 0;
    }
    const regressions = compare(t, budget);
    if (regressions.length > 0) {
        process.stderr.write('❌  probe_turnaround: regression against the recorded baseline:\n');
        for (const r of regressions) process.stderr.write(`    ${r}\n`);
        process.stderr.write(
            `    → raising a baseline in ${BUDGET_REL} needs the reason as a sentence in the same commit.\n`,
        );
        queue(regressions.map((r) => r.split(/ [<>] /)[0]).join(', '));
        return 1;
    }
    process.stdout.write('✅  probe_turnaround: within the recorded baseline on all four metrics.\n');
    return 0;
}

if (process.argv[1] !== undefined && process.argv[1].includes('probe_turnaround')) {
    process.exit(main());
}
