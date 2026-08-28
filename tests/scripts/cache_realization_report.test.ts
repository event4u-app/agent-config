// Unit tests for the cache-realization report
// (`src/scripts/cache_realization_report.ts`) — the C-1..C-5 pre-registered
// claims from `road-to-cache-economy.md` Phase 2.
//
// Style follows `tests/scripts/ai_council/pricing.test.ts`: pure functions
// imported and called directly (no CLI shell-out), fixtures built from named
// constants, and every expectation derived by re-computing from those
// constants (via the same lower-level primitives already covered by
// `cc_transcript.test.ts` / `pricing.test.ts`) — never copied from a real run.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { TokenCounts, TranscriptRecord } from '../../src/scripts/_lib/cc_transcript.js';
import { billableInputTokens } from '../../src/scripts/_lib/cc_transcript.js';
import { estimate_cost, load_prices, reprice_with_cache } from '../../src/scripts/ai_council/pricing.js';
import {
    aggregateByAgent,
    buildClaims,
    buildReport,
    computeColdStarts,
    computeCouncilMispricing,
    computeDuplicateScope,
    computePrefixStability,
    computeWorktreeFragmentation,
    encodeProjectPath,
    mean,
    median,
    parseArgs,
    renderText,
    type Report,
} from '../../src/scripts/cache_realization_report.js';

/** A minimally-populated report, so a renderer test asserts on ONE section. */
function baseReport(): Report {
    const emptyBucket = {
        calls: 0,
        input_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        ephemeral_5m_input_tokens: 0,
        ephemeral_1h_input_tokens: 0,
        output_tokens: 0,
        read_share: 0,
        weighted_input_units: 0,
    };
    return {
        schema: 'cache-realization-report/v1',
        host_version: 'test',
        window_days: 14,
        root: '/dev/null',
        metric_definition: { billable_input: 'x', note: 'y' },
        dedup_ratio: 1,
        total_seen: 0,
        deduped_count: 0,
        buckets: {
            main: { ...emptyBucket, bucket: 'main' as const },
            subagent: { ...emptyBucket, bucket: 'subagent' as const },
        },
        subagent_cold_start: computeColdStarts([]),
        by_agent: [],
        duplicate_scope: {
            duplicated_rule_names: [],
            duplicated_bytes: 0,
            duplicated_tokens: 0,
            subagent_cache_creation_tokens: 0,
            share_of_subagent_cache_creation: 0,
            cold_start_legs: 0,
        } as unknown as Report['duplicate_scope'],
        council_mispricing: {} as unknown as Report['council_mispricing'],
        worktree_fragmentation: {} as unknown as Report['worktree_fragmentation'],
        prefix_stability: computePrefixStability({
            total_lines: 0,
            lines_with_data: 0,
            groups: [],
            stable_cohort: { n: 0, hit_count: 0, hit_rate: null },
            unstable_cohort: { n: 0, hit_count: 0, hit_rate: null },
            drift_visible: false,
        }),
        claims: [],
    };
}

const _tmpDirs: string[] = [];

function mkTmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    _tmpDirs.push(d);
    return d;
}

