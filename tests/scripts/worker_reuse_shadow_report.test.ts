// road-to-a-cold-start-paid-once 3.5 and 3.6: the shadow window as a report,
// and the activation policy's four flip conditions as code that never flips early.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { refFor } from '../../src/scripts/hooks/subagent_ledger_hook.js';

import { flipReadiness, summariseShadowWindow, type ShadowLine } from '../../src/scripts/worker_reuse_shadow_report.js';

const DAY = 86_400_000;
function spawn(tsMs: number, reuse: NonNullable<ShadowLine['reuse']>): ShadowLine {
    return { event: 'spawn_guard_shadow', ts: new Date(tsMs).toISOString(), tool: 'Agent', dispatch_kind: 'spawn', reuse };
}
const T0 = Date.parse('2026-10-22T00:00:00.000Z');

describe('worker reuse shadow window', () => {
    it('counts would-resume names and refusal reasons over the reuse-bearing lines only', () => {
        const lines: ShadowLine[] = [
            spawn(T0, { verdict: 'would_resume', name: 'w1', reasons: [] }),
            spawn(T0 + 1000, { verdict: 'fresh', name: null, reasons: ['ttl_expired', 'compacted'] }),
            spawn(T0 + 2000, { verdict: 'fresh', name: null, reasons: ['host_resume_unobserved'] }),
            { event: 'spawn_guard_shadow', ts: new Date(T0 + 3000).toISOString(), tool: 'SendMessage', dispatch_kind: 'resume' },
            { event: 'subagent_start', ts: new Date(T0).toISOString() } as ShadowLine,
        ];
        const w = summariseShadowWindow(lines);
        expect(w.agent_calls).toBe(3);
        expect(w.would_resume).toBe(1);
        expect(w.would_resume_by_name).toEqual({ w1: 1 });
        expect(w.refusal_reasons).toEqual({ compacted: 1, host_resume_unobserved: 1, ttl_expired: 1 });
        expect(w.resumes_observed).toBe(1);
    });

    it('a window in which every reuse was refused is a valid null, not an error', () => {
        const w = summariseShadowWindow([spawn(T0, { verdict: 'fresh', name: null, reasons: ['host_resume_unobserved'] })]);
        expect(w.would_resume).toBe(0);
        expect(w.null_window).toBe(true);
    });
});

describe('flip readiness — all four conditions, or shadow', () => {
    const big = Array.from({ length: 120 }, (_, i) => spawn(T0 + i * 1000, { verdict: i % 10 === 0 ? 'would_resume' : 'fresh', name: i % 10 === 0 ? 'w' : null, reasons: i % 10 === 0 ? [] : ['ttl_expired'] }));

    it('stays shadow while false positives and economics are unmeasured, whatever the window', () => {
        const r = flipReadiness(summariseShadowWindow(big), { false_positive_rate: null, cost_avoided: null, friction: null });
        expect(r.ready).toBe(false);
        expect(r.missing).toEqual(['false_positive_rate_measured', 'economics_measured']);
    });

    it('flips only when all four hold', () => {
        const r = flipReadiness(summariseShadowWindow(big), { false_positive_rate: 0.005, cost_avoided: 100, friction: 10 });
        expect(r.ready).toBe(true);
        expect(r.missing).toEqual([]);
    });

    it('a short window or no observed failure keeps it in shadow', () => {
        const short = flipReadiness(summariseShadowWindow(big.slice(0, 20)), { false_positive_rate: 0, cost_avoided: 100, friction: 1 });
        expect(short.missing).toContain('window_met');
        const twoWeeks = [spawn(T0, { verdict: 'fresh', name: null, reasons: ['ttl_expired'] }), spawn(T0 + 15 * DAY, { verdict: 'fresh', name: null, reasons: ['ttl_expired'] })];
        const noFailure = flipReadiness(summariseShadowWindow(twoWeeks), { false_positive_rate: 0, cost_avoided: 1, friction: 0 });
        expect(noFailure.missing).toEqual(['failure_observed']);
    });
});

// Council 2026-10-22 decision 1: the hook records only the precondition and the
// join keys; the report rebuilds each spawn's full verdict from the ledger and
// the stopped worker's transcript, labelled `reconstructed`.
import {
    freshColdStartByType,
    likeForLikeColdStartByType,
    reconstructFromDisk,
    readWorkerTranscripts,
    reconstructSpawnVerdicts,
    SECONDARY_C_LIKE_FOR_LIKE_LABEL,
    summariseReconstruction,
    type DefinitionFacts,
    type LedgerLine,
    type WorkerTranscript,
} from '../../src/scripts/worker_reuse_shadow_report.js';

