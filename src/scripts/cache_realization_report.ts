#!/usr/bin/env node
/**
 * Cache-realization report — pre-registers and evaluates the five claims
 * (C-1..C-5) from `road-to-cache-economy.md` Phase 2.
 *
 * Metric definition (load-bearing, restated from `_lib/cc_transcript.ts`):
 *
 *     billable_input = input_tokens + cache_read_input_tokens
 *                       + cache_creation_input_tokens
 *
 * Anthropic's `usage.input_tokens` field EXCLUDES cache tokens — a cost or
 * volume figure built from `input_tokens` alone silently drops the
 * cache-read and cache-write legs. Every number in this report is built
 * from `billable_input`, never from `input_tokens` alone.
 *
 * Class A (per the ADR-124 no-runtime-boundary contract): in-process,
 * per-invocation, no socket, no daemon, no network, no writes outside a
 * stdout/JSON report. Reads local `~/.claude/projects/**\/*.jsonl`
 * transcripts (via `_lib/cc_transcript.ts` — reused, not reimplemented),
 * local rule directories, local council-response artefacts, and shells out
 * to `claude --version` and `git worktree list` (both read-only, no network).
 *
 * Usage:
 *   ./scripts-run src/scripts/cache_realization_report [--format text|json]
 *     [--root <path>] [--max-age-days <n>] [--repo-root <path>]
 *     [--council-root <path>] [--user-rules-dir <path>] [--project-rules-dir <path>]
 *
 * Defaults: `--root` is `~/.claude/projects` (the full tree, matching the
 * roadmap's own "First-party measurement" method — no per-project filter);
 * `--max-age-days 14` matches that measurement's stated window;
 * `--repo-root` / `--council-root` default to this file's own repo checkout.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildReport as buildDriftReport } from './orchestration_payload_hash_drift.js';
import type { PayloadHashDriftReport } from './_lib/payload_hash_drift.js';
import {
    aggregateByBucket,
    billableInputTokens,
    DEFAULT_PROJECTS_ROOT,
    projectStoreSlug,
    scanTranscripts,
    type BucketAggregate,
    type TranscriptBucket,
    type TranscriptRecord,
} from './_lib/cc_transcript.js';
import { censusDuplicateScope } from './_lib/duplicate_scope_census.js';
import { load_prices, reprice_with_cache } from './ai_council/pricing.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/cache_realization_report.ts → parents[1] is the repo root
// (mirrors the same 2-up resolution `cost_summary.ts` uses for a script at
// the same directory depth).
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const C1_COLD_START_DOMINANCE_THRESHOLD = 0.5;
const C2_DUPLICATE_SCOPE_THRESHOLD = 0.25;
const C4_COUNCIL_MISPRICING_THRESHOLD = 0.05;
const C5_CONFIRM_RATIO = 0.1;
const C5_FALSIFY_RATIO = 0.5;

const DRIFT_READ_SHARE_FLOOR = 0.9;
const DRIFT_COLD_START_SHARE_FLOOR = 0.5;

// ── generic stats helpers ──────────────────────────────────────────────

export function median(nums: readonly number[]): number {
    if (nums.length === 0) return 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2 : (sorted[mid] as number);
}

export function mean(nums: readonly number[]): number {
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ── cold-start analysis (subagent legs only — a "leg" is one agentId) ──

export interface ColdStartStats {
    /** Distinct subagent agentIds observed. */
    legs: number;
    median_first_call_written_or_uncached: number;
    mean_first_call_written_or_uncached: number;
    /** Σ(first-call cache_read) / Σ(first-call billable_input) across ALL legs — an aggregate share, not a per-leg median. */
    first_call_cache_read_share: number;
    /** Σ(first-call cache_creation_input_tokens) / Σ(all subagent cache_creation_input_tokens) — the C-1 metric. */
    cold_start_share_of_write_volume: number;
    /**
     * The write-share SIGNATURE across ALL subagent records (not just first
     * calls): how the billable input splits between cache writes, cache reads,
     * and uncached input.
     *
     * The three shares are over the same denominator and sum to 1 (up to
     * float error) whenever any billable input exists, which is what makes it
     * a signature rather than three unrelated ratios — a workload that is
     * mostly `write` is paying the cache premium without collecting the read
     * discount, and that is invisible in `cold_start_share_of_write_volume`,
     * which only says how much of the writing happened on a first call.
     *
     * All three are 0 when there is no billable input at all. That is the
     * empty-corpus reading, NOT "a perfectly uncached workload" — read it
     * beside `legs`.
     */
    write_share_of_billable: number;
    read_share_of_billable: number;
    uncached_share_of_billable: number;
}

/**
 * The first record per subagent leg (agentId), ordered by the ISO-8601
 * `timestamp` string (lexical order matches chronological order for that
 * format). Records with a missing/tied timestamp fall back to scan order
 * (the array's own push order), which is deterministic within one run.
 */
