// Tests for src/scripts/ai_council/events_log.ts (py2ts Phase 1).
//
// Appends one JSON line per council event. The only non-determinism is
// `ts_utc` (wall-clock); the TS twin accepts an injectable `now` for unit
// tests.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    SCHEMA_VERSION,
    appendEvent,
    appendQuorumEvent,
    defaultLogPath,
    type QuorumEventInput,
} from '../../../src/scripts/ai_council/events_log.js';

const created: string[] = [];
function tmpDir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'el-test-'));
    created.push(d);
    return d;
}
afterEach(() => {
    delete process.env.AGENT_CONFIG_NO_EVENTS_LOG;
    while (created.length) {
        fs.rmSync(created.pop()!, { recursive: true, force: true });
    }
});

const FIXED = new Date(Date.UTC(2026, 5, 14, 8, 30, 15));

describe('events_log — write + schema', () => {
    it('writes a v1 record, injects hash, pops original_ask', () => {
        const lp = path.join(tmpDir(), 'events.log');
        const event: Record<string, unknown> = {
            lens: 'security',
            invocation: '/council',
            action: 'skip_necessity',
            verdict: 'no',
            provider_caps: { api: true },
            original_ask: 'Why skip this?',
            category: 'extra',
        };
        expect(appendEvent(event, { logPath: lp, now: FIXED })).toBe(true);
        expect('original_ask' in event).toBe(false); // popped (Python side effect)

        const rec = JSON.parse(fs.readFileSync(lp, 'utf-8').trim()) as Record<string, unknown>;
        expect(rec.schema_version).toBe(SCHEMA_VERSION);
        expect(rec.ts_utc).toBe('2026-06-14T08:30:15Z');
        expect(rec.lens).toBe('security');
        expect(rec.action).toBe('skip_necessity');
        expect(rec.provider_caps).toEqual({ api: true });
        expect(rec.original_ask_hash).toMatch(/^[0-9a-f]{12}$/);
        expect('original_ask' in rec).toBe(false);
        expect(rec.category).toBe('extra'); // pass-through
    });

    it('empty original_ask → sentinel hash', () => {
        const lp = path.join(tmpDir(), 'e.log');
        appendEvent({ action: 'proceed' }, { logPath: lp, now: FIXED });
        const rec = JSON.parse(fs.readFileSync(lp, 'utf-8').trim()) as Record<string, unknown>;
        expect(rec.original_ask_hash).toBe('000000000000');
    });

    it('appends (does not truncate) across calls', () => {
        const lp = path.join(tmpDir(), 'multi.log');
        appendEvent({ action: 'proceed' }, { logPath: lp, now: FIXED });
        appendEvent({ action: 'block_quota' }, { logPath: lp, now: FIXED });
        const lines = fs.readFileSync(lp, 'utf-8').trimEnd().split('\n');
        expect(lines).toHaveLength(2);
    });

    it('creates the parent dir on demand', () => {
        const lp = path.join(tmpDir(), 'nested', 'deep', 'events.log');
        expect(appendEvent({ action: 'proceed' }, { logPath: lp, now: FIXED })).toBe(true);
        expect(fs.existsSync(lp)).toBe(true);
    });

    it('reserved fields win over pass-through collisions', () => {
        const lp = path.join(tmpDir(), 'c.log');
        appendEvent(
            { action: 'proceed', lens: 'real', schema_version: 999, ts_utc: 'fake' },
            { logPath: lp, now: FIXED },
        );
        const rec = JSON.parse(fs.readFileSync(lp, 'utf-8').trim()) as Record<string, unknown>;
        expect(rec.schema_version).toBe(SCHEMA_VERSION);
        expect(rec.ts_utc).toBe('2026-06-14T08:30:15Z');
        expect(rec.lens).toBe('real');
    });

    it('SCHEMA_VERSION is 2 — the quorum_result action shipped', () => {
        // Pinned as a literal on purpose: a bump is a consumer-visible event,
        // so it must be a deliberate edit here, not something a constant
        // change carries silently past the suite.
        expect(SCHEMA_VERSION).toBe(2);
    });

    it('invalid action throws (Python ValueError parity)', () => {
        expect(() => appendEvent({ action: 'nope' }, { logPath: path.join(tmpDir(), 'x.log') })).toThrow(
            "events_log: action='nope' not in ['block_quota', 'proceed', 'quorum_result', 'skip_necessity'].",
        );
    });

    it('missing action throws with None repr', () => {
        expect(() => appendEvent({}, { logPath: path.join(tmpDir(), 'x.log') })).toThrow(
            "events_log: action=None not in ['block_quota', 'proceed', 'quorum_result', 'skip_necessity'].",
        );
    });

    it('kill-switch suppresses the write (returns false, no file)', () => {
        process.env.AGENT_CONFIG_NO_EVENTS_LOG = '1';
        const lp = path.join(tmpDir(), 'killed.log');
        expect(appendEvent({ action: 'proceed' }, { logPath: lp })).toBe(false);
        expect(fs.existsSync(lp)).toBe(false);
    });

    it('kill-switch falsy values do NOT suppress', () => {
        const lp = path.join(tmpDir(), 'k.log');
        for (const v of ['', '0', 'false', 'False']) {
            process.env.AGENT_CONFIG_NO_EVENTS_LOG = v;
            expect(appendEvent({ action: 'proceed' }, { logPath: lp, now: FIXED })).toBe(true);
        }
    });

    it('defaultLogPath ends with the canonical suffix', () => {
        expect(defaultLogPath().endsWith(path.join('agents', 'runtime', 'council', 'events.log'))).toBe(
            true,
        );
    });
});

