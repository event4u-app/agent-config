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

    it('reserved schema fields win over pass-through collisions', () => {
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

describe('events_log — quorum attendance (schema v2)', () => {
    function readOne(lp: string): Record<string, unknown> {
        return JSON.parse(fs.readFileSync(lp, 'utf-8').trim()) as Record<string, unknown>;
    }

    it('writes a quorum_result line carrying the attendance shape', () => {
        const lp = path.join(tmpDir(), 'q.log');
        expect(
            appendQuorumEvent(
                {
                    lens: 'security',
                    invocation: 'agent',
                    phase: 'post_run',
                    status: 'concluded',
                    threshold: 1,
                    total: 2,
                    present: 1,
                    absent: [{ member: 'openai', reason: 'quota' }],
                },
                { logPath: lp, now: FIXED },
            ),
        ).toBe(true);
        const rec = readOne(lp);
        expect(rec.action).toBe('quorum_result');
        expect(rec.verdict).toBe('concluded');
        expect(rec.phase).toBe('post_run');
        expect(rec.threshold).toBe(1);
        expect(rec.total).toBe(2);
        expect(rec.present).toBe(1);
        expect(rec.absent).toEqual([{ member: 'openai', reason: 'quota' }]);
        expect(rec.schema_version).toBe(SCHEMA_VERSION);
    });

    it('distinguishes a solo conclusion from full attendance in the log', () => {
        const lp = path.join(tmpDir(), 'q2.log');
        const base = {
            lens: '',
            invocation: '',
            phase: 'pre_run',
            status: 'concluded',
            threshold: 1,
            total: 2,
        } as const;
        appendQuorumEvent({ ...base, present: 1, absent: [{ member: 'openai', reason: 'no_auth' }] }, { logPath: lp, now: FIXED });
        appendQuorumEvent({ ...base, present: 2, absent: [] }, { logPath: lp, now: FIXED });
        const lines = fs
            .readFileSync(lp, 'utf-8')
            .trim()
            .split('\n')
            .map((l) => JSON.parse(l) as Record<string, unknown>);
        // Both concluded — the only thing that tells them apart is present/absent,
        // which is the whole point of the record.
        expect(lines.map((l) => l.verdict)).toEqual(['concluded', 'concluded']);
        expect(lines.map((l) => l.present)).toEqual([1, 2]);
        expect(lines.map((l) => (l.absent as unknown[]).length)).toEqual([1, 0]);
    });

    it('carries no free-form field a detail string could land in', () => {
        const lp = path.join(tmpDir(), 'q3.log');
        appendQuorumEvent(
            {
                lens: '',
                invocation: '',
                phase: 'post_run',
                status: 'inconclusive',
                threshold: 2,
                total: 2,
                present: 0,
                // A caller handing over the CLI's own richer dict must not be
                // able to smuggle `detail` (provider error text, which can embed
                // paths and prompt fragments) through the typed surface.
                absent: [{ member: 'anthropic', reason: 'timeout', detail: '/Users/me/secret' } as never],
            },
            { logPath: lp, now: FIXED },
        );
        const rec = readOne(lp);
        expect(rec.absent).toEqual([{ member: 'anthropic', reason: 'timeout' }]);
        expect(JSON.stringify(rec)).not.toContain('secret');
    });

    it('fails open — an unwritable target returns false instead of throwing', () => {
        const dir = tmpDir();
        const blocker = path.join(dir, 'blocked');
        fs.writeFileSync(blocker, 'not a directory');
        // `blocker` is a file, so mkdir of `blocker/x` raises ENOTDIR inside
        // appendEvent — attendance telemetry must swallow it.
        expect(
            appendQuorumEvent(
                {
                    lens: '',
                    invocation: '',
                    phase: 'pre_run',
                    status: 'concluded',
                    threshold: 1,
                    total: 1,
                    present: 1,
                    absent: [],
                },
                { logPath: path.join(blocker, 'x', 'q.log'), now: FIXED },
            ),
        ).toBe(false);
    });

    it('honours the kill-switch like every other event', () => {
        process.env.AGENT_CONFIG_NO_EVENTS_LOG = '1';
        const lp = path.join(tmpDir(), 'q4.log');
        expect(
            appendQuorumEvent(
                {
                    lens: '',
                    invocation: '',
                    phase: 'pre_run',
                    status: 'concluded',
                    threshold: 1,
                    total: 1,
                    present: 1,
                    absent: [],
                },
                { logPath: lp },
            ),
        ).toBe(false);
        expect(fs.existsSync(lp)).toBe(false);
    });
});