function firstCallsByLeg(records: readonly TranscriptRecord[]): TranscriptRecord[] {
    const byAgent = new Map<string, TranscriptRecord[]>();
    for (const r of records) {
        if (r.bucket !== 'subagent' || r.agentId === null) continue;
        const arr = byAgent.get(r.agentId) ?? [];
        arr.push(r);
        byAgent.set(r.agentId, arr);
    }
    const firstCalls: TranscriptRecord[] = [];
    for (const arr of byAgent.values()) {
        const sorted = arr
            .map((r, idx) => ({ r, idx }))
            .sort((a, b) => {
                const ta = a.r.timestamp;
                const tb = b.r.timestamp;
                if (ta !== null && tb !== null && ta !== tb) return ta < tb ? -1 : 1;
                if (ta !== null && tb === null) return -1;
                if (ta === null && tb !== null) return 1;
                return a.idx - b.idx;
            })
            .map((x) => x.r);
        firstCalls.push(sorted[0] as TranscriptRecord);
    }
    return firstCalls;
}

export function computeColdStarts(records: readonly TranscriptRecord[]): ColdStartStats {
    const subagentRecords = records.filter((r) => r.bucket === 'subagent');
    const totalWriteVolume = subagentRecords.reduce((s, r) => s + r.usage.cache_creation_input_tokens, 0);
    const firstCalls = firstCallsByLeg(records);

    const writtenOrUncached = firstCalls.map((r) => r.usage.cache_creation_input_tokens + r.usage.input_tokens);
    const sumFirstCallRead = firstCalls.reduce((s, r) => s + r.usage.cache_read_input_tokens, 0);
    const sumFirstCallBillable = firstCalls.reduce((s, r) => s + billableInputTokens(r.usage), 0);
    const sumFirstCallWrite = firstCalls.reduce((s, r) => s + r.usage.cache_creation_input_tokens, 0);

    // Signature over ALL subagent records — the shape of the workload, where
    // the metrics above describe only its first calls.
    const sumBillable = subagentRecords.reduce((s, r) => s + billableInputTokens(r.usage), 0);
    const sumWrite = totalWriteVolume;
    const sumRead = subagentRecords.reduce((s, r) => s + r.usage.cache_read_input_tokens, 0);
    const sumUncached = subagentRecords.reduce((s, r) => s + r.usage.input_tokens, 0);

    return {
        legs: firstCalls.length,
        median_first_call_written_or_uncached: median(writtenOrUncached),
        mean_first_call_written_or_uncached: mean(writtenOrUncached),
        first_call_cache_read_share: sumFirstCallBillable > 0 ? sumFirstCallRead / sumFirstCallBillable : 0,
        cold_start_share_of_write_volume: totalWriteVolume > 0 ? sumFirstCallWrite / totalWriteVolume : 0,
        write_share_of_billable: sumBillable > 0 ? sumWrite / sumBillable : 0,
        read_share_of_billable: sumBillable > 0 ? sumRead / sumBillable : 0,
        uncached_share_of_billable: sumBillable > 0 ? sumUncached / sumBillable : 0,
    };
}

// ── per-agentId breakdown ───────────────────────────────────────────────

export interface AgentAggregate extends BucketAggregate {
    agentId: string;
}

export function aggregateByAgent(records: readonly TranscriptRecord[]): AgentAggregate[] {
    const byAgent = new Map<string, TranscriptRecord[]>();
    for (const r of records) {
        if (r.bucket !== 'subagent' || r.agentId === null) continue;
        const arr = byAgent.get(r.agentId) ?? [];
        arr.push(r);
        byAgent.set(r.agentId, arr);
    }
    const out: AgentAggregate[] = [];
    for (const [agentId, recs] of byAgent) {
        // Every rec here is bucket==='subagent', so aggregateByBucket's
        // `.subagent` slot carries this agent's aggregate; `.main` stays
        // all-zero and is discarded. Reuses the shared aggregation math
        // instead of re-summing the six counters by hand.
        const agg = aggregateByBucket(recs).subagent;
        out.push({ ...agg, agentId });
    }
    return out;
}

// ── C-2: duplicate-scope byte census ────────────────────────────────────

export interface DuplicateScopeResult {
    evaluable: boolean;
    reason?: string | undefined;
    shared_filenames: number;
    duplicate_tokens_per_spawn: number;
    spawn_count: number;
    duplicate_token_estimate_total: number;
    share_of_subagent_write_volume: number;
}

/**
 * For every `.md` filename present in BOTH `userRulesDir` and
 * `projectRulesDir` — computed by the shared {@link censusDuplicateScope}
 * primitive, reused (not reimplemented) so this and the `doctor`
 * `duplicate-scope-rules` check can never disagree on what's shared — the
 * redundant copy's byte estimate is converted to tokens at chars/4 (the same
 * heuristic `pricing.ts#estimate_input_tokens` uses), then multiplied by
 * `spawnCount` (the observed subagent leg count over the same measurement
 * window) to get the total redundant-copy volume.
 */