describe('reconstructed reuse verdicts', () => {
    const S = 'session-1';
    const at = (s: number): string => new Date(T0 + s * 1000).toISOString();
    const stamp = { head: 'abc', cwd_key: 'cwd1', epoch: 7 };
    const defs: Record<string, DefinitionFacts> = { 'ac-researcher': { reuse: 'continuity', tier: 'lite' } };
    function worker(ref: string, nameKey: string, startS: number, stopS: number): LedgerLine[] {
        return [
            { event: 'subagent_start', ts: at(startS), ref, session_id: S, agent_type: 'ac-researcher' },
            { event: 'subagent_stop', ts: at(stopS), ref, session_id: S, agent_type: 'ac-researcher', ...stamp },
            { event: 'subagent_named', ts: at(stopS + 0.1), ref, name_key: nameKey, session_id: S },
        ];
    }
    function spawnAt(s: number, extra: Partial<LedgerLine> = {}): LedgerLine {
        return { event: 'spawn_guard_shadow', ts: at(s), tool: 'Agent', dispatch_kind: 'spawn', agent_type: 'ac-researcher', name_key: 'n2', ...stamp, ...extra };
    }
    const smallTranscript: WorkerTranscript = { calls: [{ ts: at(2), context_tokens: 4_000, input_tokens: 3_800 }], compact_ts: [] };

    it('positive control: a warm, small, same-workspace continuity worker yields would_resume', () => {
        const lines = [...worker('ref1', 'n1', 0, 5), spawnAt(10), { event: 'subagent_start', ts: at(10.1), ref: 'ref2', session_id: S, agent_type: 'ac-researcher' }];
        const out = reconstructSpawnVerdicts({
            lines,
            transcripts: new Map([['ref1', smallTranscript]]),
            definitions: defs,
            fresh_cold_start_by_type: { 'ac-researcher': 9_000 },
        });
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ verdict: 'would_resume', name: 'n1', basis: 'reconstructed' });
    });

    it('a worker over the observed fresh cold start, past its TTL, or in another epoch is refused with the reason', () => {
        const lines = [...worker('ref1', 'n1', 0, 5), spawnAt(400, { epoch: 8, session_id: S }), { event: 'subagent_start', ts: at(400.1), ref: 'ref2', session_id: S, agent_type: 'ac-researcher' }];
        const out = reconstructSpawnVerdicts({
            lines,
            transcripts: new Map([['ref1', smallTranscript]]),
            definitions: defs,
            fresh_cold_start_by_type: { 'ac-researcher': 3_000 },
        });
        // One epoch change is one reason: the epoch stands in for the package version only.
        expect(out[0]).toMatchObject({ verdict: 'fresh', reasons: ['cache_ttl_expired', 'transcript_over_cold_start', 'epoch_changed'] });
    });

    it('no observed fresh cold start refuses as no_observed_cold_start, never a constant', () => {
        const lines = [...worker('ref1', 'n1', 0, 5), spawnAt(10, { session_id: S })];
        const out = reconstructSpawnVerdicts({ lines, transcripts: new Map([['ref1', smallTranscript]]), definitions: defs, fresh_cold_start_by_type: {} });
        expect(out[0]).toMatchObject({ verdict: 'fresh', reasons: ['no_observed_cold_start'] });
    });

    it('an incomplete join is rejected with the missing field named, never read as fresh', () => {
        const lines = [...worker('ref1', 'n1', 0, 5), spawnAt(10, { session_id: S })];
        const out = reconstructSpawnVerdicts({ lines, transcripts: new Map(), definitions: defs, fresh_cold_start_by_type: { 'ac-researcher': 9_000 } });
        expect(out[0]).toMatchObject({ verdict: 'incomplete_join', missing: ['worker_transcript'] });
        const noType = reconstructSpawnVerdicts({ lines: [spawnAt(10, { agent_type: null })], transcripts: new Map(), definitions: defs, fresh_cold_start_by_type: {} });
        expect(noType[0]).toMatchObject({ verdict: 'incomplete_join', missing: ['agent_type', 'session_id'] });
        const s = summariseReconstruction([...out, ...noType]);
        expect(s.incomplete_joins).toBe(2);
        expect(s.incomplete_by_field).toEqual({ agent_type: 1, session_id: 1, worker_transcript: 1 });
        expect(s.window.agent_calls).toBe(0);
    });

    it('a worker still open at the spawn, or from another session, is not a candidate', () => {
        const open: LedgerLine[] = [...worker('ref1', 'n1', 0, 5), { event: 'subagent_start', ts: at(8), ref: 'ref1', session_id: S, agent_type: 'ac-researcher' }];
        const other = worker('ref9', 'n9', 0, 5).map((l) => ({ ...l, session_id: 'other' }));
        const out = reconstructSpawnVerdicts({
            lines: [...open, ...other, spawnAt(10, { session_id: S })],
            transcripts: new Map([['ref1', smallTranscript], ['ref9', smallTranscript]]),
            definitions: defs,
            fresh_cold_start_by_type: { 'ac-researcher': 9_000 },
        });
        expect(out[0]).toMatchObject({ verdict: 'fresh', reasons: ['no_candidate'] });
    });

    it('a definition without reuse: continuity, and a compacted transcript, refuse', () => {
        const lines = [...worker('ref1', 'n1', 0, 5), spawnAt(10, { session_id: S })];
        const out = reconstructSpawnVerdicts({
            lines,
            transcripts: new Map([['ref1', { calls: smallTranscript.calls, compact_ts: [at(3)] }]]),
            definitions: {},
            fresh_cold_start_by_type: { 'ac-researcher': 9_000 },
        });
        expect(out[0]).toMatchObject({ verdict: 'fresh', reasons: ['compacted', 'not_continuity'] });
    });

    it('fresh cold start per definition is the median of ordinal-1 runs only', () => {
        const m = freshColdStartByType(
            [
                { ref: 'a', ordinal: 1, calls: 1, first_call_written_or_uncached: 100, first_call_cache_read_share: 0 },
                { ref: 'b', ordinal: 1, calls: 1, first_call_written_or_uncached: 300, first_call_cache_read_share: 0 },
                { ref: 'a', ordinal: 2, calls: 1, first_call_written_or_uncached: 5, first_call_cache_read_share: 0 },
            ],
            [
                { event: 'subagent_start', ts: at(0), ref: 'a', agent_type: 'x' },
                { event: 'subagent_start', ts: at(1), ref: 'b', agent_type: 'x' },
            ],
        );
        expect(m).toEqual({ x: 200 });
    });

    it('an unrelated worker with missing data does not void the join', () => {
        const otherType: LedgerLine[] = worker('ref3', 'n3', 0, 6).map((l) => ({ ...l, agent_type: 'general-purpose' }));
        const lines = [...worker('ref1', 'n1', 0, 5), ...otherType, spawnAt(10, { session_id: S })];
        const out = reconstructSpawnVerdicts({
            lines,
            transcripts: new Map([['ref1', smallTranscript]]),
            definitions: { ...defs, 'general-purpose': { reuse: 'never', tier: 'inherit' } },
            fresh_cold_start_by_type: { 'ac-researcher': 9_000 },
        });
        expect(out[0]).toMatchObject({ verdict: 'would_resume', name: 'n1' });
        const noContinuity = reconstructSpawnVerdicts({
            lines: [...worker('ref1', 'n1', 0, 5), spawnAt(10, { session_id: S })],
            transcripts: new Map(),
            definitions: {},
            fresh_cold_start_by_type: { 'ac-researcher': 9_000 },
        });
        expect(noContinuity[0]).toMatchObject({ verdict: 'fresh', reasons: ['not_continuity'] });
    });

    it('a register that began before the window, or whose start is unseen, is unrecorded, never no_candidate', () => {
        const lines = [...worker('ref1', 'n1', 0, 5), spawnAt(10, { session_id: S })];
        const out = reconstructSpawnVerdicts({
            lines,
            transcripts: new Map([['ref1', smallTranscript]]),
            definitions: defs,
            fresh_cold_start_by_type: { 'ac-researcher': 9_000 },
            window_start: at(8),
        });
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ verdict: 'fresh', reasons: ['worker_register_unrecorded'] });
        const startless = worker('ref1', 'n1', 0, 5).filter((l) => l.event !== 'subagent_start');
        const out2 = reconstructSpawnVerdicts({
            lines: [...startless, spawnAt(10, { session_id: S })],
            transcripts: new Map([['ref1', smallTranscript]]),
            definitions: defs,
            fresh_cold_start_by_type: { 'ac-researcher': 9_000 },
        });
        expect(out2[0]).toMatchObject({ verdict: 'fresh', reasons: ['worker_register_unrecorded'] });
    });

    it('orders by instant, not by string: an offset timestamp before the spawn is before it', () => {
        const lines: LedgerLine[] = [
            { event: 'subagent_start', ts: '2026-10-22T01:00:00+01:00', ref: 'ref1', session_id: S, agent_type: 'ac-researcher' },
            { event: 'subagent_stop', ts: '2026-10-22T01:00:05+01:00', ref: 'ref1', session_id: S, agent_type: 'ac-researcher', ...stamp },
            { event: 'subagent_named', ts: '2026-10-22T01:00:05.5+01:00', ref: 'ref1', name_key: 'n1', session_id: S },
            spawnAt(10, { session_id: S }),
        ];
        const tr: WorkerTranscript = { calls: [{ ts: '2026-10-22T01:00:02+01:00', context_tokens: 4_000, input_tokens: 3_800 }], compact_ts: [] };
        const out = reconstructSpawnVerdicts({ lines, transcripts: new Map([['ref1', tr]]), definitions: defs, fresh_cold_start_by_type: { 'ac-researcher': 9_000 } });
        expect(out[0]).toMatchObject({ verdict: 'would_resume', name: 'n1' });
    });

    it('keeps the last streamed record per message id, so the last call counts its full output', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-tr-'));
        const rec = (out: number, ts: string): string =>
            JSON.stringify({ type: 'assistant', timestamp: ts, message: { id: 'm1', usage: { input_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 0, output_tokens: out } } });
        fs.writeFileSync(path.join(dir, 'agent-abc.jsonl'), `${rec(1, at(1))}\n${rec(50, at(2))}\n`);
        const t = readWorkerTranscripts(dir).get(refFor('abc'));
        expect(t?.calls).toEqual([{ ts: at(2), context_tokens: 160, input_tokens: 110 }]);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

describe('secondary reading c_like_for_like — pre-registered 2026-10-23, reported apart from the primary', () => {
    const S = 'session-1';
    const at = (s: number): string => new Date(T0 + s * 1000).toISOString();
    const stamp = { head: 'abc', cwd_key: 'cwd1', epoch: 7 };

    it('the threshold is the median first-call TOTAL input of fresh runs per definition', () => {
        const lines: LedgerLine[] = [
            { event: 'subagent_start', ts: at(0), ref: 'a', agent_type: 'x' },
            { event: 'subagent_start', ts: at(1), ref: 'b', agent_type: 'x' },
            { event: 'subagent_start', ts: at(2), ref: 'c', agent_type: 'x' },
        ];
        const tr = (first: number): WorkerTranscript => ({ calls: [{ ts: at(3), context_tokens: first + 5, input_tokens: first }, { ts: at(4), context_tokens: 99_999, input_tokens: 99_000 }], compact_ts: [] });
        const m = likeForLikeColdStartByType(new Map([['a', tr(1_000)], ['b', tr(7_000)], ['c', tr(9_000)]]), lines);
        expect(m).toEqual({ x: 7_000 });
    });

    it('a warm worker refused by the as-implemented (c) can pass the like-for-like (c), and the label says secondary', () => {
        const lines: LedgerLine[] = [
            { event: 'subagent_start', ts: at(0), ref: 'ref1', session_id: S, agent_type: 'ac-researcher' },
            { event: 'subagent_stop', ts: at(5), ref: 'ref1', session_id: S, agent_type: 'ac-researcher', ...stamp },
            { event: 'subagent_named', ts: at(5.1), ref: 'ref1', name_key: 'n1', session_id: S },
            { event: 'spawn_guard_shadow', ts: at(10), tool: 'Agent', dispatch_kind: 'spawn', agent_type: 'ac-researcher', session_id: S, ...stamp },
        ];
        const transcripts = new Map([['ref1', { calls: [{ ts: at(2), context_tokens: 7_000, input_tokens: 6_000 }], compact_ts: [] }]]);
        const base = { lines, transcripts, definitions: { 'ac-researcher': { reuse: 'continuity' as const, tier: 'lite' as const } } };
        const primary = reconstructSpawnVerdicts({ ...base, fresh_cold_start_by_type: { 'ac-researcher': 860 } });
        expect(primary[0]).toMatchObject({ verdict: 'fresh', reasons: ['transcript_over_cold_start'] });
        const secondary = reconstructSpawnVerdicts({ ...base, fresh_cold_start_by_type: likeForLikeColdStartByType(transcripts, [...lines, { event: 'subagent_start', ts: at(20), ref: 'ref2', agent_type: 'ac-researcher' }]) });
        expect(secondary[0]).toMatchObject({ verdict: 'fresh', reasons: ['transcript_over_cold_start'] });
        const wider = reconstructSpawnVerdicts({ ...base, fresh_cold_start_by_type: { 'ac-researcher': 7_500 } });
        expect(wider[0]).toMatchObject({ verdict: 'would_resume', name: 'n1' });
        expect(SECONDARY_C_LIKE_FOR_LIKE_LABEL).toMatch(/^secondary — pre-registered 2026-10-23 after the primary window/);
    });

    it('--until closes the window, so a re-run reads the window that was filed, not lines appended since', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-ledger-'));
        const spawnLine = (s: number): string => JSON.stringify({ event: 'spawn_guard_shadow', ts: at(s), tool: 'Agent', dispatch_kind: 'spawn', agent_type: 'x', session_id: S, ...stamp });
        fs.writeFileSync(path.join(dir, '2026-10.jsonl'), `${spawnLine(10)}\n${spawnLine(100)}\n`);
        const r = reconstructFromDisk({ ledgerDirs: [dir], transcriptRoots: [], definitionsDir: dir, since: at(5), until: at(50) }) as { summary: { spawns: number } };
        expect(r.summary.spawns).toBe(1);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
