#!/usr/bin/env node
/**
 * session_eol_report — session end-of-life baseline over the local
 * Claude Code transcript store (road-to-token-economy-recycling Phases
 * 1.1–1.3). Read-only; prints aggregate numbers, never content.
 *
 * Per session file (main chain only): final context size in parsed tokens
 * (`cc_transcript.billableInputTokens` of the last assistant record), turn
 * count, and every observed compaction event (`_lib/session_eol.ts`
 * detector, pinned to the observed `compact_boundary` marker). The
 * aggregate is the baseline the recycle threshold cites
 * (`src/config/recycle-threshold-budget.json`), and the reproduce command
 * for `agents/evidence/analysis/token-economy-recycling-phase1.md`:
 *
 *     ./scripts-run src/scripts/session_eol_report            # text
 *     ./scripts-run src/scripts/session_eol_report -- --json  # machine
 *
 * Fallback honesty (Phase 1.2): sessions whose transcript yields NO
 * parseable assistant usage are counted as `sessions_without_usage`, and
 * the bytes↔tokens Pearson r over the READABLE set is printed so the
 * byte-proxy's (un)fitness is a published number, not a vibe.
 *
 * Marker-drift alarm (blocker `compaction-marker-shape`): the scanner
 * counts BOTH observed markers independently; a store-wide divergence
 * between `compact_boundary` events and `isCompactSummary` records is
 * reported as drift instead of silently zeroing the metric.
 */

import * as fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';

import {
    DEFAULT_PROJECTS_ROOT,
    derivedBytes,
    listTranscriptFiles,
    measureBytesPerToken,
    scanTranscripts,
    type BytesPerToken,
    type DerivedBytes,
} from './_lib/cc_transcript.js';
import { emptyCounters, scanEolSlice, type EolCounters } from './_lib/session_eol.js';

export interface SessionSummary {
    file: string;
    bytes: number;
    counters: EolCounters;
    last_ts: string | null;
}

export interface EolReport {
    schema_version: 1;
    generated_at: string;
    root: string;
    files_scanned: number;
    sessions: number;
    sessions_with_usage: number;
    sessions_without_usage: number;
    final_context_tokens: Percentiles | null;
    turns: Percentiles | null;
    compaction: {
        sessions_with_compaction: number;
        events_total: number;
        events_by_trigger: Record<string, number>;
        pre_tokens: Percentiles | null;
        post_tokens: Percentiles | null;
        /** `isCompactSummary` records store-wide — drift alarm vs `events_total`. */
        compact_summary_records: number;
        marker_drift: boolean;
    };
    /**
     * State-destroyed vs state-captured, as ONE reading
     * (road-to-inbox-harvest-2026-08-d-context-ledger Step 2.2).
     *
     * Before this, a compaction count and an advisory count sat in two places
     * and nobody correlated them, so "how often was state destroyed with no
     * capture in front of it" had no answer at all.
     *
     * HONEST LIMIT, stated in the shape rather than in prose only: the two
     * sides come from different corpora — compactions are scanned out of
     * transcripts, the advisory stamps live in per-session state files under a
     * hashed key — and no field joins a transcript to its state file. So this
     * is an AGGREGATE comparison over the same store, not a per-session join,
     * and `join_basis` says so on every emitted report. A reader may compare
     * the totals; a reader may NOT conclude that a specific compaction lacked
     * a capture.
     */
    capture: {
        /** Session-eol state files found. `null` ⇒ the directory is absent. */
        state_files: number | null;
        /** State files carrying an `advisory_fired_at` stamp. */
        advisory_fired: number;
        /** State files that additionally recorded "advised, but no envelope". */
        advised_without_envelope: number;
        /** Always `"aggregate"` today. See the doc comment. */
        join_basis: 'aggregate';
    };
    /** Pearson r of file bytes vs final context tokens over the readable set. */
    bytes_tokens_pearson_r: number | null;
    /**
     * The median session's final context expressed in bytes - DERIVED, and
     * labelled so (`road-to-a-bytes-row-that-exists` Phase 2, metric
     * `provider-bytes-per-call`).
     *
     * Do NOT confuse this with `SessionSummary.bytes` or with the Pearson r
     * above: those are the transcript FILE's size on this disk, a local
     * artefact. This is an estimate of the context volume a round re-sends,
     * obtained by multiplying a token count by a ratio measured on this same
     * store. `null` whenever either input is missing - there is no fallback
     * ratio anywhere in this path, deliberately.
     *
     * COST, named rather than discovered: producing it costs a second pass
     * over the store (`scanTranscripts`), because the end-of-life counters are
     * accumulated by `_lib/session_eol.ts`, whose shape is PERSISTED in state
     * files and whose fields therefore carry a migration obligation this
     * report does not need to take on for a derived column.
     */
    provider_bytes: {
        factor: BytesPerToken | null;
        median_final_context: DerivedBytes | null;
    };
    threshold_crossings: Record<string, number>;
}