export function computeDuplicateScope(
    userRulesDir: string,
    projectRulesDir: string,
    subagentWriteVolume: number,
    spawnCount: number,
): DuplicateScopeResult {
    const census = censusDuplicateScope(userRulesDir, projectRulesDir);
    if (!census.evaluable) {
        return {
            evaluable: false,
            reason: census.reason,
            shared_filenames: census.shared_filenames.length,
            duplicate_tokens_per_spawn: 0,
            spawn_count: spawnCount,
            duplicate_token_estimate_total: 0,
            share_of_subagent_write_volume: 0,
        };
    }

    const duplicateTokensPerSpawn = census.duplicate_chars / 4;
    const totalEstimate = duplicateTokensPerSpawn * spawnCount;
    const evaluable = spawnCount > 0 && subagentWriteVolume > 0;

    return {
        evaluable,
        reason: evaluable ? undefined : 'no subagent legs or no subagent write volume observed in the window',
        shared_filenames: census.shared_filenames.length,
        duplicate_tokens_per_spawn: duplicateTokensPerSpawn,
        spawn_count: spawnCount,
        duplicate_token_estimate_total: totalEstimate,
        share_of_subagent_write_volume: subagentWriteVolume > 0 ? totalEstimate / subagentWriteVolume : 0,
    };
}

// ── C-4: council mispricing ──────────────────────────────────────────────

export interface CouncilMispricingResult {
    status: 'confirmed' | 'falsified' | 'pending';
    reason?: string | undefined;
    session?: string;
    rounds?: number;
    recorded_cost_usd?: number;
    cache_aware_cost_usd?: number;
    delta_pct?: number;
}

interface RawCouncilResponse {
    provider?: unknown;
    model?: unknown;
    input_tokens?: unknown;
    output_tokens?: unknown;
    cache_read_input_tokens?: unknown;
    cache_creation_input_tokens?: unknown;
    error?: unknown;
}

interface RawDebateRound {
    debate_total_rounds?: unknown;
    cost_usd_actual?: unknown;
    responses?: RawCouncilResponse[];
}

function findDebateRoundFiles(councilRoot: string): string[] {
    const base = path.join(councilRoot, 'agents', 'runtime', 'council', 'responses');
    if (!fs.existsSync(base)) return [];
    const out: string[] = [];
    const stack: string[] = [base];
    while (stack.length > 0) {
        const dir = stack.pop() as string;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                stack.push(full);
                continue;
            }
            if (entry.isFile() && /^debate-round-\d+\.json$/.test(entry.name)) out.push(full);
        }
    }
    return out;
}

