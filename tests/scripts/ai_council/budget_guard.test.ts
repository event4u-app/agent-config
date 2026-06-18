// Tests for src/scripts/ai_council/budget_guard.ts (py2ts Phase 1).
//
// Mirrors the Python suite tests/ai_council/test_budget_guard.py plus a
// JSONL byte-parity differential against python3 (the ledger line is the
// observable artefact). `now` is injected everywhere so nothing depends on
// the wall clock.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    LEDGER_FILENAME,
    ROLLING_WINDOW_HOURS,
    read_entries,
    record_spend,
    today_spend_usd,
    would_exceed,
} from '../../../src/scripts/ai_council/budget_guard.js';
import { hasPython3, oracleFile, runPyCode } from './_harness.js';

const py3 = hasPython3();

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'budguard-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length) {
        fs.rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
    }
});

// Fixed injected "now" == 2026-05-02T12:00:00Z (matches the Python suite).
const NOW = Date.UTC(2026, 4, 2, 12, 0, 0);

describe('budget_guard — constants', () => {
    it('mirrors the Python module constants', () => {
        expect(LEDGER_FILENAME).toBe('council-spend.jsonl');
        expect(ROLLING_WINDOW_HOURS).toBe(24);
    });
});

describe('budget_guard — empty ledger', () => {
    it('reports zero spend on a missing ledger', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        expect(today_spend_usd({ path: p, now: NOW })).toBe(0.0);
    });

    it('read_entries on a missing ledger is []', () => {
        const p = path.join(mkTmp(), 'nope.jsonl');
        expect(read_entries(p)).toEqual([]);
    });
});

describe('budget_guard — record_spend', () => {
    it('creates the ledger mode 0600', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        expect(record_spend(0.05, 'anthropic', 'x', { path: p, now: NOW })).toBe(true);
        expect(fs.existsSync(p)).toBe(true);
        expect(fs.statSync(p).mode & 0o777).toBe(0o600);
    });

    it('zero or negative spend is a no-op (returns true, no ledger written)', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        expect(record_spend(0.0, 'manual', 'x', { path: p, now: NOW })).toBe(true);
        expect(record_spend(-1.0, 'manual', 'x', { path: p, now: NOW })).toBe(true);
        expect(fs.existsSync(p)).toBe(false);
    });

    it('appends one entry per call', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        record_spend(0.01, 'a', 'm1', { path: p, now: NOW });
        record_spend(0.02, 'b', 'm2', { path: p, now: NOW });
        const lines = fs.readFileSync(p, 'utf-8').trimEnd().split('\n');
        expect(lines.length).toBe(2);
        expect(read_entries(p).map((e) => e.usd)).toEqual([0.01, 0.02]);
    });
});

describe('budget_guard — today_spend_usd (rolling window)', () => {
    it('sums entries within the window and drops stale ones', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        // 23h ago — inside window.
        record_spend(0.10, 'a', 'm', { path: p, now: NOW - 23 * 3600 * 1000 });
        // 25h ago — outside the 24h window.
        record_spend(0.20, 'b', 'm', { path: p, now: NOW - 25 * 3600 * 1000 });
        // now.
        record_spend(0.05, 'c', 'm', { path: p, now: NOW });
        expect(today_spend_usd({ path: p, now: NOW })).toBeCloseTo(0.15, 10);
    });

    it('honours a custom windowHours', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        record_spend(0.10, 'a', 'm', { path: p, now: NOW - 5 * 3600 * 1000 });
        expect(today_spend_usd({ path: p, now: NOW, windowHours: 1 })).toBe(0.0);
        expect(today_spend_usd({ path: p, now: NOW, windowHours: 6 })).toBeCloseTo(0.10, 10);
    });
});

describe('budget_guard — would_exceed', () => {
    it('limit <= 0 disables the guard', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        expect(would_exceed(0, 100, { path: p, now: NOW })).toBe(false);
        expect(would_exceed(-5, 100, { path: p, now: NOW })).toBe(false);
    });

    it('returns true only when spent + next pushes past the limit', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        record_spend(0.80, 'a', 'm', { path: p, now: NOW });
        expect(would_exceed(1.0, 0.10, { path: p, now: NOW })).toBe(false); // 0.90 <= 1.0
        expect(would_exceed(1.0, 0.25, { path: p, now: NOW })).toBe(true); // 1.05 > 1.0
    });

    it('exactly at the limit does not exceed (strict >)', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        record_spend(0.50, 'a', 'm', { path: p, now: NOW });
        expect(would_exceed(1.0, 0.50, { path: p, now: NOW })).toBe(false); // 1.0 == 1.0
    });
});

