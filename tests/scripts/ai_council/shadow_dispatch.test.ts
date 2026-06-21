// Tests for src/scripts/ai_council/shadow_dispatch.ts (py2ts Phase 1).
//
// Shadow-mode dispatch for low-impact solo decisions. Golden parity against
// the CPython twin covers: the seeded-rng Bernoulli sampler (PyRandom mirrors
// CPython's Mersenne-Twister `random()`), the JSONL row format (default
// json.dumps separators + ensure_ascii=True), the privacy-floor drop, the
// rolling-window disagreement / escalation rates over a fixed log, the SLO
// status thresholds, and the banner string (·, en-dash, em-dash literals +
// the `{:.1f}` banker's-rounding format).
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
import { hasPython3, oracleFile, runPyCode } from './_harness.js';

const py3 = hasPython3();

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

describe.runIf(py3)('shadow_dispatch — golden parity vs CPython twin', () => {
    it('should_shadow seeded-rng sequence matches CPython', () => {
        const code = [
            'import json, random, sys',
            'from scripts.ai_council.shadow_dispatch import should_shadow',
            'r = random.Random(int(sys.argv[1]))',
            'print(json.dumps([should_shadow(0.3, rng=r) for _ in range(8)]))',
        ].join('\n');
        const res = runPyCode(code, ['42']);
        expect(res.status, res.stderr).toBe(0);
        const expected = JSON.parse(res.stdout) as boolean[];
        const r = new PyRandom(42);
        const out: boolean[] = [];
        for (let i = 0; i < 8; i += 1) {
            out.push(should_shadow(0.3, { rng: r }));
        }
        expect(out).toEqual(expected);
    });

    it('compute_* + slo_banner match over the fixed log', () => {
        const log = tmpFile('s.jsonl', LOG_ROWS);
        const code = [
            'import json, sys',
            'from datetime import datetime, timezone',
            'from pathlib import Path',
            'from scripts.ai_council import shadow_dispatch as S',
            'now = datetime(2026, 6, 14, 0, 0, 0, tzinfo=timezone.utc)',
            'lp = Path(sys.argv[1])',
            'dr, dn = S.compute_disagreement_rate(lp, window_days=7, now=now)',
            'er, en = S.compute_escalation_rate(lp, window_days=7, now=now)',
            'print(json.dumps({',
            '  "dr": dr, "dn": dn, "er": er, "en": en,',
            '  "ok": S.slo_banner(0.0333, 30),',
            '  "warn": S.slo_banner(0.06, 50, escalation_rate=0.025),',
            '  "breach": S.slo_banner(0.095, 100),',
            '  "round_half_even": [S.slo_banner(0.025, 40), S.slo_banner(0.035, 40)],',
            '}, ensure_ascii=False))',
        ].join('\n');
        const res = runPyCode(code, [log]);
        expect(res.status, res.stderr).toBe(0);
        const exp = JSON.parse(res.stdout) as Record<string, unknown>;

        const [dr, dn] = compute_disagreement_rate(log, { windowDays: 7, now: new Date(NOW_MS) });
        const [er, en] = compute_escalation_rate(log, { windowDays: 7, now: new Date(NOW_MS) });
        expect(dr).toBe(exp['dr']);
        expect(dn).toBe(exp['dn']);
        expect(er).toBe(exp['er']);
        expect(en).toBe(exp['en']);
        expect(slo_banner(0.0333, 30)).toBe(exp['ok']);
        expect(slo_banner(0.06, 50, { escalationRate: 0.025 })).toBe(exp['warn']);
        expect(slo_banner(0.095, 100)).toBe(exp['breach']);
        expect([slo_banner(0.025, 40), slo_banner(0.035, 40)]).toEqual(exp['round_half_even']);
    });

    it('record_shadow_decision JSONL row matches (timestamp normalised)', () => {
        const tsLog = tmpFile('ts.jsonl', '');
        unlinkSync(tsLog);
        record_shadow_decision(tsLog, {
            query: 'café query with emoji 😀 and ports',
            soloVerdict: 'yes',
            fullVerdict: 'no',
            escalated: true,
            escalationReason: 'low-conf',
        });
        const tsRow = readFileSync(tsLog, { encoding: 'utf-8' }).replace(
            /"timestamp": "[^"]+"/u,
            '"timestamp": "<TS>"',
        );

        // Oracle v3 — the observable python artefact is the WRITTEN LOG FILE,
        // not stdout. The log path is baked into the code body (not passed as
        // argv): a volatile path passed as an ARG keys on the file's
        // post-write contents, which embed a live timestamp → the snapshot key
        // drifts on every capture. Baking it inline collapses the quoted path
        // to `<abspath>` (stableInlineKeyMaterial), so the key stays stable.
        const pyLog = tmpFile('py.jsonl', '');
        const code = [
            'from pathlib import Path',
            'from scripts.ai_council.shadow_dispatch import record_shadow_decision',
            `lp = Path(${JSON.stringify(pyLog)})`,
            'record_shadow_decision(lp, query="café query with emoji 😀 and ports",'
                + ' solo_verdict="yes", full_verdict="no", escalated=True,'
                + ' escalation_reason="low-conf")',
        ].join('\n');
        const res = runPyCode(code, [], { outputs: { log: pyLog } });
        expect(res.status, res.stderr).toBe(0);
        const py = oracleFile(res, 'log');
        expect(py, 'frozen python log must exist').not.toBeNull();
        const pyRow = (py as Buffer).toString('utf-8').replace(
            /"timestamp": "[^"]+"/u,
            '"timestamp": "<TS>"',
        );
        expect(tsRow).toBe(pyRow);
    });

    it('privacy-drop returns None on both sides', () => {
        const code = [
            'import json, sys',
            'from pathlib import Path',
            'from scripts.ai_council.shadow_dispatch import record_shadow_decision',
            'lp = Path(sys.argv[1])',
            'r = record_shadow_decision(lp, query="Authorization: Bearer zzz",'
                + ' solo_verdict="a", full_verdict="a")',
            'print(json.dumps(r is None))',
        ].join('\n');
        const pyLog = tmpFile('p.jsonl', '');
        const res = runPyCode(code, [pyLog]);
        expect(res.status, res.stderr).toBe(0);
        expect(JSON.parse(res.stdout)).toBe(true);

        const tsLog = tmpFile('t.jsonl', '');
        unlinkSync(tsLog);
        const dropped = record_shadow_decision(tsLog, {
            query: 'Authorization: Bearer zzz',
            soloVerdict: 'a',
            fullVerdict: 'a',
        });
        expect(dropped).toBeNull();
    });
});