function numOrUndef(v: unknown): number | undefined {
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * Finds the best available real multi-round debate artefact under
 * `councilRoot/agents/runtime/council/responses/**\/debate-round-*.json`,
 * reprices its recorded usage with `reprice_with_cache` (ttl='5m' — the only
 * TTL the council's request builder currently emits, per
 * `orchestrator.ts`'s own comment), and reports the delta against the
 * originally recorded `cost_usd_actual` (the cache-blind figure the pre-fix
 * `estimate_cost` call site produced, or whatever else was live at record
 * time — the claim is about the DELTA cache-aware repricing produces, not
 * about which historical code path wrote the recorded number).
 *
 * "Best" = the group (one directory of sibling `debate-round-N.json` files)
 * with the LARGEST total cache-token volume (cache_read + cache_creation
 * across all responses), requiring ≥2 rounds (a real debate, not a one-shot
 * dispatch), non-error usage, and a non-zero recorded cost to divide by.
 * Cache-token volume — not round count — is the right selection key: a
 * 4-round debate with zero recorded cache activity can only ever show a 0%
 * delta (there is nothing for `reprice_with_cache` to reprice), which would
 * silently mask a real mispricing sitting in a session that actually used
 * the cache. Ties break on rounds, then total token volume.
 */
export function computeCouncilMispricing(councilRoot: string): CouncilMispricingResult {
    const files = findDebateRoundFiles(councilRoot);
    if (files.length === 0) {
        return {
            status: 'pending',
            reason: 'no agents/runtime/council/responses/**/debate-round-*.json artefact found under this root',
        };
    }

    const groups = new Map<string, string[]>();
    for (const f of files) {
        const dir = path.dirname(f);
        const arr = groups.get(dir) ?? [];
        arr.push(f);
        groups.set(dir, arr);
    }

    let table;
    try {
        table = load_prices();
    } catch {
        return { status: 'pending', reason: 'could not load the local price table (.agent-prices.md)' };
    }

    let best: { dir: string; rounds: number; recorded: number; cacheAware: number; tokens: number; cacheVolume: number } | null = null;
    for (const [dir, groupFiles] of groups) {
        let rounds = 0;
        let recorded = 0;
        let cacheAware = 0;
        let tokens = 0;
        let cacheVolume = 0;
        for (const f of groupFiles) {
            let data: RawDebateRound;
            try {
                data = JSON.parse(fs.readFileSync(f, 'utf-8')) as RawDebateRound;
            } catch {
                continue;
            }
            rounds = Math.max(rounds, numOrUndef(data.debate_total_rounds) ?? 0);
            recorded += numOrUndef(data.cost_usd_actual) ?? 0;
            for (const r of data.responses ?? []) {
                if (r.error) continue;
                const input = numOrUndef(r.input_tokens) ?? 0;
                const output = numOrUndef(r.output_tokens) ?? 0;
                const read = numOrUndef(r.cache_read_input_tokens) ?? 0;
                const write = numOrUndef(r.cache_creation_input_tokens) ?? 0;
                tokens += input + read + write;
                cacheVolume += read + write;
                if (typeof r.provider !== 'string' || typeof r.model !== 'string') continue;
                const est = reprice_with_cache(
                    r.provider,
                    r.model,
                    { input_tokens: input, cache_read_input_tokens: read, cache_creation_input_tokens: write, output_tokens: output },
                    table,
                    '5m',
                );
                cacheAware += est.input_usd + est.output_usd;
            }
        }
        if (rounds < 2 || tokens === 0 || recorded === 0) continue;
        if (
            best === null ||
            cacheVolume > best.cacheVolume ||
            (cacheVolume === best.cacheVolume && rounds > best.rounds) ||
            (cacheVolume === best.cacheVolume && rounds === best.rounds && tokens > best.tokens)
        ) {
            best = { dir, rounds, recorded, cacheAware, tokens, cacheVolume };
        }
    }

    if (best === null) {
        return {
            status: 'pending',
            reason: 'found debate-round artefacts, but none had ≥2 recorded rounds with non-error usage and a non-zero recorded cost',
        };
    }

    const deltaPct = (best.cacheAware - best.recorded) / best.recorded;
    const status: CouncilMispricingResult['status'] = Math.abs(deltaPct) >= C4_COUNCIL_MISPRICING_THRESHOLD ? 'confirmed' : 'falsified';
    return {
        status,
        session: path.relative(councilRoot, best.dir) || '(top-level)',
        rounds: best.rounds,
        recorded_cost_usd: best.recorded,
        cache_aware_cost_usd: best.cacheAware,
        delta_pct: deltaPct,
    };
}

// ── C-5: worktree fragmentation ──────────────────────────────────────────

export interface WorktreeFragmentationResult {
    status: 'confirmed' | 'falsified' | 'pending';
    reason?: string | undefined;
    established_project_dir?: string;
    worktree_project_dirs?: string[];
    established_first_call_read_share?: number;
    worktree_first_call_read_share?: number;
    /** worktree_first_call_read_share / established_first_call_read_share. */
    ratio?: number;
}

/** The CC project-dir naming convention — see `_lib/cc_transcript.projectStoreSlug`. */
export function encodeProjectPath(cwd: string): string {
    return projectStoreSlug(cwd);
}

/**
 * `git worktree list --porcelain`'s first entry is always the main/original
 * working tree; every subsequent entry is a linked worktree of the same
 * repo. Returns `[]` (never throws) when `git` is unavailable or `cwd` is
 * not a git checkout — the caller treats that as "not evaluable".
 */
export function listGitWorktrees(cwd: string): string[] {
    try {
        const out = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd, encoding: 'utf-8', timeout: 10_000 });
        const paths: string[] = [];
        for (const line of out.split('\n')) {
            if (line.startsWith('worktree ')) paths.push(line.slice('worktree '.length).trim());
        }
        return paths;
    } catch {
        return [];
    }
}

/**
 * Compares the first-call `cache_read` share (see {@link computeColdStarts})
 * between the repo's established (main) worktree and the pooled set of its
 * linked worktrees, both scanned over the same `maxAgeDays` window used for
 * the rest of the report. `worktreePaths` is injected (never calls `git`
 * itself) so this stays a pure, easily-fixtured function — the CLI wrapper
 * supplies the real list via {@link listGitWorktrees}.
 */
