#!/usr/bin/env tsx
/**
 * The worker-reuse shadow window, read from the subagent ledger, and the four
 * flip conditions of `docs/contracts/concern-activation-policy.md` as code.
 *
 * The guard flips from shadow to blocking only when ALL FOUR hold: a failure
 * the threshold would have caught is in the window, the false-positive rate is
 * measured and within 1 %, the economics are measured and favour it, and the
 * window holds at least 100 calls or two weeks. A condition nobody measured is
 * missing, never assumed. A window in which every reuse was refused is a valid
 * null.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { median, readLedgerStarts, segmentLegsIntoRuns, type SubagentRun } from './cache_realization_report.js';
import { scanTranscripts } from './_lib/cc_transcript.js';
import type { Tier } from './_lib/subagent_routing.js';
import { watermarkForTier } from './_lib/worker_budget.js';
import { REFUSAL_REASONS, shadowReuseVerdict, type ReuseClass, type ReuseContext, type WorkerState } from './_lib/worker_reuse.js';
import { LEDGER_DIR, refFor } from './hooks/subagent_ledger_hook.js';

export interface ShadowLine {
    event: string;
    ts: string;
    tool?: string;
    dispatch_kind?: string;
    reuse?: { verdict: 'would_resume' | 'fresh'; name: string | null; reasons: string[] };
}

export interface ShadowWindow {
    first_ts: string | null;
    last_ts: string | null;
    days: number;
    agent_calls: number;
    would_resume: number;
    would_resume_by_name: Record<string, number>;
    refusal_reasons: Record<string, number>;
    resumes_observed: number;
    null_window: boolean;
}

export const FALSE_POSITIVE_TOLERANCE = 0.01;
export const WINDOW_MIN_CALLS = 100;
export const WINDOW_MIN_DAYS = 14;

const sorted = (m: Record<string, number>): Record<string, number> =>
    Object.fromEntries(Object.entries(m).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

export function summariseShadowWindow(lines: readonly ShadowLine[]): ShadowWindow {
    const shadow = lines.filter((l) => l.event === 'spawn_guard_shadow');
    const spawns = shadow.filter((l) => l.reuse !== undefined);
    const byName: Record<string, number> = {};
    const reasons: Record<string, number> = {};
    let would = 0;
    for (const l of spawns) {
        if (l.reuse!.verdict === 'would_resume' && l.reuse!.name !== null) {
            would++;
            byName[l.reuse!.name] = (byName[l.reuse!.name] ?? 0) + 1;
        } else {
            for (const r of l.reuse!.reasons) reasons[r] = (reasons[r] ?? 0) + 1;
        }
    }
    const times = spawns.map((l) => Date.parse(l.ts)).filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
    const first = times.length ? times[0]! : null;
    const last = times.length ? times[times.length - 1]! : null;
    return {
        first_ts: first === null ? null : new Date(first).toISOString(),
        last_ts: last === null ? null : new Date(last).toISOString(),
        days: first === null || last === null ? 0 : (last - first) / 86_400_000,
        agent_calls: spawns.length,
        would_resume: would,
        would_resume_by_name: sorted(byName),
        refusal_reasons: sorted(reasons),
        resumes_observed: shadow.filter((l) => l.dispatch_kind === 'resume').length,
        null_window: spawns.length > 0 && would === 0,
    };
}

/** Measurements the shadow log cannot produce on its own; null means unmeasured. */
export interface FlipMeasurements {
    false_positive_rate: number | null;
    cost_avoided: number | null;
    friction: number | null;
}

export type FlipCondition = 'failure_observed' | 'false_positive_rate_measured' | 'economics_measured' | 'window_met';

export function flipReadiness(w: ShadowWindow, m: FlipMeasurements): { ready: boolean; missing: FlipCondition[] } {
    const missing: FlipCondition[] = [];
    if (w.would_resume === 0) missing.push('failure_observed');
    if (m.false_positive_rate === null || m.false_positive_rate > FALSE_POSITIVE_TOLERANCE) missing.push('false_positive_rate_measured');
    if (m.cost_avoided === null || m.friction === null || m.cost_avoided <= m.friction) missing.push('economics_measured');
    if (w.agent_calls < WINDOW_MIN_CALLS && w.days < WINDOW_MIN_DAYS) missing.push('window_met');
    return { ready: missing.length === 0, missing };
}