export interface Percentiles {
    n: number;
    min: number;
    median: number;
    p90: number;
    p95: number;
    max: number;
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return NaN;
    const k = (sorted.length - 1) * p;
    const f = Math.floor(k);
    const c = Math.min(f + 1, sorted.length - 1);
    return (sorted[f] as number) + ((sorted[c] as number) - (sorted[f] as number)) * (k - f);
}

export function percentiles(values: number[]): Percentiles | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return {
        n: sorted.length,
        min: sorted[0] as number,
        median: percentile(sorted, 0.5),
        p90: percentile(sorted, 0.9),
        p95: percentile(sorted, 0.95),
        max: sorted[sorted.length - 1] as number,
    };
}

function pearson(pairs: Array<[number, number]>): number | null {
    if (pairs.length < 3) return null;
    const n = pairs.length;
    const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
    const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
    let cov = 0;
    let sx = 0;
    let sy = 0;
    for (const [x, y] of pairs) {
        cov += (x - mx) * (y - my);
        sx += (x - mx) ** 2;
        sy += (y - my) ** 2;
    }
    if (sx === 0 || sy === 0) return null;
    return cov / (Math.sqrt(sx) * Math.sqrt(sy));
}

/** Scan one transcript file into a session summary. Unreadable file → null. */
export function scanSessionFile(file: string): SessionSummary | null {
    let text: string;
    let bytes: number;
    try {
        text = fs.readFileSync(file, 'utf-8');
        bytes = fs.statSync(file).size;
    } catch {
        return null;
    }
    const counters = scanEolSlice(text, emptyCounters());
    let last_ts: string | null = null;
    // cheap: reuse the final assistant stamp; fall back to null.
    last_ts = counters.final_context_at;
    return { file, bytes, counters, last_ts };
}

/** Where `session_eol_hook` persists its per-session state (gitignored). */
export const SESSION_EOL_STATE_REL = path.join('agents', 'runtime', 'state', 'session-eol');

/**
 * The capture side of the Step-2.2 reading.
 *
 * `state_files: null` distinguishes "the directory is not there" from "it is
 * there and empty" — an instrument that reports 0 for both cannot tell a quiet
 * estate from one it cannot see, which is the failure the sibling ledger fixed
 * for its own open-record set.
 */
export function scanCaptureState(root: string): EolReport['capture'] {
    const dir = path.join(root, SESSION_EOL_STATE_REL);
    let names: string[];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
    } catch {
        return { state_files: null, advisory_fired: 0, advised_without_envelope: 0, join_basis: 'aggregate' };
    }

    let advisoryFired = 0;
    let advisedWithoutEnvelope = 0;
    for (const name of names) {
        try {
            const parsed: unknown = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8'));
            if (typeof parsed !== 'object' || parsed === null) continue;
            const rec = parsed as Record<string, unknown>;
            if (typeof rec['advisory_fired_at'] === 'string') advisoryFired++;
            if (typeof rec['missing_envelope_warned_at'] === 'string') advisedWithoutEnvelope++;
        } catch {
            // A torn or hand-edited state file is data we do not have.
        }
    }
    return {
        state_files: names.length,
        advisory_fired: advisoryFired,
        advised_without_envelope: advisedWithoutEnvelope,
        join_basis: 'aggregate',
    };
}

export function buildReport(root: string, now: Date = new Date()): EolReport {
    const files = listTranscriptFiles({ root });
    const sessions: SessionSummary[] = [];
    for (const file of files) {
        const summary = scanSessionFile(file);
        if (!summary) continue;
        const c = summary.counters;
        if (c.assistant_records === 0 && c.turns === 0 && c.compactions.length === 0) continue;
        sessions.push(summary);
    }

    const withUsage = sessions.filter((s) => s.counters.final_context_tokens !== null);
    const finals = withUsage.map((s) => s.counters.final_context_tokens as number);
    const turns = withUsage.map((s) => s.counters.turns);

    const allEvents = sessions.flatMap((s) => s.counters.compactions);
    const byTrigger: Record<string, number> = {};
    for (const e of allEvents) byTrigger[e.trigger] = (byTrigger[e.trigger] ?? 0) + 1;
    const pre = allEvents.map((e) => e.pre_tokens).filter((v): v is number => v !== null);
    const post = allEvents.map((e) => e.post_tokens).filter((v): v is number => v !== null);
    const summaryRecords = sessions.reduce((s, x) => s + x.counters.compact_summaries, 0);

    // Byte factor, measured on this same store. Separate pass - see the
    // `provider_bytes` doc comment for why it is not folded into EolCounters.
    const byteScan = scanTranscripts({ root, measureBytes: true });
    const bytesFactor = measureBytesPerToken(byteScan.records);

    const crossings: Record<string, number> = {};
    for (const thr of [200_000, 400_000, 600_000, 800_000]) {
        crossings[`>=${thr / 1000}k`] = finals.filter((c) => c >= thr).length;
    }

    return {
        schema_version: 1,
        generated_at: now.toISOString(),
        root,
        files_scanned: files.length,
        sessions: sessions.length,
        sessions_with_usage: withUsage.length,
        sessions_without_usage: sessions.length - withUsage.length,
        final_context_tokens: percentiles(finals),
        turns: percentiles(turns),
        compaction: {
            sessions_with_compaction: sessions.filter((s) => s.counters.compactions.length > 0).length,
            events_total: allEvents.length,
            events_by_trigger: byTrigger,
            pre_tokens: percentiles(pre),
            post_tokens: percentiles(post),
            compact_summary_records: summaryRecords,
            marker_drift: summaryRecords !== allEvents.length,
        },
        capture: scanCaptureState(root),
        bytes_tokens_pearson_r: pearson(
            withUsage
                .filter((s) => (s.counters.final_context_tokens as number) > 1_000)
                .map((s) => [s.bytes, s.counters.final_context_tokens as number]),
        ),
        provider_bytes: {
            factor: bytesFactor,
            median_final_context: derivedBytes(percentiles(finals)?.median ?? 0, finals.length > 0 ? bytesFactor : null),
        },
        threshold_crossings: crossings,
    };
}