afterEach(() => {
    while (_tmpDirs.length > 0) {
        const d = _tmpDirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

function usage(over: Partial<TokenCounts>): TokenCounts {
    return {
        input_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
        ephemeral_5m_input_tokens: 0,
        ephemeral_1h_input_tokens: 0,
        ...over,
    };
}

function rec(agentId: string, timestamp: string, u: Partial<TokenCounts>): TranscriptRecord {
    return { bucket: 'subagent', agentId, model: 'claude-sonnet-4-5', timestamp, usage: usage(u) };
}

// ── median / mean ────────────────────────────────────────────────────────

describe('median / mean', () => {
    it('median of an odd-length array is the middle value; even-length averages the two middles', () => {
        expect(median([3, 1, 2])).toBe(2);
        expect(median([4, 1, 3, 2])).toBe(2.5);
        expect(median([])).toBe(0);
    });

    it('mean is the arithmetic average; empty array is 0', () => {
        expect(mean([1, 2, 3, 4])).toBe(2.5);
        expect(mean([])).toBe(0);
    });
});

// ── computeColdStarts ────────────────────────────────────────────────────

describe('computeColdStarts', () => {
    // Leg A: cold first call (cache_creation only), warm second call (cache_read only).
    const A1 = { input: 1000, cache_creation: 5000 };
    const A2 = { input: 200, cache_read: 5000 };
    // Leg B: same shape, different numbers.
    const B1 = { input: 800, cache_creation: 3000 };
    const B2 = { input: 50, cache_read: 3000 };

    it('picks the chronologically-first record per leg, medians/means the (cache_creation + input) first-call value, and shares are aggregate sums', () => {
        const records: TranscriptRecord[] = [
            rec('agent-A', '2026-07-30T10:00:00.000Z', { input_tokens: A1.input, cache_creation_input_tokens: A1.cache_creation }),
            rec('agent-A', '2026-07-30T10:01:00.000Z', { input_tokens: A2.input, cache_read_input_tokens: A2.cache_read }),
            rec('agent-B', '2026-07-30T10:00:00.000Z', { input_tokens: B1.input, cache_creation_input_tokens: B1.cache_creation }),
            rec('agent-B', '2026-07-30T10:01:00.000Z', { input_tokens: B2.input, cache_read_input_tokens: B2.cache_read }),
        ];

        const stats = computeColdStarts(records);

        const writtenOrUncached = [A1.cache_creation + A1.input, B1.cache_creation + B1.input]; // [6000, 3800]
        const expectedMedian = median(writtenOrUncached);
        const expectedMean = mean(writtenOrUncached);
        const expectedFirstCallBillable = A1.input + A1.cache_creation + (B1.input + B1.cache_creation); // no read on first calls
        const expectedWriteVolume = A1.cache_creation + B1.cache_creation; // total subagent cache_creation across ALL records
        const expectedFirstCallWrite = A1.cache_creation + B1.cache_creation; // same here — writes only happen on first calls in this fixture

        expect(stats.legs).toBe(2);
        expect(stats.median_first_call_written_or_uncached).toBeCloseTo(expectedMedian, 12);
        expect(stats.mean_first_call_written_or_uncached).toBeCloseTo(expectedMean, 12);
        expect(stats.first_call_cache_read_share).toBeCloseTo(0 / expectedFirstCallBillable, 12); // both first calls read 0
        expect(stats.cold_start_share_of_write_volume).toBeCloseTo(expectedFirstCallWrite / expectedWriteVolume, 12);
    });

    it('orders by the timestamp string, not by array/push order', () => {
        const C_early = { input: 10, cache_creation: 111 };
        const C_late = { input: 999, cache_creation: 9999 };
        // C_late is pushed BEFORE C_early — the sort must still pick C_early (earlier timestamp) as the first call.
        const records: TranscriptRecord[] = [
            rec('agent-C', '2026-07-30T12:00:00.000Z', { input_tokens: C_late.input, cache_creation_input_tokens: C_late.cache_creation }),
            rec('agent-C', '2026-07-30T09:00:00.000Z', { input_tokens: C_early.input, cache_creation_input_tokens: C_early.cache_creation }),
        ];

        const stats = computeColdStarts(records);

        expect(stats.legs).toBe(1);
        expect(stats.median_first_call_written_or_uncached).toBeCloseTo(C_early.cache_creation + C_early.input, 12);
    });

    it('non-subagent (main) records are never grouped into legs', () => {
        const records: TranscriptRecord[] = [{ bucket: 'main', agentId: null, model: 'claude-sonnet-4-5', timestamp: '2026-07-30T10:00:00.000Z', usage: usage({ input_tokens: 500 }) }];
        const stats = computeColdStarts(records);
        expect(stats.legs).toBe(0);
        expect(stats.cold_start_share_of_write_volume).toBe(0); // zero-write-volume guard, never NaN
        expect(stats.first_call_cache_read_share).toBe(0);
    });
});

// ── aggregateByAgent ─────────────────────────────────────────────────────

describe('aggregateByAgent', () => {
    it('produces one entry per agentId with read_share/weighted_input_units derived from the raw fields', () => {
        const records: TranscriptRecord[] = [
            rec('agent-A', '2026-07-30T10:00:00.000Z', { input_tokens: 1000, cache_read_input_tokens: 200 }),
            rec('agent-A', '2026-07-30T10:01:00.000Z', { input_tokens: 100, cache_read_input_tokens: 50 }),
            rec('agent-B', '2026-07-30T10:00:00.000Z', { input_tokens: 400, cache_creation_input_tokens: 300, ephemeral_5m_input_tokens: 300 }),
        ];
        const byAgent = aggregateByAgent(records);
        expect(byAgent).toHaveLength(2);

        const a = byAgent.find((x) => x.agentId === 'agent-A')!;
        const aInput = 1000 + 100;
        const aRead = 200 + 50;
        const aBillable = billableInputTokens(a);
        expect(a.calls).toBe(2);
        expect(a.input_tokens).toBe(aInput);
        expect(a.cache_read_input_tokens).toBe(aRead);
        expect(a.read_share).toBeCloseTo(aRead / aBillable, 12);
        expect(a.weighted_input_units).toBeCloseTo(aInput * 1.0 + aRead * 0.1, 12);

        const b = byAgent.find((x) => x.agentId === 'agent-B')!;
        expect(b.calls).toBe(1);
        expect(b.weighted_input_units).toBeCloseTo(400 * 1.0 + 300 * 1.25, 12);
    });
});

// ── computeDuplicateScope (C-2) ──────────────────────────────────────────

describe('computeDuplicateScope', () => {
    it('sums the smaller of each shared filename’s byte size, converts to tokens at chars/4, and shares against subagent write volume', () => {
        const userDir = mkTmp('user-rules-');
        const projectDir = mkTmp('project-rules-');
        const aUser = 'x'.repeat(100);
        const aProject = 'x'.repeat(120); // larger — the user copy is the smaller/"redundant" one counted
        const bBoth = 'x'.repeat(50);
        fs.writeFileSync(path.join(userDir, 'a.md'), aUser);
        fs.writeFileSync(path.join(userDir, 'b.md'), bBoth);
        fs.writeFileSync(path.join(userDir, 'only-user.md'), 'y'.repeat(30));
        fs.writeFileSync(path.join(projectDir, 'a.md'), aProject);
        fs.writeFileSync(path.join(projectDir, 'b.md'), bBoth);
        fs.writeFileSync(path.join(projectDir, 'only-project.md'), 'z'.repeat(10));

        const spawnCount = 10;
        const subagentWriteVolume = 1000;
        const result = computeDuplicateScope(userDir, projectDir, subagentWriteVolume, spawnCount);

        const expectedDuplicateChars = Math.min(aUser.length, aProject.length) + Math.min(bBoth.length, bBoth.length);
        const expectedTokensPerSpawn = expectedDuplicateChars / 4;
        const expectedTotal = expectedTokensPerSpawn * spawnCount;

        expect(result.evaluable).toBe(true);
        expect(result.shared_filenames).toBe(2);
        expect(result.duplicate_tokens_per_spawn).toBeCloseTo(expectedTokensPerSpawn, 12);
        expect(result.duplicate_token_estimate_total).toBeCloseTo(expectedTotal, 12);
        expect(result.share_of_subagent_write_volume).toBeCloseTo(expectedTotal / subagentWriteVolume, 12);
    });

    it('is not evaluable when one of the rule directories is missing', () => {
        const userDir = mkTmp('user-rules-');
        const result = computeDuplicateScope(userDir, path.join(userDir, 'does-not-exist'), 1000, 10);
        expect(result.evaluable).toBe(false);
        expect(result.reason).toMatch(/missing/);
    });

    it('is not evaluable when no filename is shared between the two scopes', () => {
        const userDir = mkTmp('user-rules-');
        const projectDir = mkTmp('project-rules-');
        fs.writeFileSync(path.join(userDir, 'only-user.md'), 'a');
        fs.writeFileSync(path.join(projectDir, 'only-project.md'), 'b');
        const result = computeDuplicateScope(userDir, projectDir, 1000, 10);
        expect(result.evaluable).toBe(false);
        expect(result.shared_filenames).toBe(0);
        expect(result.reason).toMatch(/no shared/);
    });
});

// ── computeCouncilMispricing (C-4) ───────────────────────────────────────

function writeDebateRound(dir: string, filename: string, body: unknown): void {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), JSON.stringify(body));
}

describe('computeCouncilMispricing', () => {
    it('pending when no debate-round artefact exists under the root', () => {
        const root = mkTmp('council-root-');
        const result = computeCouncilMispricing(root);
        expect(result.status).toBe('pending');
        expect(result.reason).toMatch(/no agents\/runtime\/council/);
    });

    it('pending when the only session has fewer than 2 recorded rounds', () => {
        const root = mkTmp('council-root-');
        const sessionDir = path.join(root, 'agents', 'runtime', 'council', 'responses', 'one-shot');
        writeDebateRound(sessionDir, 'debate-round-1.json', {
            debate_total_rounds: 1,
            cost_usd_actual: 0.01,
            responses: [{ provider: 'anthropic', model: 'claude-sonnet-4-5', input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }],
        });
        const result = computeCouncilMispricing(root);
        expect(result.status).toBe('pending');
    });

    it('confirmed: a real 2-round session whose recorded cost ignored cache tokens reprices ≥5% different, computed from fixture constants via reprice_with_cache/estimate_cost', () => {
        const root = mkTmp('council-root-');
        const sessionDir = path.join(root, 'agents', 'runtime', 'council', 'responses', 'fixture-debate');
        const provider = 'anthropic';
        const model = 'claude-sonnet-4-5';

        // Round 1: a cold-start write — the historical cache-blind estimate_cost()
        // call site billed only input_tokens/output_tokens, at full rate,
        // silently dropping the (much larger) 1.25x cache_creation write premium.
        const round1 = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 8000 };
        // Round 2: a warm read — the same bug silently drops the (much cheaper)
        // 0.1x cache_read discount too, so the recorded figure UNDER-counts here.
        const round2 = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 8000, cache_creation_input_tokens: 0 };

        const table = load_prices(); // real, checked-in .agent-prices.md — same table the module under test loads
        const recorded1 = estimate_cost(provider, model, round1.input_tokens, round1.output_tokens, table);
        const recorded2 = estimate_cost(provider, model, round2.input_tokens, round2.output_tokens, table);
        const recordedTotal = recorded1.input_usd + recorded1.output_usd + recorded2.input_usd + recorded2.output_usd;

        const aware1 = reprice_with_cache(provider, model, { ...round1 }, table, '5m');
        const aware2 = reprice_with_cache(provider, model, { ...round2 }, table, '5m');
        const cacheAwareTotal = aware1.input_usd + aware1.output_usd + aware2.input_usd + aware2.output_usd;
        const expectedDeltaPct = (cacheAwareTotal - recordedTotal) / recordedTotal;

        writeDebateRound(sessionDir, 'debate-round-1.json', { debate_total_rounds: 2, cost_usd_actual: recorded1.input_usd + recorded1.output_usd, responses: [{ provider, model, ...round1 }] });
        writeDebateRound(sessionDir, 'debate-round-2.json', { debate_total_rounds: 2, cost_usd_actual: recorded2.input_usd + recorded2.output_usd, responses: [{ provider, model, ...round2 }] });

        const result = computeCouncilMispricing(root);

        expect(result.rounds).toBe(2);
        expect(result.session).toBe(path.join('agents', 'runtime', 'council', 'responses', 'fixture-debate'));
        expect(result.recorded_cost_usd).toBeCloseTo(recordedTotal, 10);
        expect(result.cache_aware_cost_usd).toBeCloseTo(cacheAwareTotal, 10);
        expect(result.delta_pct).toBeCloseTo(expectedDeltaPct, 10);
        expect(Math.abs(expectedDeltaPct)).toBeGreaterThanOrEqual(0.05); // sanity: fixture actually clears the threshold
        expect(result.status).toBe('confirmed');
    });

    it('falsified when a session records no cache usage at all (recorded === cache-aware, delta ≈ 0)', () => {
        const root = mkTmp('council-root-');
        const sessionDir = path.join(root, 'agents', 'runtime', 'council', 'responses', 'no-cache-debate');
        const provider = 'anthropic';
        const model = 'claude-sonnet-4-5';
        const round = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

        const table = load_prices();
        const recorded = estimate_cost(provider, model, round.input_tokens, round.output_tokens, table);
        const recordedUsd = recorded.input_usd + recorded.output_usd;

        writeDebateRound(sessionDir, 'debate-round-1.json', { debate_total_rounds: 2, cost_usd_actual: recordedUsd, responses: [{ provider, model, ...round }] });
        writeDebateRound(sessionDir, 'debate-round-2.json', { debate_total_rounds: 2, cost_usd_actual: recordedUsd, responses: [{ provider, model, ...round }] });

        const result = computeCouncilMispricing(root);
        expect(result.status).toBe('falsified');
        expect(result.delta_pct).toBeCloseTo(0, 10);
    });
});