describe('budget_guard — read_entries robustness', () => {
    it('skips malformed and offset-less lines silently', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        fs.writeFileSync(
            p,
            [
                '{"ts": "2026-05-02T12:00:00+00:00", "usd": 0.05, "provider": "a", "model": "m"}',
                'not json',
                '{"ts": "not-a-date", "usd": 1.0}',
                '{"ts": "2026-05-02T12:00:00", "usd": 9.0}', // no offset → naive → skipped
                '   ',
                '{"ts": "2026-05-02T11:00:00+00:00", "usd": "0.30", "provider": "b", "model": "n"}',
            ].join('\n') + '\n',
            'utf-8',
        );
        const entries = read_entries(p);
        expect(entries.length).toBe(2);
        expect(entries[0]?.usd).toBe(0.05);
        expect(entries[1]?.usd).toBeCloseTo(0.3, 10);
    });
});

describe.skipIf(!py3)('budget_guard — JSONL byte-parity vs python3', () => {
    // Record an identical sequence in both runtimes against a pinned `now` and
    // diff the raw ledger bytes. Covers the float-repr edge cases where JS
    // String() diverges from Python repr (1.0, 1e-05, 1e-06, 0.3).
    const cases: Array<[number, string, string]> = [
        [0.05, 'anthropic', 'claude-sonnet-4-5'],
        [0.000123, 'openai', 'gpt-4o'],
        [1.0, 'x', 'y'],
        [0.00001, 'z', 'w'],
        [12.5, 'a', 'b'],
        [0.0000012, 'p', 'q'],
        [0.30000000000000004, 'r', 's'],
        [0.123456789, 'rounding', 'six'], // round(.,6) → 0.123457
    ];

    it('produces byte-identical ledger lines', () => {
        const tsPath = path.join(mkTmp(), 'ts.jsonl');
        for (const [usd, prov, mod] of cases) {
            record_spend(usd, prov, mod, { path: tsPath, now: NOW });
        }
        const tsBytes = fs.readFileSync(tsPath, 'utf-8');

        const pyPath = path.join(mkTmp(), 'py.jsonl');
        // The output path is baked into the code body (not passed as argv): the
        // inline-code key collapses quoted absolute paths to `<abspath>`
        // (stableInlineKeyMaterial), so the snapshot key stays stable across the
        // capture run (file present) and every replay run (fresh tmp dir). A
        // volatile path passed as an ARG would key on file existence/content and
        // diverge capture-vs-replay.
        const code = [
            'import datetime as dt',
            'from pathlib import Path',
            'from scripts.ai_council.budget_guard import record_spend',
            `p = ${JSON.stringify(pyPath)}`,
            'now = dt.datetime(2026,5,2,12,0,tzinfo=dt.timezone.utc)',
            `cases = ${JSON.stringify(cases)}`,
            // JSON.stringify drops the `.0` on integer-valued floats (1.0 → 1),
            // so coerce every usd back to a Python float — record_spend's real
            // caller always passes a float (JS has one number type → always a
            // float in TS). This keeps the int/float distinction faithful.
            'for usd,prov,mod in cases:',
            '    record_spend(float(usd),prov,mod,path=Path(p),now=now)',
        ].join('\n');
        // Oracle v3 — the observable python artefact is the WRITTEN LEDGER FILE,
        // not stdout. Declare it as a frozen output: capture mode reads pyPath
        // after the spawn and freezes its bytes; normal mode replays them with no
        // live python3. Compare the .ts twin's own bytes against the frozen golden.
        const res = runPyCode(code, [], { outputs: { ledger: pyPath } });
        expect(res.status, res.stderr).toBe(0);
        const ledger = oracleFile(res, 'ledger');
        expect(ledger, 'frozen python ledger must exist').not.toBeNull();
        const pyBytes = (ledger as Buffer).toString('utf-8');

        expect(tsBytes).toBe(pyBytes);
    });
});