// Council 2026-10-22, decision 1: the hook records the precondition and the join keys only. The full verdict
// for each spawn is rebuilt here, at report time, from the ledger and the
// stopped workers' transcripts, and every output carries `basis:
// 'reconstructed'`. A spawn whose join lacks an input is `incomplete_join` with
// the missing field named — never silently `fresh`.

/** Any subagent-ledger line; only the fields the reconstruction joins on are typed. */
export interface LedgerLine {
    event: string;
    ts: string;
    tool?: string;
    dispatch_kind?: string;
    ref?: string;
    session_id?: string | null;
    agent_type?: string | null;
    name_key?: string;
    head?: string | null;
    cwd_key?: string | null;
    epoch?: number | null;
    reuse?: ShadowLine['reuse'];
}

/** A stopped worker's transcript, keyed by its ledger ref. */
export interface WorkerTranscript {
    /**
     * Assistant calls, chronological. `context_tokens` is billable input + output of that call;
     * `input_tokens` is its total input (uncached + cache write + cache read).
     */
    calls: Array<{ ts: string; context_tokens: number; input_tokens: number }>;
    /** Timestamps of `compact_boundary` records. */
    compact_ts: string[];
}

/** What a package definition under `src/subagents/` says; absent → no `reuse:` → not continuity. */
export interface DefinitionFacts {
    reuse: ReuseClass | null;
    tier: Tier;
}

export interface ReconstructionInputs {
    lines: readonly LedgerLine[];
    transcripts: ReadonlyMap<string, WorkerTranscript>;
    definitions: Readonly<Record<string, DefinitionFacts>>;
    fresh_cold_start_by_type: Readonly<Record<string, number | null>>;
    /** Host default prompt-cache TTL. */
    cache_ttl_ms?: number;
    /** A spawn line without a session id is joined to the next start of its type inside this window. */
    session_join_window_ms?: number;
    /**
     * Spawns before this instant are not reported. `lines` must then reach back past it: a session
     * with register lines before it has a register the window cut, so it reads as unrecorded.
     */
    window_start?: string | null;
}

export type ReconstructedSpawn =
    | { ts: string; agent_type: string; basis: 'reconstructed'; verdict: 'would_resume'; name: string; reasons: []; candidates: number }
    | { ts: string; agent_type: string; basis: 'reconstructed'; verdict: 'fresh'; name: null; reasons: string[]; candidates: number }
    | { ts: string; agent_type: string | null; basis: 'reconstructed'; verdict: 'incomplete_join'; missing: string[] };

export const HOST_DEFAULT_CACHE_TTL_MS = 300_000;

/** Stated beside every reconstructed window: what was approximated, and by what. */
export const RECONSTRUCTION_APPROXIMATIONS = [
    'package_version := epoch of the stop/spawn line (bundle mtime); a change is reported once, as epoch_changed (the decision function\'s policy_epoch_changed)',
    'skill_set_signature := not recorded per worker, so not compared — workspace_changed reflects worktree and head only',
    'last_request_at := the worker\'s last subagent_stop ts',
    'cache_ttl := host default 300000 ms',
    'host_resume := true (worker_resume live on claude under CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, council 2026-10-22)',
    'observed fresh cold start := median over the whole window, not only runs before the spawn',
    'transcript_tokens := last streamed record per message id of the worker\'s last call before the spawn',
    'register := a session with register lines before --since, or a named worker whose start is unseen, is worker_register_unrecorded',
] as const;

/** The pre-registered secondary reading of condition (c); never merged into the primary series. */
export const SECONDARY_C_LIKE_FOR_LIKE_LABEL =
    'secondary — pre-registered 2026-10-23 after the primary window; computed over the same window for information only; a decision on (c) waits for a later window not used to choose it';

const ms = (ts: string): number => Date.parse(ts);
const REGISTER_EVENTS = new Set(['subagent_start', 'subagent_stop', 'subagent_named']);

function isSpawn(l: LedgerLine): boolean {
    return l.event === 'spawn_guard_shadow' && l.dispatch_kind === 'spawn' && (l.tool === 'Agent' || l.tool === 'Task');
}

function reconstructedReason(r: string): string {
    return r === 'policy_epoch_changed' ? 'epoch_changed' : r;
}