// ── computeWorktreeFragmentation (C-5) ───────────────────────────────────

function writeSubagentJsonl(dir: string, agentId: string, timestamp: string, u: Partial<TokenCounts>): void {
    fs.mkdirSync(dir, { recursive: true });
    const line = {
        type: 'assistant',
        isSidechain: true,
        agentId,
        requestId: `req-${agentId}-${timestamp}`,
        timestamp,
        message: { id: `msg-${agentId}-${timestamp}`, model: 'claude-sonnet-4-5', usage: usage(u) },
    };
    fs.appendFileSync(path.join(dir, `${agentId}.jsonl`), JSON.stringify(line) + '\n');
}

describe('encodeProjectPath', () => {
    it('replaces "/" and "." with "-", mirroring cost/track.mjs', () => {
        expect(encodeProjectPath('/Users/x/repo.git')).toBe('-Users-x-repo-git');
    });
});

describe('computeWorktreeFragmentation', () => {
    it('pending when fewer than 2 worktree paths are supplied', () => {
        const projectsRoot = mkTmp('projects-root-');
        const result = computeWorktreeFragmentation(projectsRoot, ['/only/one'], 14);
        expect(result.status).toBe('pending');
    });

    it('pending when neither encoded directory exists under projectsRoot', () => {
        const projectsRoot = mkTmp('projects-root-');
        const result = computeWorktreeFragmentation(projectsRoot, ['/repo/main', '/repo/main/.worktrees/x'], 14);
        expect(result.status).toBe('pending');
    });

    it('confirmed: a brand-new worktree’s pooled first-call read share is well under 10% of the established directory’s', () => {
        const projectsRoot = mkTmp('projects-root-');
        const established = '/repo/main';
        const worktree = '/repo/main/.worktrees/fresh';
        const establishedDir = path.join(projectsRoot, encodeProjectPath(established));
        const worktreeDir = path.join(projectsRoot, encodeProjectPath(worktree));

        // Established: warm siblings — first calls already read most of their prefix back.
        writeSubagentJsonl(establishedDir, 'agent-est-1', '2026-07-30T10:00:00.000Z', { input_tokens: 50, cache_read_input_tokens: 900 });
        writeSubagentJsonl(establishedDir, 'agent-est-2', '2026-07-30T10:01:00.000Z', { input_tokens: 60, cache_read_input_tokens: 940 });

        // Fresh worktree: nothing cached yet — first calls are pure cold writes.
        writeSubagentJsonl(worktreeDir, 'agent-wt-1', '2026-07-30T10:00:00.000Z', { input_tokens: 40, cache_creation_input_tokens: 1000 });
        writeSubagentJsonl(worktreeDir, 'agent-wt-2', '2026-07-30T10:01:00.000Z', { input_tokens: 45, cache_creation_input_tokens: 1000 });

        const result = computeWorktreeFragmentation(projectsRoot, [established, worktree], 14);

        expect(result.status).toBe('confirmed');
        expect(result.established_first_call_read_share).toBeGreaterThan(0.8);
        expect(result.worktree_first_call_read_share).toBe(0);
        expect(result.ratio).toBe(0);
    });

    it('falsified when the fresh worktree shows a first-call read share at least half the established directory’s', () => {
        const projectsRoot = mkTmp('projects-root-');
        const established = '/repo/main';
        const worktree = '/repo/main/.worktrees/leaky';
        const establishedDir = path.join(projectsRoot, encodeProjectPath(established));
        const worktreeDir = path.join(projectsRoot, encodeProjectPath(worktree));

        writeSubagentJsonl(establishedDir, 'agent-est-1', '2026-07-30T10:00:00.000Z', { input_tokens: 100, cache_read_input_tokens: 900 });
        // Cross-directory cache reuse that should not be happening per the docs.
        writeSubagentJsonl(worktreeDir, 'agent-wt-1', '2026-07-30T10:00:00.000Z', { input_tokens: 100, cache_read_input_tokens: 800 });

        const result = computeWorktreeFragmentation(projectsRoot, [established, worktree], 14);
        expect(result.status).toBe('falsified');
        expect(result.ratio).toBeGreaterThanOrEqual(0.5);
    });
});