export function computeWorktreeFragmentation(
    projectsRoot: string,
    worktreePaths: readonly string[],
    maxAgeDays: number,
): WorktreeFragmentationResult {
    if (worktreePaths.length < 2) {
        return { status: 'pending', reason: 'fewer than 2 git worktrees found for this repo — nothing to compare' };
    }

    const established = worktreePaths[0] as string; // git always lists the main worktree first
    const encodedEstablished = encodeProjectPath(established);
    const worktreeDirs = worktreePaths
        .slice(1)
        .map(encodeProjectPath)
        .filter((d) => fs.existsSync(path.join(projectsRoot, d)));

    if (!fs.existsSync(path.join(projectsRoot, encodedEstablished)) || worktreeDirs.length === 0) {
        return {
            status: 'pending',
            reason: 'no transcript directory found for both an established and a fresh-worktree checkout of this repo',
        };
    }

    const establishedScan = scanTranscripts({ root: projectsRoot, projectDir: encodedEstablished, maxAgeDays });
    const establishedColdStart = computeColdStarts(establishedScan.records);

    let worktreeRecords: TranscriptRecord[] = [];
    for (const d of worktreeDirs) {
        worktreeRecords = worktreeRecords.concat(scanTranscripts({ root: projectsRoot, projectDir: d, maxAgeDays }).records);
    }
    const worktreeColdStart = computeColdStarts(worktreeRecords);

    if (establishedColdStart.legs === 0 || worktreeColdStart.legs === 0) {
        return {
            status: 'pending',
            reason: `insufficient subagent legs in the ${maxAgeDays}-day window (established: ${establishedColdStart.legs}, worktrees: ${worktreeColdStart.legs})`,
            established_project_dir: encodedEstablished,
            worktree_project_dirs: worktreeDirs,
        };
    }

    const establishedShare = establishedColdStart.first_call_cache_read_share;
    const worktreeShare = worktreeColdStart.first_call_cache_read_share;
    const ratio = establishedShare > 0 ? worktreeShare / establishedShare : worktreeShare === 0 ? 0 : Number.POSITIVE_INFINITY;

    if (!Number.isFinite(ratio)) {
        return {
            status: 'pending',
            reason: 'established directory shows a zero first-call cache-read share — the comparison ratio is undefined',
            established_project_dir: encodedEstablished,
            worktree_project_dirs: worktreeDirs,
            established_first_call_read_share: establishedShare,
            worktree_first_call_read_share: worktreeShare,
        };
    }

    let status: WorktreeFragmentationResult['status'];
    let reason: string | undefined;
    if (ratio >= C5_FALSIFY_RATIO) {
        status = 'falsified';
    } else if (ratio < C5_CONFIRM_RATIO) {
        status = 'confirmed';
    } else {
        status = 'pending';
        reason = `ratio ${(ratio * 100).toFixed(1)}% falls between the confirm (<10%) and falsify (>=50%) thresholds`;
    }

    return {
        status,
        reason,
        established_project_dir: encodedEstablished,
        worktree_project_dirs: worktreeDirs,
        established_first_call_read_share: establishedShare,
        worktree_first_call_read_share: worktreeShare,
        ratio,
    };
}

// ── host version ─────────────────────────────────────────────────────────

/** Shells out to `claude --version`; `unknown` (never fabricated) on any failure. */
export function hostVersion(): string {
    try {
        const out = execFileSync('claude', ['--version'], { encoding: 'utf-8', timeout: 5_000 }).trim();
        return out.length > 0 ? out : 'unknown';
    } catch {
        return 'unknown';
    }
}

// ── claims ────────────────────────────────────────────────────────────────

export interface Claim {
    id: 'C-1' | 'C-2' | 'C-3' | 'C-4' | 'C-5';
    description: string;
    threshold: string;
    verdict: 'confirmed' | 'falsified' | 'pending';
    measured?: number | undefined;
    reason?: string | undefined;
}

export function buildClaims(opts: {
    subagentColdStart: ColdStartStats;
    duplicateScope: DuplicateScopeResult;
    councilMispricing: CouncilMispricingResult;
    worktreeFragmentation: WorktreeFragmentationResult;
}): Claim[] {
    const claims: Claim[] = [];

    const c1Value = opts.subagentColdStart.cold_start_share_of_write_volume;
    claims.push({
        id: 'C-1',
        description: 'cold-start dominance: cold starts are ≥50% of subagent write volume (baseline 69.4%)',
        threshold: '>= 0.50',
        verdict: opts.subagentColdStart.legs === 0 ? 'pending' : c1Value >= C1_COLD_START_DOMINANCE_THRESHOLD ? 'confirmed' : 'falsified',
        measured: opts.subagentColdStart.legs === 0 ? undefined : c1Value,
        reason: opts.subagentColdStart.legs === 0 ? 'no subagent legs observed in the window' : undefined,
    });

    const d = opts.duplicateScope;
    claims.push({
        id: 'C-2',
        description: 'duplicate-scope share: the redundant rule-set copy is ≥25% of subagent write volume (baseline ≈37%)',
        threshold: '>= 0.25',
        verdict: !d.evaluable ? 'pending' : d.share_of_subagent_write_volume >= C2_DUPLICATE_SCOPE_THRESHOLD ? 'confirmed' : 'falsified',
        measured: d.evaluable ? d.share_of_subagent_write_volume : undefined,
        reason: !d.evaluable ? d.reason : undefined,
    });

    claims.push({
        id: 'C-3',
        description: 'preamble reducibility: a shipped reduction moves median cold-start tokens by ≥15% with no eval regression',
        threshold: '>= 0.15',
        verdict: 'pending',
        reason: 'requires an implemented preamble-reduction intervention (Phase 3) — none has landed yet',
    });

    const c = opts.councilMispricing;
    claims.push({
        id: 'C-4',
        description: 'council mispricing magnitude: cache-aware repricing changes a real multi-round debate’s realized cost by ≥5%',
        threshold: '>= 0.05 (absolute delta)',
        verdict: c.status,
        measured: c.delta_pct,
        reason: c.reason,
    });

    const w = opts.worktreeFragmentation;
    claims.push({
        id: 'C-5',
        description: "worktree fragmentation: a fresh worktree's first-call cache_read share is <10% of an established directory's (falsified at >=50%)",
        threshold: '< 0.10 confirmed / >= 0.50 falsified',
        verdict: w.status,
        measured: w.ratio,
        reason: w.reason,
    });

    return claims;
}