export function reconstructSpawnVerdicts(input: ReconstructionInputs): ReconstructedSpawn[] {
    const ttl = input.cache_ttl_ms ?? HOST_DEFAULT_CACHE_TTL_MS;
    const joinWindow = input.session_join_window_ms ?? 10_000;
    const windowStartMs = input.window_start ? ms(input.window_start) : null;
    const lines = [...input.lines].filter((l) => Number.isFinite(ms(l.ts))).sort((a, b) => ms(a.ts) - ms(b.ts));
    const out: ReconstructedSpawn[] = [];
    for (const sp of lines.filter(isSpawn)) {
        const spMs = ms(sp.ts);
        if (windowStartMs !== null && spMs < windowStartMs) continue;
        const type = typeof sp.agent_type === 'string' && sp.agent_type ? sp.agent_type : null;
        const missing: string[] = [];
        if (type === null) missing.push('agent_type');
        let session = typeof sp.session_id === 'string' && sp.session_id ? sp.session_id : null;
        if (session === null && type !== null) {
            const start = lines.find((l) => l.event === 'subagent_start' && l.agent_type === type && ms(l.ts) >= spMs && ms(l.ts) - spMs <= joinWindow);
            session = typeof start?.session_id === 'string' && start.session_id ? start.session_id : null;
        }
        if (session === null) missing.push('session_id');
        for (const f of ['cwd_key', 'head', 'epoch'] as const) if (sp[f] === null || sp[f] === undefined) missing.push(`spawn_${f}`);
        if (missing.length > 0) {
            out.push({ ts: sp.ts, agent_type: type, basis: 'reconstructed', verdict: 'incomplete_join', missing });
            continue;
        }
        const before = lines.filter((l) => l.session_id === session && ms(l.ts) < spMs);
        const context: ReuseContext = {
            domain: type!,
            now_ms: spMs,
            observed_fresh_cold_start_tokens: input.fresh_cold_start_by_type[type!] ?? null,
            worktree: sp.cwd_key!,
            branch_head: sp.head!,
            skill_set_signature: 'unrecorded',
            package_version: String(sp.epoch),
        };
        const named = new Map<string, string>();
        for (const l of before) if (l.event === 'subagent_named' && l.ref && l.name_key) named.set(l.ref, l.name_key);
        const cutByWindow = windowStartMs !== null && before.some((l) => REGISTER_EVENTS.has(l.event) && ms(l.ts) < windowStartMs);
        const startUnseen = [...named.keys()].some((ref) => !before.some((l) => l.ref === ref && l.event === 'subagent_start'));
        if (cutByWindow || startUnseen) {
            const v = shadowReuseVerdict({ host_resume: true, workers: null, context });
            out.push({ ts: sp.ts, agent_type: type!, basis: 'reconstructed', verdict: 'fresh', name: null, reasons: v.reasons.map(reconstructedReason), candidates: 0 });
            continue;
        }
        const workers: WorkerState[] = [];
        const workerMissing = new Set<string>();
        const knownRefusals = new Set<string>();
        const candidateRefs = [...named.keys()]
            .map((ref) => {
                const legs = before.filter((l) => l.ref === ref && (l.event === 'subagent_start' || l.event === 'subagent_stop'));
                const lastStart = legs.filter((l) => l.event === 'subagent_start').pop();
                const lastStop = legs.filter((l) => l.event === 'subagent_stop').pop();
                return { ref, lastStart, lastStop };
            })
            .filter((c) => c.lastStop !== undefined && (c.lastStart === undefined || ms(c.lastStart.ts) <= ms(c.lastStop.ts)))
            .sort((a, b) => ms(b.lastStop!.ts) - ms(a.lastStop!.ts));
        for (const { ref, lastStart, lastStop } of candidateRefs) {
            const stop = lastStop!;
            const typeField = (l: LedgerLine | undefined): string | null => (typeof l?.agent_type === 'string' && l.agent_type ? l.agent_type : null);
            const wType = typeField(stop) ?? typeField(lastStart);
            const def = wType === null ? undefined : input.definitions[wType];
            const tr = input.transcripts.get(ref);
            const calls = tr?.calls.filter((c) => ms(c.ts) < spMs) ?? [];
            const gaps: string[] = [];
            if (wType === null) gaps.push('worker_agent_type');
            if (calls.length === 0) gaps.push('worker_transcript');
            for (const f of ['cwd_key', 'head', 'epoch'] as const) if (stop[f] === null || stop[f] === undefined) gaps.push(`worker_${f}`);
            if (gaps.length > 0) {
                // Only a worker that could be resumed can leave the join incomplete.
                if (wType !== null && wType !== type) knownRefusals.add('domain_mismatch');
                else if (wType !== null && def?.reuse !== 'continuity') knownRefusals.add('not_continuity');
                else for (const g of gaps) workerMissing.add(g);
                continue;
            }
            workers.push({
                name: named.get(ref)!,
                domain: wType!,
                reuse: def?.reuse ?? 'never',
                last_request_at_ms: ms(stop.ts),
                cache_ttl_ms: ttl,
                transcript_tokens: calls[calls.length - 1]!.context_tokens,
                capsule_watermark_tokens: watermarkForTier(def?.tier ?? 'inherit'),
                compacted: (tr?.compact_ts ?? []).some((t) => ms(t) < spMs),
                worktree: stop.cwd_key!,
                branch_head: stop.head!,
                skill_set_signature: 'unrecorded',
                package_version: String(stop.epoch),
            });
        }
        if (workerMissing.size > 0) {
            out.push({ ts: sp.ts, agent_type: type, basis: 'reconstructed', verdict: 'incomplete_join', missing: [...workerMissing].sort() });
            continue;
        }
        const v = workers.length === 0 && knownRefusals.size > 0 ? null : shadowReuseVerdict({ host_resume: true, workers, context });
        if (v !== null && v.verdict === 'would_resume') {
            out.push({ ts: sp.ts, agent_type: type!, basis: 'reconstructed', verdict: 'would_resume', name: v.name, reasons: [], candidates: workers.length });
            continue;
        }
        const seen = new Set<string>([...(v?.reasons ?? []), ...knownRefusals]);
        const ordered = [...REFUSAL_REASONS.filter((r) => seen.has(r)), ...[...seen].filter((r) => !(REFUSAL_REASONS as readonly string[]).includes(r))];
        out.push({ ts: sp.ts, agent_type: type!, basis: 'reconstructed', verdict: 'fresh', name: null, reasons: ordered.map(reconstructedReason), candidates: workers.length });
    }
    return out;
}