// ── buildClaims — pending propagation ────────────────────────────────────

describe('buildClaims', () => {
    it('C-3 is always pending — no preamble-reduction intervention has landed', () => {
        const claims = buildClaims({
            subagentColdStart: { legs: 0, median_first_call_written_or_uncached: 0, mean_first_call_written_or_uncached: 0, first_call_cache_read_share: 0, cold_start_share_of_write_volume: 0, write_share_of_billable: 0, read_share_of_billable: 0, uncached_share_of_billable: 0 },
            duplicateScope: { evaluable: false, shared_filenames: 0, duplicate_tokens_per_spawn: 0, spawn_count: 0, duplicate_token_estimate_total: 0, share_of_subagent_write_volume: 0 },
            councilMispricing: { status: 'pending' },
            worktreeFragmentation: { status: 'pending' },
        });
        const c3 = claims.find((c) => c.id === 'C-3')!;
        expect(c3.verdict).toBe('pending');
        expect(c3.measured).toBeUndefined();
    });

    it('every claim reports pending — never a fabricated verdict — when its inputs are not evaluable', () => {
        const claims = buildClaims({
            subagentColdStart: { legs: 0, median_first_call_written_or_uncached: 0, mean_first_call_written_or_uncached: 0, first_call_cache_read_share: 0, cold_start_share_of_write_volume: 0, write_share_of_billable: 0, read_share_of_billable: 0, uncached_share_of_billable: 0 },
            duplicateScope: { evaluable: false, reason: 'no data', shared_filenames: 0, duplicate_tokens_per_spawn: 0, spawn_count: 0, duplicate_token_estimate_total: 0, share_of_subagent_write_volume: 0 },
            councilMispricing: { status: 'pending', reason: 'no artefact' },
            worktreeFragmentation: { status: 'pending', reason: 'no worktrees' },
        });
        for (const c of claims) {
            expect(c.verdict).toBe('pending');
            expect(c.measured).toBeUndefined();
        }
    });

    it('C-1 confirms at/above the 50% threshold and falsifies below it', () => {
        const base = { duplicateScope: { evaluable: false, shared_filenames: 0, duplicate_tokens_per_spawn: 0, spawn_count: 0, duplicate_token_estimate_total: 0, share_of_subagent_write_volume: 0 } as const, councilMispricing: { status: 'pending' } as const, worktreeFragmentation: { status: 'pending' } as const };
        const atThreshold = buildClaims({ ...base, subagentColdStart: { legs: 10, median_first_call_written_or_uncached: 0, mean_first_call_written_or_uncached: 0, first_call_cache_read_share: 0, cold_start_share_of_write_volume: 0.5, write_share_of_billable: 0, read_share_of_billable: 0, uncached_share_of_billable: 0 } });
        expect(atThreshold.find((c) => c.id === 'C-1')!.verdict).toBe('confirmed');

        const belowThreshold = buildClaims({ ...base, subagentColdStart: { legs: 10, median_first_call_written_or_uncached: 0, mean_first_call_written_or_uncached: 0, first_call_cache_read_share: 0, cold_start_share_of_write_volume: 0.499, write_share_of_billable: 0, read_share_of_billable: 0, uncached_share_of_billable: 0 } });
        expect(belowThreshold.find((c) => c.id === 'C-1')!.verdict).toBe('falsified');
    });
});

