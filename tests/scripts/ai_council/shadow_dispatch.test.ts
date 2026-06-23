// Tests for src/scripts/ai_council/shadow_dispatch.ts (py2ts Phase 1).
//
// Shadow-mode dispatch for low-impact solo decisions: the seeded-rng Bernoulli
// sampler (PyRandom mirrors CPython's Mersenne-Twister `random()`), the JSONL
// row format, the privacy-floor drop, the rolling-window disagreement /
// escalation rates over a fixed log, the SLO status thresholds, and the banner
// string.
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PyRandom } from '../../../src/scripts/_lib/py_random.js';
import {
    SLO_THRESHOLD_BREACH,
    SLO_THRESHOLD_WARN,
    compute_disagreement_rate,
    compute_escalation_rate,
    record_shadow_decision,
    should_shadow,
    slo_banner,
    slo_status,
} from '../../../src/scripts/ai_council/shadow_dispatch.js';

// A fixed log with three in-window rows (2/3 disagree, 1/3 escalated), one
// out-of-window row, one garbage line, and one unparsable-timestamp row.
const LOG_ROWS = [
    '{"timestamp": "2026-06-10T00:00:00+00:00", "query_hash": "aa", "solo_verdict": "x", "full_verdict": "x", "agreed": true, "escalated": false, "escalation_reason": "ok"}',
    '{"timestamp": "2026-06-10T00:00:00+00:00", "query_hash": "bb", "solo_verdict": "x", "full_verdict": "y", "agreed": false, "escalated": true, "escalation_reason": "low-conf"}',
    '{"timestamp": "2026-06-10T00:00:00+00:00", "query_hash": "cc", "solo_verdict": "x", "full_verdict": "z", "agreed": false, "escalated": false, "escalation_reason": "ok"}',
    '{"timestamp": "2026-01-01T00:00:00Z", "query_hash": "old", "agreed": false, "escalated": true}',
    'garbage line not json',
    '{"timestamp": "not-a-date", "agreed": false}',
    '',
].join('\n');

const NOW_MS = Date.UTC(2026, 5, 14, 0, 0, 0); // 2026-06-14T00:00:00Z

function tmpFile(name: string, content: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'shadow-'));
    const p = path.join(dir, name);
    writeFileSync(p, content, { encoding: 'utf-8' });
    return p;
}

describe('shadow_dispatch — pure functions', () => {
    it('should_shadow with a seeded rng is deterministic', () => {
        const r = new PyRandom(42);
        const out: boolean[] = [];
        for (let i = 0; i < 8; i += 1) {
            out.push(should_shadow(0.3, { rng: r }));
        }
        expect(out).toEqual([false, true, true, true, false, false, false, true]);
    });

    it('should_shadow clamps the rate to [0, 1]', () => {
        // rate <= 0 → never (random() is always >= 0); rate >= 1 → always.
        expect(should_shadow(-5, { rng: new PyRandom(1) })).toBe(false);
        expect(should_shadow(5, { rng: new PyRandom(1) })).toBe(true);
    });

    it('slo_status thresholds', () => {
        expect(slo_status(0.0)).toBe('OK');
        expect(slo_status(SLO_THRESHOLD_WARN - 0.001)).toBe('OK');
        expect(slo_status(SLO_THRESHOLD_WARN)).toBe('WARN');
        expect(slo_status(SLO_THRESHOLD_BREACH - 0.001)).toBe('WARN');
        expect(slo_status(SLO_THRESHOLD_BREACH)).toBe('BREACH');
        expect(slo_status(0.5)).toBe('BREACH');
    });

    it('slo_banner no-samples short-circuit', () => {
        expect(slo_banner(0.0, 0)).toBe('[shadow SLO] no samples yet');
    });

    it('compute_* over the fixed window', () => {
        const log = tmpFile('s.jsonl', LOG_ROWS);
        expect(compute_disagreement_rate(log, { windowDays: 7, now: new Date(NOW_MS) })).toEqual([
            2 / 3,
            3,
        ]);
        expect(compute_escalation_rate(log, { windowDays: 7, now: new Date(NOW_MS) })).toEqual([
            1 / 3,
            3,
        ]);
    });

    it('compute_* on a missing log → [0, 0]', () => {
        expect(compute_disagreement_rate('/no/such/log.jsonl')).toEqual([0.0, 0]);
        expect(compute_escalation_rate('/no/such/log.jsonl')).toEqual([0.0, 0]);
    });

    it('record_shadow_decision drops a privacy-violating query', () => {
        const log = tmpFile('rec.jsonl', '');
        unlinkSync(log);
        const dropped = record_shadow_decision(log, {
            query: 'Authorization: Bearer something',
            soloVerdict: 'a',
            fullVerdict: 'a',
        });
        expect(dropped).toBeNull();
    });

    it('record_shadow_decision appends a JSONL row + sets agreed', () => {
        const log = tmpFile('rec.jsonl', '');
        unlinkSync(log);
        const d = record_shadow_decision(log, {
            query: 'plain query about ports',
            soloVerdict: 'yes',
            fullVerdict: 'no',
            escalated: true,
            escalationReason: 'low-conf',
        });
        expect(d).not.toBeNull();
        expect(d?.agreed).toBe(false);
        const row = JSON.parse(readFileSync(log, { encoding: 'utf-8' }).trim());
        expect(row.solo_verdict).toBe('yes');
        expect(row.escalated).toBe(true);
        expect(row.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/u);
    });
});