/** Median first-call TOTAL input (uncached + cache write + cache read) of fresh runs, per definition — the like-for-like threshold. */
export function likeForLikeColdStartByType(transcripts: ReadonlyMap<string, WorkerTranscript>, lines: readonly LedgerLine[]): Record<string, number> {
    const typeOf = new Map<string, string>();
    for (const l of lines) if (l.event === 'subagent_start' && l.ref && typeof l.agent_type === 'string' && !typeOf.has(l.ref)) typeOf.set(l.ref, l.agent_type);
    const by: Record<string, number[]> = {};
    for (const [ref, t] of typeOf) {
        const first = transcripts.get(ref)?.calls[0];
        if (first !== undefined) (by[t] ??= []).push(first.input_tokens);
    }
    return Object.fromEntries(Object.entries(by).map(([t, v]) => [t, median(v)]));
}

/** Median first-call written-or-uncached tokens of FRESH (ordinal 1) runs, per definition. */
export function freshColdStartByType(runs: readonly SubagentRun[], lines: readonly LedgerLine[]): Record<string, number> {
    const typeOf = new Map<string, string>();
    for (const l of lines) if (l.event === 'subagent_start' && l.ref && typeof l.agent_type === 'string') typeOf.set(l.ref, l.agent_type);
    const by: Record<string, number[]> = {};
    for (const r of runs) {
        const t = typeOf.get(r.ref);
        if (r.ordinal !== 1 || t === undefined) continue;
        (by[t] ??= []).push(r.first_call_written_or_uncached);
    }
    return Object.fromEntries(Object.entries(by).map(([t, v]) => [t, median(v)]));
}

export interface ReconstructionSummary {
    basis: 'reconstructed';
    spawns: number;
    complete: number;
    would_resume: number;
    incomplete_joins: number;
    incomplete_by_field: Record<string, number>;
    window: ShadowWindow;
}