// ── buildReport — dedup ratio propagation + full-pending sweep on empty fixtures ──

describe('buildReport', () => {
    it('propagates scanTranscripts’ dedup_ratio, and every claim is pending when no supporting data exists', () => {
        const root = mkTmp('projects-root-');
        const projectDir = path.join(root, 'proj');
        const rec1 = {
            type: 'assistant',
            isSidechain: false,
            requestId: 'req-1',
            timestamp: '2026-07-30T10:00:00.000Z',
            message: { id: 'msg-1', model: 'claude-sonnet-4-5', usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
        };
        // Write rec1 into two files with the SAME (message.id, requestId) — a replay, per cc_transcript's dedup contract.
        fs.mkdirSync(projectDir, { recursive: true });
        fs.writeFileSync(path.join(projectDir, 'a.jsonl'), JSON.stringify(rec1) + '\n');
        fs.writeFileSync(path.join(projectDir, 'b.jsonl'), JSON.stringify(rec1) + '\n');

        const councilRoot = mkTmp('council-root-empty-');
        const nonexistentUserRules = path.join(mkTmp('nowhere-'), 'rules');
        const nonexistentProjectRules = path.join(mkTmp('nowhere-'), 'rules');

        const opts = parseArgs([
            '--root', root,
            '--max-age-days', '3650',
            '--council-root', councilRoot,
            '--repo-root', councilRoot, // not a git repo → listGitWorktrees([]) → C-5 pending
            '--user-rules-dir', nonexistentUserRules,
            '--project-rules-dir', nonexistentProjectRules,
        ]);
        const report = buildReport(opts);

        expect(report.total_seen).toBe(2);
        expect(report.deduped_count).toBe(1);
        expect(report.dedup_ratio).toBeCloseTo(0.5, 12);

        for (const c of report.claims) {
            expect(c.verdict).toBe('pending');
        }
        expect(typeof report.host_version).toBe('string');
    });
});

// ── write-share signature (ledger-truth 3.3) ─────────────────────────────
//
// `cold_start_share_of_write_volume` says how much of the writing happened on
// a first call. It cannot say whether the workload is writing cache it never
// reads back — that costs the 1.25x premium and collects no discount, and it
// is exactly the shape a cache report should surface.
describe('computeColdStarts — write-share signature', () => {
    it('the three shares partition billable input and sum to 1', () => {
        const records = [
            rec('a', '2026-08-11T10:00:00Z', { input_tokens: 100, cache_creation_input_tokens: 300, cache_read_input_tokens: 600 }),
            rec('b', '2026-08-11T10:01:00Z', { input_tokens: 100, cache_creation_input_tokens: 100, cache_read_input_tokens: 800 }),
        ];
        const cs = computeColdStarts(records);
        const billable = records.reduce((s, r) => s + billableInputTokens(r.usage), 0);
        expect(cs.write_share_of_billable).toBeCloseTo(400 / billable, 10);
        expect(cs.read_share_of_billable).toBeCloseTo(1400 / billable, 10);
        expect(cs.uncached_share_of_billable).toBeCloseTo(200 / billable, 10);
        expect(
            cs.write_share_of_billable + cs.read_share_of_billable + cs.uncached_share_of_billable,
        ).toBeCloseTo(1, 10);
    });

    it('a write-heavy run that never reads back is visible here and NOT in the cold-start metric', () => {
        const records = [
            rec('a', '2026-08-11T10:00:00Z', { cache_creation_input_tokens: 1000 }),
            rec('a', '2026-08-11T10:01:00Z', { cache_creation_input_tokens: 1000 }),
        ];
        const cs = computeColdStarts(records);
        expect(cs.write_share_of_billable).toBe(1);
        expect(cs.read_share_of_billable).toBe(0);
        // The pre-existing metric reports half the writing on the first call —
        // it says nothing about the premium being wasted.
        expect(cs.cold_start_share_of_write_volume).toBeCloseTo(0.5, 10);
    });

    it('counts ALL subagent records, not just first calls', () => {
        const records = [
            rec('a', '2026-08-11T10:00:00Z', { cache_creation_input_tokens: 1000 }),
            rec('a', '2026-08-11T10:01:00Z', { cache_read_input_tokens: 3000 }),
        ];
        const cs = computeColdStarts(records);
        expect(cs.legs).toBe(1);
        expect(cs.read_share_of_billable).toBeCloseTo(0.75, 10);
    });

    it('an empty corpus reads 0/0/0 — absence, never a perfectly-uncached claim', () => {
        const cs = computeColdStarts([]);
        expect(cs.legs).toBe(0);
        expect(cs.write_share_of_billable).toBe(0);
        expect(cs.read_share_of_billable).toBe(0);
        expect(cs.uncached_share_of_billable).toBe(0);
    });
});

describe('prefix stability — road-to-runtime-context-floors step 1.3', () => {
    // The one outcome that matters and was previously latent: a STABLE cohort
    // whose read share sits BELOW the unstable cohort means a prefix-stable
    // surface is being rewritten between repeat dispatches.
    it('reports an inversion rather than leaving it in a separate CLI', () => {
        const r = computePrefixStability({
            total_lines: 5,
            lines_with_data: 5,
            groups: [],
            stable_cohort: { n: 2, hit_count: 0, hit_rate: 0 },
            unstable_cohort: { n: 2, hit_count: 2, hit_rate: 1 },
            drift_visible: false,
        });
        expect(r.verdict).toBe('inverted');
        expect(r.reason).toContain('LESS often');
        expect(r.stable_cohort.read_share).toBe(0);
        expect(r.unstable_cohort.read_share).toBe(1);
    });

    it('reports the expected ordering as stable-higher', () => {
        const r = computePrefixStability({
            total_lines: 4,
            lines_with_data: 4,
            groups: [],
            stable_cohort: { n: 2, hit_count: 2, hit_rate: 1 },
            unstable_cohort: { n: 2, hit_count: 0, hit_rate: 0 },
            drift_visible: true,
        });
        expect(r.verdict).toBe('stable-higher');
    });

    it('states "insufficient data" instead of a number when either cohort is empty', () => {
        for (const [stable, unstable] of [
            [null, 0.5],
            [0.5, null],
            [null, null],
        ] as Array<[number | null, number | null]>) {
            const r = computePrefixStability({
                total_lines: 1,
                lines_with_data: 1,
                groups: [],
                stable_cohort: { n: stable === null ? 0 : 2, hit_count: 0, hit_rate: stable },
                unstable_cohort: { n: unstable === null ? 0 : 2, hit_count: 0, hit_rate: unstable },
                drift_visible: false,
            });
            expect(r.verdict).toBe('insufficient-data');
            expect(r.reason).toContain('empty');
            // A fabricated 0.0% for "nothing was measured" is the failure this
            // three-valued verdict exists to prevent.
            expect(r.reason).not.toMatch(/\b0\.0%/);
        }
    });

    it('renders both cohorts and never prints a share for an empty one', () => {
        const empty = computePrefixStability({
            total_lines: 0,
            lines_with_data: 0,
            groups: [],
            stable_cohort: { n: 0, hit_count: 0, hit_rate: null },
            unstable_cohort: { n: 0, hit_count: 0, hit_rate: null },
            drift_visible: false,
        });
        const text = renderText({ ...baseReport(), prefix_stability: empty });
        expect(text).toContain('Prefix stability');
        expect(text).toContain('stable cohort:');
        expect(text).toContain('unstable cohort:');
        expect(text).toContain('read_share=insufficient data');
    });
});
