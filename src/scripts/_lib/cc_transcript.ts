/**
 * Claude Code transcript reader — replay-dedup, main/subagent classification,
 * and token-usage aggregation.
 *
 * Metric definition (load-bearing — every consumer of this module computes
 * cost/weight against this, not against `usage.input_tokens` alone):
 *
 *     billable_input = input_tokens + cache_read_input_tokens
 *                       + cache_creation_input_tokens
 *
 * Anthropic's `usage.input_tokens` field EXCLUDES cache tokens — it is only
 * the uncached portion of the prompt. A cost or volume figure built from
 * `input_tokens` alone silently drops the cache-read and cache-write legs.
 *
 * Replay dedup: Claude Code can write the same assistant turn into more than
 * one transcript file (a resumed/checkpointed session re-persists prior
 * turns into a new session file; a subagent's own transcript can duplicate
 * turns also visible from its parent). On this repo's real
 * `~/.claude/projects/` tree, 50.8% of `type: "assistant"` records with a
 * `usage` block are such replays — an un-deduped sum overstates real spend
 * by roughly 2x. `message.id` + `requestId` together are the closest thing
 * to a stable identity for one real API call.
 *
 * Subagent classification: a record is a subagent leg iff its top-level
 * `agentId` is present, or `isSidechain === true`. Both signals are checked
 * because subagent transcripts observed under
 * `<project>/<sessionId>/subagents/agent-*.jsonl` carry both, but a future
 * or differently-configured transcript could carry only one.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';

/** Default base directory holding one subdirectory per Claude Code project. */
export const DEFAULT_PROJECTS_ROOT = path.join(homedir(), '.claude', 'projects');

export type TranscriptBucket = 'main' | 'subagent';

/** The six token counters every downstream metric (cost, weight, share) is built from. */
export interface TokenCounts {
    input_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
    output_tokens: number;
    /** Subset of `cache_creation_input_tokens` written under the 5-minute TTL. */
    ephemeral_5m_input_tokens: number;
    /** Subset of `cache_creation_input_tokens` written under the 1-hour TTL. */
    ephemeral_1h_input_tokens: number;
}

/** One deduped assistant turn. */
export interface TranscriptRecord {
    bucket: TranscriptBucket;
    agentId: string | null;
    model: string;
    /** Raw `timestamp` field from the record, or null when absent. */
    timestamp: string | null;
    usage: TokenCounts;
}

export interface ScanOptions {
    /** Base directory to walk (default {@link DEFAULT_PROJECTS_ROOT}). Injectable for tests. */
    root?: string;
    /**
     * Restrict the walk to one subdirectory of `root` — either an absolute
     * path or a name relative to `root` (e.g. the encoded-cwd project dir
     * `findProjectDir()` style callers already compute). Omit to scan every
     * project under `root`.
     */
    projectDir?: string;
    /** Skip `.jsonl` files whose mtime is older than this many days. */
    maxAgeDays?: number;
    /** Clock used to evaluate `maxAgeDays` — injectable for tests. */
    now?: Date;
}

export interface ScanResult {
    records: TranscriptRecord[];
    /** Count of `type: "assistant"` + `usage`-bearing lines seen, before dedup. */
    totalSeen: number;
    /** `records.length` — the count after dedup. */
    dedupedCount: number;
    /** Fraction of seen records that were replays: `(totalSeen - dedupedCount) / totalSeen`. */
    dedup_ratio: number;
}

/** Per-bucket rollup: call count, the four raw token sums, the TTL write split, and two derived metrics. */
export interface BucketAggregate extends TokenCounts {
    bucket: TranscriptBucket;
    calls: number;
    /** `cache_read_input_tokens / billable_input` — 0 when billable_input is 0. */
    read_share: number;
    /** Cost-shaped weight: uncached input 1.0x, cache read 0.1x, 5m write 1.25x, 1h write 2.0x. */
    weighted_input_units: number;
}

/** `input_tokens + cache_read_input_tokens + cache_creation_input_tokens` — see module doc comment. */
export function billableInputTokens(u: Pick<TokenCounts, 'input_tokens' | 'cache_read_input_tokens' | 'cache_creation_input_tokens'>): number {
    return u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens;
}

/**
 * Cost-shaped weight across the four input classes. `cache_creation_input_tokens`
 * that exceeds the known 5m/1h split (older records predating the TTL
 * breakdown, or a partial breakdown) is treated as a 5m write — Anthropic's
 * default cache TTL — rather than silently dropped.
 */
export function weightedInputUnits(u: TokenCounts): number {
    const knownSplit = u.ephemeral_5m_input_tokens + u.ephemeral_1h_input_tokens;
    const unaccounted = Math.max(0, u.cache_creation_input_tokens - knownSplit);
    return (
        u.input_tokens * 1.0 +
        u.cache_read_input_tokens * 0.1 +
        (u.ephemeral_5m_input_tokens + unaccounted) * 1.25 +
        u.ephemeral_1h_input_tokens * 2.0
    );
}