export function summariseReconstruction(spawns: readonly ReconstructedSpawn[]): ReconstructionSummary {
    const incomplete = spawns.filter((s) => s.verdict === 'incomplete_join');
    const byField: Record<string, number> = {};
    for (const s of incomplete) if (s.verdict === 'incomplete_join') for (const f of s.missing) byField[f] = (byField[f] ?? 0) + 1;
    const complete = spawns.flatMap((s): ShadowLine[] =>
        s.verdict === 'incomplete_join'
            ? []
            : [{ event: 'spawn_guard_shadow', ts: s.ts, tool: 'Agent', dispatch_kind: 'spawn', reuse: { verdict: s.verdict, name: s.name, reasons: s.reasons } }],
    );
    const window = summariseShadowWindow(complete);
    return {
        basis: 'reconstructed',
        spawns: spawns.length,
        complete: complete.length,
        would_resume: window.would_resume,
        incomplete_joins: incomplete.length,
        incomplete_by_field: sorted(byField),
        window,
    };
}

export function readLedgerLines(ledgerDir: string, sinceIso: string | null = null): LedgerLine[] {
    if (!fs.existsSync(ledgerDir)) return [];
    const out: LedgerLine[] = [];
    for (const f of fs.readdirSync(ledgerDir).filter((n) => n.endsWith('.jsonl')).sort()) {
        for (const line of fs.readFileSync(path.join(ledgerDir, f), 'utf8').split('\n')) {
            if (!line.trim()) continue;
            try {
                const o = JSON.parse(line) as LedgerLine;
                if (typeof o.event === 'string' && typeof o.ts === 'string' && (sinceIso === null || Date.parse(o.ts) >= Date.parse(sinceIso))) out.push(o);
            } catch {
                // A torn line is not a record.
            }
        }
    }
    return out;
}

/** Subagent transcripts (`agent-<agentId>.jsonl`) under `root`, keyed by the ledger's `refFor(agentId)`. */
export function readWorkerTranscripts(root: string): Map<string, WorkerTranscript> {
    const out = new Map<string, WorkerTranscript>();
    const stack = [root];
    while (stack.length > 0) {
        const dir = stack.pop()!;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) stack.push(full);
            const m = /^agent-(.+)\.jsonl$/.exec(e.name);
            if (!e.isFile() || m === null) continue;
            // Streamed records repeat one message id with growing usage; the last one is the call.
            const byId = new Map<string, { ts: string; context_tokens: number; input_tokens: number }>();
            const t: WorkerTranscript = { calls: [], compact_ts: [] };
            for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
                if (!line.trim()) continue;
                let o: Record<string, unknown>;
                try {
                    o = JSON.parse(line) as Record<string, unknown>;
                } catch {
                    continue;
                }
                const ts = typeof o['timestamp'] === 'string' ? o['timestamp'] : null;
                if (ts === null) continue;
                if (o['subtype'] === 'compact_boundary') t.compact_ts.push(ts);
                const msg = o['message'] as { id?: string; usage?: Record<string, number> } | undefined;
                if (o['type'] !== 'assistant' || !msg?.usage) continue;
                const u = msg.usage;
                const n = (k: string): number => (typeof u[k] === 'number' ? u[k] : 0);
                const input = n('input_tokens') + n('cache_read_input_tokens') + n('cache_creation_input_tokens');
                byId.set(msg.id ?? ts, { ts, context_tokens: input + n('output_tokens'), input_tokens: input });
            }
            t.calls = [...byId.values()].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
            out.set(refFor(m[1]!), t);
        }
    }
    return out;
}

/** `reuse:` and `model_tier:` from each `<dir>/<name>.md` frontmatter. */
export function readDefinitions(dir: string): Record<string, DefinitionFacts> {
    const out: Record<string, DefinitionFacts> = {};
    if (!fs.existsSync(dir)) return out;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.md'))) {
        const fm = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(path.join(dir, f), 'utf8'))?.[1] ?? '';
        const reuse = /^reuse:\s*(\S+)/m.exec(fm)?.[1];
        const tier = /^model_tier:\s*(\S+)/m.exec(fm)?.[1];
        out[f.replace(/\.md$/, '')] = {
            reuse: reuse === 'continuity' || reuse === 'never' ? reuse : null,
            tier: tier === 'lite' || tier === 'medium' || tier === 'high' ? tier : 'inherit',
        };
    }
    return out;
}