// ── CLI ───────────────────────────────────────────────────────────────────

export interface Options {
    format: 'text' | 'json';
    root: string;
    maxAgeDays: number;
    repoRoot: string;
    councilRoot: string;
    userRulesDir: string;
    projectRulesDir: string;
    auditDir: string;
}

function defaultOptions(): Options {
    return {
        format: 'text',
        root: DEFAULT_PROJECTS_ROOT,
        maxAgeDays: 14,
        repoRoot: REPO_ROOT,
        councilRoot: REPO_ROOT,
        userRulesDir: path.join(homedir(), '.claude', 'rules'),
        projectRulesDir: path.join(REPO_ROOT, 'dist', 'agent-src', 'rules'),
        auditDir: path.join(REPO_ROOT, 'agents', 'runtime', 'state', 'audit'),
    };
}

export function parseArgs(argv: string[]): Options {
    const opts = defaultOptions();
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === undefined) continue;
        if (a === '--format') opts.format = (argv[++i] as Options['format']) ?? opts.format;
        else if (a.startsWith('--format=')) opts.format = a.slice('--format='.length) as Options['format'];
        else if (a === '--root') opts.root = argv[++i] ?? opts.root;
        else if (a.startsWith('--root=')) opts.root = a.slice('--root='.length);
        else if (a === '--max-age-days') opts.maxAgeDays = Number(argv[++i]) || opts.maxAgeDays;
        else if (a.startsWith('--max-age-days=')) opts.maxAgeDays = Number(a.slice('--max-age-days='.length)) || opts.maxAgeDays;
        else if (a === '--repo-root') opts.repoRoot = argv[++i] ?? opts.repoRoot;
        else if (a.startsWith('--repo-root=')) opts.repoRoot = a.slice('--repo-root='.length);
        else if (a === '--council-root') opts.councilRoot = argv[++i] ?? opts.councilRoot;
        else if (a.startsWith('--council-root=')) opts.councilRoot = a.slice('--council-root='.length);
        else if (a === '--user-rules-dir') opts.userRulesDir = argv[++i] ?? opts.userRulesDir;
        else if (a.startsWith('--user-rules-dir=')) opts.userRulesDir = a.slice('--user-rules-dir='.length);
        else if (a === '--project-rules-dir') opts.projectRulesDir = argv[++i] ?? opts.projectRulesDir;
        else if (a.startsWith('--project-rules-dir=')) opts.projectRulesDir = a.slice('--project-rules-dir='.length);
        else if (a === '--audit-dir') opts.auditDir = argv[++i] ?? opts.auditDir;
        else if (a.startsWith('--audit-dir=')) opts.auditDir = a.slice('--audit-dir='.length);
    }
    if (opts.format !== 'text' && opts.format !== 'json') opts.format = 'text';
    return opts;
}

/**
 * Prefix-stability verdict, carried in the cost report rather than left latent
 * in a separate CLI (`road-to-runtime-context-floors` step 1.3).
 *
 * `_lib/payload_hash_drift` already splits dispatches into a STABLE cohort
 * (repeat occurrences of one payload hash) and an UNSTABLE one (hashes seen
 * once). Nothing read the split, so the one outcome that matters — a stable
 * cohort whose cache-read share is BELOW its unstable cohort, which means the
 * prefix is being rewritten between repeats — was measurable and unreported.
 *
 * `verdict` is deliberately three-valued. `insufficient-data` is not a number
 * and must never be rendered as one: with either cohort empty there is no
 * comparison to make, and printing `0.0%` for "nothing was measured" is the
 * shape that turns a blind report into a believed one.
 */
export type PrefixStabilityVerdict = 'stable-higher' | 'inverted' | 'insufficient-data';

export interface PrefixStabilityResult {
    verdict: PrefixStabilityVerdict;
    /** Why, in one sentence — always populated, including for `insufficient-data`. */
    reason: string;
    stable_cohort: { n: number; read_share: number | null };
    unstable_cohort: { n: number; read_share: number | null };
    lines_with_data: number;
}