describe('events_log — quorum_result (schema v2)', () => {
    function input(over: Partial<QuorumEventInput> = {}): QuorumEventInput {
        return {
            status: 'concluded',
            threshold: 1,
            total: 2,
            present: 1,
            absent: [{ member: 'openai', reason: 'no_binary' }],
            stage: 'post_run',
            solo_concluded: true,
            ...over,
        };
    }
    function readOne(lp: string): Record<string, unknown> {
        return JSON.parse(fs.readFileSync(lp, 'utf-8').trim()) as Record<string, unknown>;
    }

    it('writes every attendance field a rate is computed over', () => {
        const lp = path.join(tmpDir(), 'q.log');
        expect(appendQuorumEvent(input(), { logPath: lp, now: FIXED })).toBe(true);
        const rec = readOne(lp);
        expect(rec.action).toBe('quorum_result');
        expect(rec.schema_version).toBe(SCHEMA_VERSION);
        expect(rec.status).toBe('concluded');
        expect(rec.threshold).toBe(1);
        expect(rec.total).toBe(2);
        expect(rec.present).toBe(1);
        expect(rec.solo_concluded).toBe(true);
        expect(rec.stage).toBe('post_run');
        expect(rec.absent).toEqual([{ member: 'openai', reason: 'no_binary' }]);
    });

    it('a full-attendance pass is distinguishable from a solo-concluded one', () => {
        // The whole point of the action: before it, these two wrote nothing
        // and were downstream-identical.
        const lp = path.join(tmpDir(), 'both.log');
        appendQuorumEvent(input({ present: 2, absent: [], solo_concluded: false }), {
            logPath: lp,
            now: FIXED,
        });
        appendQuorumEvent(input(), { logPath: lp, now: FIXED });
        const lines = fs
            .readFileSync(lp, 'utf-8')
            .trimEnd()
            .split('\n')
            .map((l) => JSON.parse(l) as Record<string, unknown>);
        expect(lines.map((l) => l.solo_concluded)).toEqual([false, true]);
        expect(lines.map((l) => l.present)).toEqual([2, 1]);
    });

    it('both stages emit and are told apart by the stage field', () => {
        const lp = path.join(tmpDir(), 'stages.log');
        appendQuorumEvent(input({ stage: 'construction' }), { logPath: lp, now: FIXED });
        appendQuorumEvent(input({ stage: 'post_run' }), { logPath: lp, now: FIXED });
        const stages = fs
            .readFileSync(lp, 'utf-8')
            .trimEnd()
            .split('\n')
            .map((l) => (JSON.parse(l) as Record<string, unknown>).stage);
        expect(stages).toEqual(['construction', 'post_run']);
    });

    it('an absent entry carries member + reason and NOTHING else', () => {
        // PII-exclusion by construction: both call sites hold a raw provider
        // error string next to member/reason. A caller that casts past the
        // type still must not get free-form text into the log.
        const lp = path.join(tmpDir(), 'pii.log');
        const smuggled = [
            { member: 'anthropic', reason: 'timeout', detail: '/Users/real/name secret-token' },
        ] as unknown as QuorumEventInput['absent'];
        appendQuorumEvent(input({ absent: smuggled }), { logPath: lp, now: FIXED });
        const raw = fs.readFileSync(lp, 'utf-8');
        expect(raw).not.toContain('secret-token');
        expect(raw).not.toContain('/Users/real');
        const entries = readOne(lp).absent as Record<string, unknown>[];
        expect(Object.keys(entries[0]!).sort()).toEqual(['member', 'reason']);
    });

    it('every absent-reason token in the union round-trips', () => {
        const lp = path.join(tmpDir(), 'reasons.log');
        const tokens = [
            'no_binary',
            'no_auth',
            'timeout',
            'quota',
            'unavailable',
            'binary_missing',
        ] as const;
        for (const reason of tokens) {
            appendQuorumEvent(input({ absent: [{ member: 'm', reason }] }), {
                logPath: lp,
                now: FIXED,
            });
        }
        const seen = fs
            .readFileSync(lp, 'utf-8')
            .trimEnd()
            .split('\n')
            .map((l) => ((JSON.parse(l) as Record<string, unknown>).absent as { reason: string }[])[0]!.reason);
        expect(seen).toEqual([...tokens]);
    });

    it('fail-open: an unwritable path returns false instead of throwing', () => {
        // A file where a directory must be — mkdirSync throws ENOTDIR.
        const dir = tmpDir();
        const blocker = path.join(dir, 'blocked');
        fs.writeFileSync(blocker, 'not a directory');
        expect(() =>
            expect(appendQuorumEvent(input(), { logPath: path.join(blocker, 'q.log') })).toBe(false),
        ).not.toThrow();
    });

    it('kill-switch suppresses the quorum write too', () => {
        process.env.AGENT_CONFIG_NO_EVENTS_LOG = '1';
        const lp = path.join(tmpDir(), 'killed-q.log');
        expect(appendQuorumEvent(input(), { logPath: lp })).toBe(false);
        expect(fs.existsSync(lp)).toBe(false);
    });

    it('an empty absent list is written, not omitted', () => {
        const lp = path.join(tmpDir(), 'empty.log');
        appendQuorumEvent(input({ present: 2, absent: [], solo_concluded: false }), {
            logPath: lp,
            now: FIXED,
        });
        expect(readOne(lp).absent).toEqual([]);
    });

    it('an inconclusive pass is recorded, not dropped', () => {
        const lp = path.join(tmpDir(), 'inc.log');
        appendQuorumEvent(
            input({
                status: 'inconclusive',
                threshold: 2,
                total: 3,
                present: 1,
                solo_concluded: false,
            }),
            { logPath: lp, now: FIXED },
        );
        const rec = readOne(lp);
        expect(rec.status).toBe('inconclusive');
        expect(rec.verdict).toBe('inconclusive');
    });
});