function readLedger(root: string): ShadowLine[] {
    const dir = path.join(root, LEDGER_DIR);
    if (!fs.existsSync(dir)) return [];
    const out: ShadowLine[] = [];
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort()) {
        for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
            if (!line.includes('spawn_guard_shadow')) continue;
            try {
                out.push(JSON.parse(line) as ShadowLine);
            } catch {
                // A torn line is not a record.
            }
        }
    }
    return out;
}

export interface ReconstructArgs {
    ledgerDirs: string[];
    transcriptRoots: string[];
    definitionsDir: string;
    since: string | null;
    /** Lines after this instant are ignored, so a re-run reads the window that was filed. */
    until?: string | null;
}

function parseReconstructArgs(argv: readonly string[]): ReconstructArgs | null {
    const a: ReconstructArgs = { ledgerDirs: [], transcriptRoots: [], definitionsDir: path.join(process.cwd(), 'src', 'subagents'), since: null };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        const v = argv[i + 1];
        if (v === undefined) continue;
        if (k === '--ledger-dir') a.ledgerDirs.push(v);
        else if (k === '--transcripts') a.transcriptRoots.push(v);
        else if (k === '--definitions') a.definitionsDir = v;
        else if (k === '--since') a.since = v;
        else if (k === '--until') a.until = v;
        else continue;
        i++;
    }
    return a.ledgerDirs.length > 0 ? a : null;
}

export function reconstructFromDisk(a: ReconstructArgs): Record<string, unknown> {
    // Read the whole ledger: a register cut by --since must be seen to be reported as unrecorded.
    const untilMs = a.until ? Date.parse(a.until) : null;
    const inWindowEnd = (ts: string): boolean => untilMs === null || Date.parse(ts) <= untilMs;
    const all = a.ledgerDirs.flatMap((d) => readLedgerLines(d)).filter((l) => inWindowEnd(l.ts));
    const sinceMs = a.since === null ? null : Date.parse(a.since);
    const lines = sinceMs === null ? all : all.filter((l) => Date.parse(l.ts) >= sinceMs);
    const transcripts = new Map<string, WorkerTranscript>();
    for (const r of a.transcriptRoots) for (const [k, v] of readWorkerTranscripts(r)) transcripts.set(k, v);
    const records = a.transcriptRoots.flatMap((r) => scanTranscripts({ root: r }).records);
    const starts = a.ledgerDirs.flatMap((d) => readLedgerStarts(d)).filter((s) => (sinceMs === null || Date.parse(s.ts) >= sinceMs) && inWindowEnd(s.ts));
    const runs = segmentLegsIntoRuns(records, starts).runs;
    const fresh = freshColdStartByType(runs, lines);
    const definitions = readDefinitions(a.definitionsDir);
    const base = { lines: all, transcripts, definitions, window_start: a.since };
    const spawns = reconstructSpawnVerdicts({ ...base, fresh_cold_start_by_type: fresh });
    const summary = summariseReconstruction(spawns);
    const likeForLike = likeForLikeColdStartByType(transcripts, lines);
    const secondarySpawns = reconstructSpawnVerdicts({ ...base, fresh_cold_start_by_type: likeForLike });
    return {
        basis: 'reconstructed',
        approximations: RECONSTRUCTION_APPROXIMATIONS,
        observed_fresh_cold_start_by_type: fresh,
        summary,
        flip: flipReadiness(summary.window, { false_positive_rate: null, cost_avoided: null, friction: null }),
        secondary_c_like_for_like: {
            label: SECONDARY_C_LIKE_FOR_LIKE_LABEL,
            condition_c: 'transcript_tokens < median first-call TOTAL input tokens (input + cache_creation + cache_read) of fresh runs of the definition',
            threshold_by_type: likeForLike,
            summary: summariseReconstruction(secondarySpawns),
            spawns: secondarySpawns,
        },
        spawns,
    };
}

function main(): number {
    const recon = parseReconstructArgs(process.argv.slice(2));
    if (recon !== null) {
        process.stdout.write(`${JSON.stringify(reconstructFromDisk(recon), null, 2)}\n`);
        return 0;
    }
    const root = process.argv[2] ?? process.cwd();
    const w = summariseShadowWindow(readLedger(root));
    const r = flipReadiness(w, { false_positive_rate: null, cost_avoided: null, friction: null });
    process.stdout.write(`${JSON.stringify({ window: w, flip: r }, null, 2)}\n`);
    return 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
    process.exit(main());
}