export function computePrefixStability(drift: PayloadHashDriftReport): PrefixStabilityResult {
    const stable = { n: drift.stable_cohort.n, read_share: drift.stable_cohort.hit_rate };
    const unstable = { n: drift.unstable_cohort.n, read_share: drift.unstable_cohort.hit_rate };

    if (stable.read_share === null || unstable.read_share === null) {
        const empty = [stable.read_share === null ? 'stable' : null, unstable.read_share === null ? 'unstable' : null]
            .filter((x) => x !== null)
            .join(' and ');
        const plural = empty.includes(' and ') ? 'cohorts are' : 'cohort is';
        return {
            verdict: 'insufficient-data',
            reason:
                `the ${empty} ${plural} empty (${drift.lines_with_data} audit line(s) carry both ` +
                'payload_hash and cache_hit) — no comparison exists, and a share is not reported for one',
            stable_cohort: stable,
            unstable_cohort: unstable,
            lines_with_data: drift.lines_with_data,
        };
    }
    if (stable.read_share < unstable.read_share) {
        return {
            verdict: 'inverted',
            reason:
                `repeat dispatches of the same payload shape hit the cache LESS often ` +
                `(${(stable.read_share * 100).toFixed(1)}%) than one-off shapes ` +
                `(${(unstable.read_share * 100).toFixed(1)}%) — a prefix-stable surface is being ` +
                'rewritten between repeats',
            stable_cohort: stable,
            unstable_cohort: unstable,
            lines_with_data: drift.lines_with_data,
        };
    }
    return {
        verdict: 'stable-higher',
        reason:
            `repeat dispatches hit the cache at ${(stable.read_share * 100).toFixed(1)}% against ` +
            `${(unstable.read_share * 100).toFixed(1)}% for one-off shapes, which is the expected ordering`,
        stable_cohort: stable,
        unstable_cohort: unstable,
        lines_with_data: drift.lines_with_data,
    };
}

export interface Report {
    schema: 'cache-realization-report/v1';
    host_version: string;
    window_days: number;
    root: string;
    metric_definition: { billable_input: string; note: string };
    dedup_ratio: number;
    total_seen: number;
    deduped_count: number;
    buckets: Record<TranscriptBucket, BucketAggregate>;
    subagent_cold_start: ColdStartStats;
    by_agent: AgentAggregate[];
    duplicate_scope: DuplicateScopeResult;
    council_mispricing: CouncilMispricingResult;
    worktree_fragmentation: WorktreeFragmentationResult;
    prefix_stability: PrefixStabilityResult;
    claims: Claim[];
}

export function buildReport(opts: Options): Report {
    const scan = scanTranscripts({ root: opts.root, maxAgeDays: opts.maxAgeDays });
    const buckets = aggregateByBucket(scan.records);
    const subagentColdStart = computeColdStarts(scan.records);
    const byAgent = aggregateByAgent(scan.records);

    const duplicateScope = computeDuplicateScope(
        opts.userRulesDir,
        opts.projectRulesDir,
        buckets.subagent.cache_creation_input_tokens,
        subagentColdStart.legs,
    );

    const councilMispricing = computeCouncilMispricing(opts.councilRoot);

    const worktreePaths = listGitWorktrees(opts.repoRoot);
    const worktreeFragmentation = computeWorktreeFragmentation(opts.root, worktreePaths, opts.maxAgeDays);

    // A missing or unreadable audit directory is a real, expected state — the
    // two fields are lean-init extensions and no caller wires them yet — so it
    // resolves to `insufficient-data` with a reason, never to a fabricated share.
    let prefixStability: PrefixStabilityResult;
    try {
        prefixStability = computePrefixStability(buildDriftReport(opts.auditDir));
    } catch (err) {
        prefixStability = {
            verdict: 'insufficient-data',
            reason: `the audit ledger at ${opts.auditDir} could not be read: ${(err as Error).message}`,
            stable_cohort: { n: 0, read_share: null },
            unstable_cohort: { n: 0, read_share: null },
            lines_with_data: 0,
        };
    }

    const claims = buildClaims({ subagentColdStart, duplicateScope, councilMispricing, worktreeFragmentation });

    return {
        schema: 'cache-realization-report/v1',
        host_version: hostVersion(),
        window_days: opts.maxAgeDays,
        root: opts.root,
        metric_definition: {
            billable_input: 'input_tokens + cache_read_input_tokens + cache_creation_input_tokens',
            note: "Anthropic's usage.input_tokens EXCLUDES cache tokens — it is only the uncached portion of the prompt.",
        },
        dedup_ratio: scan.dedup_ratio,
        total_seen: scan.totalSeen,
        deduped_count: scan.dedupedCount,
        buckets,
        subagent_cold_start: subagentColdStart,
        by_agent: byAgent,
        duplicate_scope: duplicateScope,
        council_mispricing: councilMispricing,
        worktree_fragmentation: worktreeFragmentation,
        prefix_stability: prefixStability,
        claims,
    };
}