function fmt(n: number): string {
    return Math.round(n).toLocaleString('en-US');
}

export function renderText(r: EolReport): string {
    const lines: string[] = [];
    lines.push(`session end-of-life baseline — ${r.root}`);
    lines.push(`files scanned: ${r.files_scanned} · sessions: ${r.sessions}`);
    lines.push(
        `  with parseable final usage: ${r.sessions_with_usage} · without (fallback set, 1.2): ${r.sessions_without_usage}`,
    );
    if (r.final_context_tokens) {
        const f = r.final_context_tokens;
        lines.push(
            `final context tokens: median=${fmt(f.median)} p90=${fmt(f.p90)} p95=${fmt(f.p95)} max=${fmt(f.max)}`,
        );
    }
    if (r.turns) {
        lines.push(`turns per session: median=${fmt(r.turns.median)} p90=${fmt(r.turns.p90)} max=${fmt(r.turns.max)}`);
    }
    const pb = r.provider_bytes;
    if (pb.factor === null || pb.median_final_context === null) {
        lines.push('provider bytes: basis unavailable - this store supplied no bytes-per-token factor');
    } else {
        lines.push(
            `provider bytes (basis: ${pb.median_final_context.basis}): median final context`
                + ` ~= ${fmt(pb.median_final_context.bytes)} bytes`,
        );
        lines.push(
            `  factor ${pb.factor.bytes_per_token.toFixed(4)} bytes/token (basis: ${pb.factor.basis},`
                + ` ${fmt(pb.factor.content_bytes)} content bytes / ${fmt(pb.factor.output_tokens)} output tokens,`
                + ` n=${pb.factor.records}) - measured on assistant output, applied to an input token count`,
        );
    }
    const c = r.compaction;
    lines.push(
        `compaction: ${c.sessions_with_compaction} sessions, ${c.events_total} events (${Object.entries(c.events_by_trigger)
            .map(([k, v]) => `${k}:${v}`)
            .join(', ') || 'none'})`,
    );
    if (c.pre_tokens) {
        lines.push(
            `  trigger pre-tokens: min=${fmt(c.pre_tokens.min)} median=${fmt(c.pre_tokens.median)} max=${fmt(c.pre_tokens.max)}`,
        );
    }
    // Step 2.2: the capture side, printed directly under the destruction side
    // so the two are read together. `join_basis` is printed every time — a
    // reader must not mistake an aggregate comparison for a per-session join.
    const cap = r.capture;
    if (cap.state_files === null) {
        lines.push(`  capture: no session-eol state directory — capture side UNOBSERVED (not zero)`);
    } else {
        lines.push(
            `  capture: ${cap.advisory_fired} of ${cap.state_files} state file(s) advised, ` +
                `${cap.advised_without_envelope} advised with no envelope [join: ${cap.join_basis}]`,
        );
    }
    if (c.post_tokens) {
        lines.push(`  post-tokens median=${fmt(c.post_tokens.median)}`);
    }
    lines.push(
        `  marker drift (${c.events_total} boundary vs ${c.compact_summary_records} summary records): ${c.marker_drift ? 'YES — detector shapes diverge, re-pin the fixture' : 'no'}`,
    );
    lines.push(
        `bytes↔tokens Pearson r (readable set): ${r.bytes_tokens_pearson_r === null ? 'n/a' : r.bytes_tokens_pearson_r.toFixed(3)}`,
    );
    for (const [k, v] of Object.entries(r.threshold_crossings)) {
        lines.push(`sessions ending ${k} tokens: ${v}`);
    }
    return lines.join('\n');
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const json = argv.includes('--json');
    const rootFlag = argv.indexOf('--root');
    const root =
        rootFlag !== -1 && argv[rootFlag + 1] ? path.resolve(argv[rootFlag + 1] as string) : DEFAULT_PROJECTS_ROOT;
    const report = buildReport(root);
    process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : `${renderText(report)}\n`);
    return 0;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
