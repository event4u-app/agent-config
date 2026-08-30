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
 *   - the first-call context floor         (F3 cross-check)
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
 *
 * The MEASURING session is excluded by default — see `recentSessions`.
 *
 * Exit codes: 0 = reported (or within baseline) · 1 = baseline regression, or an
 * empty corpus under `--against-baseline` · 2 = usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultStore, isInjectedBody, userText } from './conformance_scan.js';

const _FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_FILE), '..', '..');
export const BUDGET_REL = 'src/config/turnaround-budget.json';

/** The blocking-tail threshold, in seconds. Fixed by the source measurement. */
export const BLOCKING_SECONDS = 60;

type Entry = Record<string, unknown>;

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
    const requestIds = new Set<string>();
    /** requestId → tool_use blocks in it. */
    const batch = new Map<string, number>();
    /** tool_use id → the timestamp the assistant emitted it. */
    const emittedAt = new Map<string, number>();
    const durations: number[] = [];
    const contextFloors: number[] = [];
    let userRequests = 0;
    let sessions = 0;

    for (const file of files) {
        let sawFloor = false;
        let sawAny = false;
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

            if (e['type'] === 'user') {
                // The SAME predicate the conformance scan uses, imported rather
                // than re-typed: a skill body and a slash-command header arrive
                // in the user role and are not requests. Counting them would
                // deflate calls-per-request by inventing a denominator.
                const text = userText(e);
                if (text !== null && !isInjectedBody(text)) userRequests += 1;
                if (isObj(msg) && Array.isArray(msg['content'])) {
                    const at = ms(e['timestamp']);
                    for (const b of msg['content']) {
                        if (!isObj(b) || b['type'] !== 'tool_result') continue;
                        const id = String(b['tool_use_id'] ?? '');
                        const started = emittedAt.get(id);
                        if (started === undefined || at === null) continue;
                        durations.push((at - started) / 1000);
                        emittedAt.delete(id);
                    }
                }
                continue;
            }

            if (e['type'] !== 'assistant') continue;
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
                if (!isObj(b) || b['type'] !== 'tool_use') continue;
                n += 1;
                const id = String(b['id'] ?? '');
                if (id !== '' && at !== null) emittedAt.set(id, at);
            }
            if (n > 0 && typeof rid === 'string' && rid !== '') {
                batch.set(rid, (batch.get(rid) ?? 0) + n);
            }
        }
        if (sawAny) sessions += 1;
    }

    const toolCalls = [...batch.values()].reduce((a, b) => a + b, 0);
    const toolSeconds = durations.reduce((a, b) => a + b, 0);
    const blocking = durations.filter((d) => d > BLOCKING_SECONDS);
    const blockingSeconds = blocking.reduce((a, b) => a + b, 0);
    const round = (x: number, p = 2): number => Math.round(x * 10 ** p) / 10 ** p;

    return {
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
    };
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
 * Direction is DOWN for `calls_per_request` and `blocking_share`, and UP for
 * `mean_batch_size` — a batch of 1.00 is the floor being fixed, so a higher
 * number is the improvement and the ratchet must not read it as a regression.
 * `context_floor_max` is DOWN. Getting one of these directions backwards would
 * make the gate reward the defect, which is why they are listed rather than
 * inferred from a shared helper.
 */
export function compare(t: Turnaround, b: Budget): string[] {
    const out: string[] = [];
    if (t.callsPerRequest > b.baseline.calls_per_request) {
        out.push(
            `calls per request ${String(t.callsPerRequest)} > baseline ${String(b.baseline.calls_per_request)} (direction: DOWN)`,
        );
    }
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

function render(t: Turnaround, store: string): string {
    const pct = (x: number): string => `${String(Math.round(x * 1000) / 10)} %`;
    return [
        `probe:turnaround · ${String(t.sessions)} session(s) · ${store}`,
        `  API calls per user request   ${String(t.callsPerRequest)}  (${String(t.apiCalls)} calls / ${String(t.userRequests)} requests)`,
        `  mean tool-call batch size    ${String(t.meanBatchSize)}  (${String(t.toolCalls)} tool calls / ${String(t.toolUsingRequests)} tool-using requests)`,
        `  blocking tail (>${String(BLOCKING_SECONDS)}s)        ${String(t.blockingCalls)} call(s), ${String(Math.round(t.blockingSeconds / 60))} min = ${pct(t.blockingShare)} of ${String(Math.round(t.toolSeconds / 60))} min tool time`,
        `  first-call context floor     ${String(t.contextFloorMin)}–${String(t.contextFloorMax)} tokens`,
        '',
    ].join('\n');
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const arg = (flag: string, dflt: string): string => {
        const i = argv.indexOf(flag);
        return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : dflt;
    };
    for (const a of argv) {
        if (a.startsWith('-') && !['--store', '--limit', '--json', '--against-baseline', '--include-current', '-h', '--help'].includes(a)) {
            if (!argv.includes('--store') && !argv.includes('--limit')) {
                process.stderr.write(`probe_turnaround: unrecognized argument: ${a}\n`);
                return 2;
            }
        }
    }
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(
            'usage: probe_turnaround [--store PATH] [--limit N] [--json] [--against-baseline] [--include-current]\n',
        );
        return 0;
    }
    const store = arg('--store', defaultStore(process.cwd()));
    const limit = Number(arg('--limit', '10'));
    if (!Number.isFinite(limit) || limit < 1) {
        process.stderr.write('probe_turnaround: --limit needs a positive integer\n');
        return 2;
    }
    const files = recentSessions(store, limit, argv.includes('--include-current'));
    const t = files.length === 0 ? ZERO : measure(files);
    const gating = argv.includes('--against-baseline');

    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ store, ...t }, null, 2)}\n`);
    } else {
        process.stdout.write(render(t, store));
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
        return 1;
    }
    if (files.length === 0) {
        if (budget.empty_corpus === 'fail') {
            process.stderr.write(
                `❌  probe_turnaround: empty corpus at ${store}. A baseline comparison over zero ` +
                    'sessions certifies nothing, and the config records `empty_corpus: "fail"` so it ' +
                    'refuses rather than reporting green.\n',
            );
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
        return 1;
    }
    process.stdout.write('✅  probe_turnaround: within the recorded baseline on all four metrics.\n');
    return 0;
}

if (process.argv[1] !== undefined && process.argv[1].includes('probe_turnaround')) {
    process.exit(main());
}