function pct(v: number): string {
    return `${(v * 100).toFixed(1)}%`;
}

export function renderText(r: Report): string {
    const out: string[] = [];
    out.push('Cache-realization report');
    out.push(`  host_version: ${r.host_version}`);
    out.push(`  window: last ${r.window_days} days`);
    out.push(`  root: ${r.root}`);
    out.push(`  metric: billable_input = ${r.metric_definition.billable_input}`);
    out.push(`          ${r.metric_definition.note}`);
    out.push(`  dedup: ${r.deduped_count}/${r.total_seen} unique records kept (dedup_ratio ${pct(r.dedup_ratio)})`);
    out.push('');

    const ps = r.prefix_stability;
    const share = (v: number | null): string => (v === null ? 'insufficient data' : pct(v));
    const mark = ps.verdict === 'inverted' ? '⚠️ ' : '';
    out.push('Prefix stability (payload_hash × cache_hit):');
    out.push(`  ${mark}verdict: ${ps.verdict}`);
    out.push(`  stable cohort:   n=${ps.stable_cohort.n} read_share=${share(ps.stable_cohort.read_share)}`);
    out.push(`  unstable cohort: n=${ps.unstable_cohort.n} read_share=${share(ps.unstable_cohort.read_share)}`);
    out.push(`  ${ps.reason}`);
    out.push('');

    out.push('By bucket:');
    for (const bucket of ['main', 'subagent'] as const) {
        const b = r.buckets[bucket];
        out.push(`  ${bucket}: calls=${b.calls} read_share=${pct(b.read_share)} weighted_input_units=${Math.round(b.weighted_input_units)}`);
        out.push(
            `    input=${b.input_tokens} cache_read=${b.cache_read_input_tokens} cache_creation=${b.cache_creation_input_tokens}` +
                ` (5m=${b.ephemeral_5m_input_tokens} 1h=${b.ephemeral_1h_input_tokens}) output=${b.output_tokens}`,
        );
    }
    out.push('');

    const cs = r.subagent_cold_start;
    out.push('Subagent cold start (first call per leg):');
    out.push(
        `  legs=${cs.legs} median_written_or_uncached=${Math.round(cs.median_first_call_written_or_uncached)}` +
            ` mean=${Math.round(cs.mean_first_call_written_or_uncached)}`,
    );
    out.push(`  first_call_cache_read_share=${pct(cs.first_call_cache_read_share)}`);
    out.push(`  cold_start_share_of_subagent_write_volume=${pct(cs.cold_start_share_of_write_volume)}`);
    // Write-share signature over ALL subagent records: the three shares sum to
    // 100% and say where the billable input actually went. A write-heavy split
    // is paying the cache premium without collecting the read discount — which
    // the cold-start metrics above cannot show, since they only look at first
    // calls. All-zero means no billable input at all; read it beside legs.
    out.push(
        `  write_share=${pct(cs.write_share_of_billable)} read_share=${pct(cs.read_share_of_billable)}` +
            ` uncached_share=${pct(cs.uncached_share_of_billable)} (of billable input, all subagent records)`,
    );
    out.push('');

    out.push(`Per-agent breakdown: ${r.by_agent.length} distinct subagent legs (--format json carries all; top 10 by weighted_input_units below)`);
    const top10 = [...r.by_agent].sort((a, b) => b.weighted_input_units - a.weighted_input_units).slice(0, 10);
    for (const a of top10) {
        out.push(`  ${a.agentId}: calls=${a.calls} read_share=${pct(a.read_share)} weighted_input_units=${Math.round(a.weighted_input_units)}`);
    }
    out.push('');

    out.push('Pre-registered claims:');
    for (const c of r.claims) {
        const measured = c.measured !== undefined ? ` (measured ${pct(c.measured)})` : '';
        const reasonSuffix = c.verdict === 'pending' && c.reason ? ` — ${c.reason}` : '';
        out.push(`  ${c.id} [${c.verdict}]${measured}: ${c.description}${reasonSuffix}`);
    }
    out.push('');

    out.push('Re-verification:');
    out.push('  command: ./scripts-run src/scripts/cache_realization_report --format text');
    out.push(`  host_version at this run: ${r.host_version}`);
    out.push(
        `  re-run + restamp this report if: read_share drops below ${pct(DRIFT_READ_SHARE_FLOOR)}, OR` +
            ` cold-start share drops below ${pct(DRIFT_COLD_START_SHARE_FLOOR)}`,
    );

    return out.join('\n');
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const opts = parseArgs(argv);
    const report = buildReport(opts);
    if (opts.format === 'json') {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
        process.stdout.write(renderText(report) + '\n');
    }
    return 0;
}

if (process.argv[1] !== undefined) {
    const invokedUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === invokedUrl) process.exit(main());
}