function numOr0(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

interface RawCacheCreation {
    ephemeral_5m_input_tokens?: unknown;
    ephemeral_1h_input_tokens?: unknown;
}

interface RawUsage {
    input_tokens?: unknown;
    cache_read_input_tokens?: unknown;
    cache_creation_input_tokens?: unknown;
    output_tokens?: unknown;
    cache_creation?: RawCacheCreation;
}

interface RawAssistantRecord {
    type?: unknown;
    message?: { id?: unknown; model?: unknown; usage?: RawUsage };
    requestId?: unknown;
    agentId?: unknown;
    isSidechain?: unknown;
    timestamp?: unknown;
}

function toTokenCounts(raw: RawUsage | undefined): TokenCounts {
    const cc = raw?.cache_creation ?? {};
    return {
        input_tokens: numOr0(raw?.input_tokens),
        cache_read_input_tokens: numOr0(raw?.cache_read_input_tokens),
        cache_creation_input_tokens: numOr0(raw?.cache_creation_input_tokens),
        output_tokens: numOr0(raw?.output_tokens),
        ephemeral_5m_input_tokens: numOr0(cc.ephemeral_5m_input_tokens),
        ephemeral_1h_input_tokens: numOr0(cc.ephemeral_1h_input_tokens),
    };
}

/** Subagent iff a non-empty top-level `agentId` OR `isSidechain === true` — see module doc comment. */
function classifyBucket(raw: RawAssistantRecord): TranscriptBucket {
    const hasAgentId = typeof raw.agentId === 'string' && raw.agentId.length > 0;
    return hasAgentId || raw.isSidechain === true ? 'subagent' : 'main';
}

/** `message.id` + `requestId`, NUL-joined so no string content can forge a collision. */
function dedupKey(raw: RawAssistantRecord): string {
    const id = typeof raw.message?.id === 'string' ? raw.message.id : '';
    const reqId = typeof raw.requestId === 'string' ? raw.requestId : '';
    return `${id}\u0000${reqId}`;
}

function parseLine(line: string): RawAssistantRecord | null {
    if (line.trim().length === 0) return null;
    try {
        return JSON.parse(line) as RawAssistantRecord;
    } catch {
        return null;
    }
}

/**
 * List every `*.jsonl` file under `opts.root` (or `opts.root/opts.projectDir`
 * when given), recursively — this is what makes `<project>/<sessionId>/
 * subagents/agent-*.jsonl` visible alongside the flat `<project>/*.jsonl`
 * session files without a second code path.
 */
export function listTranscriptFiles(opts: ScanOptions = {}): string[] {
    const root = opts.root ?? DEFAULT_PROJECTS_ROOT;
    const base = opts.projectDir
        ? (path.isAbsolute(opts.projectDir) ? opts.projectDir : path.join(root, opts.projectDir))
        : root;
    if (!fs.existsSync(base)) return [];

    const cutoffMs = opts.maxAgeDays !== undefined
        ? (opts.now ?? new Date()).getTime() - opts.maxAgeDays * 24 * 60 * 60 * 1000
        : null;

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
            if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
            if (cutoffMs !== null) {
                let mtimeMs: number;
                try {
                    mtimeMs = fs.statSync(full).mtimeMs;
                } catch {
                    continue;
                }
                if (mtimeMs < cutoffMs) continue;
            }
            out.push(full);
        }
    }
    return out.sort();
}

/**
 * Read every listed transcript file, keep only `type: "assistant"` records
 * carrying a `usage` block, and dedup by {@link dedupKey}. First occurrence
 * of a dedup key wins — replays carry the same usage, so occurrence order
 * has no effect on the aggregated totals.
 */
export function scanTranscripts(opts: ScanOptions = {}): ScanResult {
    const files = listTranscriptFiles(opts);
    const seen = new Set<string>();
    const records: TranscriptRecord[] = [];
    let totalSeen = 0;

    for (const file of files) {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        for (const line of text.split('\n')) {
            const raw = parseLine(line);
            if (!raw || raw.type !== 'assistant' || !raw.message?.usage) continue;

            totalSeen += 1;
            const key = dedupKey(raw);
            if (seen.has(key)) continue;
            seen.add(key);

            records.push({
                bucket: classifyBucket(raw),
                agentId: typeof raw.agentId === 'string' ? raw.agentId : null,
                model: typeof raw.message.model === 'string' ? raw.message.model : 'unknown',
                timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : null,
                usage: toTokenCounts(raw.message.usage),
            });
        }
    }

    const dedupedCount = records.length;
    return {
        records,
        totalSeen,
        dedupedCount,
        dedup_ratio: totalSeen > 0 ? (totalSeen - dedupedCount) / totalSeen : 0,
    };
}

function emptyAggregate(bucket: TranscriptBucket): BucketAggregate {
    return {
        bucket,
        calls: 0,
        input_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
        ephemeral_5m_input_tokens: 0,
        ephemeral_1h_input_tokens: 0,
        read_share: 0,
        weighted_input_units: 0,
    };
}

/** Roll deduped records up into a `main` / `subagent` pair of {@link BucketAggregate}. */
export function aggregateByBucket(records: readonly TranscriptRecord[]): Record<TranscriptBucket, BucketAggregate> {
    const buckets: Record<TranscriptBucket, BucketAggregate> = {
        main: emptyAggregate('main'),
        subagent: emptyAggregate('subagent'),
    };

    for (const rec of records) {
        const agg = buckets[rec.bucket];
        agg.calls += 1;
        agg.input_tokens += rec.usage.input_tokens;
        agg.cache_read_input_tokens += rec.usage.cache_read_input_tokens;
        agg.cache_creation_input_tokens += rec.usage.cache_creation_input_tokens;
        agg.output_tokens += rec.usage.output_tokens;
        agg.ephemeral_5m_input_tokens += rec.usage.ephemeral_5m_input_tokens;
        agg.ephemeral_1h_input_tokens += rec.usage.ephemeral_1h_input_tokens;
    }

    for (const bucket of Object.values(buckets)) {
        const billable = billableInputTokens(bucket);
        bucket.read_share = billable > 0 ? bucket.cache_read_input_tokens / billable : 0;
        bucket.weighted_input_units = weightedInputUnits(bucket);
    }

    return buckets;
}
