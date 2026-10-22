// Tests for src/scripts/ai_council/budget_guard.ts (py2ts Phase 1).
//
// Mirrors the Python suite tests/ai_council/test_budget_guard.py plus a
// JSONL byte-parity differential against python3 (the ledger line is the
// observable artefact). `now` is injected everywhere so nothing depends on
// the wall clock.
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    LEDGER_FILENAME,
    ROLLING_WINDOW_HOURS,
    close_reservation,
    read_entries,
    record_spend,
    reservation_states,
    reserve_spend,
    type SpendState,
    today_spend_summary,
    today_spend_usd,
    would_exceed,
} from '../../../src/scripts/ai_council/budget_guard.js';
import { CouncilResponse, type ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import type { CostEstimate } from '../../../src/scripts/ai_council/pricing.js';
import { RoundReservations, outcomeIsUnknown } from '../../../src/scripts/ai_council/round_reservations.js';
import { CostBudget } from '../../../src/scripts/ai_council/spend_gate.js';
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

// road-to-unknowns-that-say-so 2.3. A billable call on a model the price table
// does not list used to arrive here as `usd: 0` and vanish behind the
// zero-cost early return, indistinguishable from a subscription call. It now
// leaves a row that says what it is, with the tokens it actually used.
describe('budget_guard — unpriced calls reach the ledger', () => {
    it('unpriced-row-is-appended', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        expect(
            record_spend(0, 'anthropic', 'claude-opus-4-5', {
                path: p,
                now: NOW,
                unpriced: true,
                input_tokens: 1200,
                output_tokens: 300,
            }),
        ).toBe(true);
        // A non-billable zero still skips the ledger, exactly as before.
        record_spend(0, 'manual', 'x', { path: p, now: NOW });
        const lines = fs.readFileSync(p, 'utf-8').trimEnd().split('\n');
        expect(lines.length).toBe(1);
        const row = JSON.parse(lines[0] as string) as Record<string, unknown>;
        expect(row['usd']).toBeNull();
        expect(row['unpriced']).toBe(true);
        expect(row['input_tokens']).toBe(1200);
        expect(row['output_tokens']).toBe(300);
        const entries = read_entries(p);
        expect(entries.length).toBe(1);
        expect(entries[0]?.unpriced).toBe(true);
        expect(entries[0]?.usd).toBe(0);
        // A priced row beside it: the sum is the priced money, the count is the unknowns.
        record_spend(0.25, 'anthropic', 'claude-opus-4-1', { path: p, now: NOW });
        expect(today_spend_summary({ path: p, now: NOW })).toEqual({ usd: 0.25, unpriced_calls: 1 });
        expect(today_spend_usd({ path: p, now: NOW })).toBe(0.25);
    });
});

describe('budget_guard — cache fields (additive Step B)', () => {
    it('round-trips cache_read/cache_creation/cache_ttl through record_spend + read_entries', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        record_spend(0.05, 'anthropic', 'claude-sonnet-4-5', {
            path: p,
            now: NOW,
            cache_read_input_tokens: 12_345,
            cache_creation_input_tokens: 678,
            cache_ttl: '5m',
        });
        const entries = read_entries(p);
        expect(entries.length).toBe(1);
        expect(entries[0]?.cache_read_input_tokens).toBe(12_345);
        expect(entries[0]?.cache_creation_input_tokens).toBe(678);
        expect(entries[0]?.cache_ttl).toBe('5m');
    });

    it('a legacy entry recorded without cache fields still parses, with the fields absent', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        fs.writeFileSync(
            p,
            '{"ts": "2026-05-02T12:00:00+00:00", "usd": 0.05, "provider": "a", "model": "m"}\n',
            'utf-8',
        );
        const entries = read_entries(p);
        expect(entries.length).toBe(1);
        expect(entries[0]?.usd).toBe(0.05);
        expect(entries[0]?.cache_read_input_tokens).toBeUndefined();
        expect(entries[0]?.cache_creation_input_tokens).toBeUndefined();
        expect(entries[0]?.cache_ttl).toBeUndefined();
    });

    it('omitting cache options at record time reproduces the original 4-key line byte-for-byte', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        record_spend(0.05, 'anthropic', 'claude-sonnet-4-5', { path: p, now: NOW });
        const line = fs.readFileSync(p, 'utf-8').trimEnd();
        expect(line).toBe(
            '{"ts": "2026-05-02T12:00:00+00:00", "usd": 0.05, "provider": "anthropic", "model": "claude-sonnet-4-5"}',
        );
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

// ── Phase 3 of road-to-unknowns-that-say-so: reserve, then reconcile ──────
describe('budget_guard — reservations under a set ceiling', () => {
    const HOLD = 3_600_000;

    it('concurrent-councils-cannot-both-pass', () => {
        // Two councils against one $1.00 remainder, $0.60 each: the second
        // reads the first's open reservation and is refused.
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        const a = reserve_spend(1.0, 0.6, 'anthropic', 'm', { path: p, now: NOW, run_id: 'run-a', hold_ms: HOLD });
        const b = reserve_spend(1.0, 0.6, 'openai', 'm', { path: p, now: NOW, run_id: 'run-b', hold_ms: HOLD });
        expect(a.ok).toBe(true);
        expect(b).toEqual({ ok: false, reason: 'daily' });
        expect(today_spend_usd({ path: p, now: NOW })).toBeCloseTo(0.6, 9);
    });

    it('concurrent-councils-cannot-both-pass across processes', async () => {
        // Four processes released together against a remainder that holds one.
        const dir = mkTmp();
        const p = path.join(dir, 'council-spend.jsonl');
        const go = path.join(dir, 'go');
        const mod = path.resolve('src/scripts/ai_council/budget_guard.ts');
        const script = [
            `import * as fs from 'node:fs';`,
            `const { reserve_spend } = await import(${JSON.stringify(mod)});`,
            `while (!fs.existsSync(${JSON.stringify(go)})) await new Promise((r) => setTimeout(r, 5));`,
            `const r = reserve_spend(1.0, 0.6, 'p', 'm', { path: ${JSON.stringify(p)}, run_id: process.argv[2], hold_ms: 3600000 });`,
            `process.stdout.write(r.ok ? 'ok' : r.reason);`,
        ].join('\n');
        const scriptPath = path.join(dir, 'race.mts');
        fs.writeFileSync(scriptPath, script, 'utf-8');
        const tsx = path.resolve('node_modules', '.bin', 'tsx');
        const runs = [0, 1, 2, 3].map(
            (i) =>
                new Promise<string>((resolve) => {
                    const child = spawn(tsx, [scriptPath, `run-${i}`], { stdio: ['ignore', 'pipe', 'inherit'] });
                    let out = '';
                    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
                    child.on('close', () => resolve(out));
                }),
        );
        await new Promise((r) => setTimeout(r, 2000));
        fs.writeFileSync(go, '');
        const outcomes = await Promise.all(runs);
        expect(outcomes.filter((o) => o === 'ok')).toHaveLength(1);
        expect(outcomes.filter((o) => o === 'daily')).toHaveLength(3);
    }, 30_000);

    it('a held lock refuses rather than checking the ceiling unlocked', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        fs.writeFileSync(`${p}.lock`, '');
        const r = reserve_spend(1.0, 0.1, 'p', 'm', { path: p, now: NOW, run_id: 'r', hold_ms: HOLD, lock_wait_ms: 100 });
        expect(r).toEqual({ ok: false, reason: 'lock' });
        expect(fs.existsSync(p)).toBe(false);
    });

    it('an old lock whose holder is still alive is never broken', () => {
        // The stale-lock race: a waiter that reads an old mtime must not delete a lock
        // a live holder owns, or both enter the section that checks the ceiling.
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        fs.writeFileSync(`${p}.lock`, `${process.pid} live-holder`);
        const old = new Date(NOW - 60_000);
        fs.utimesSync(`${p}.lock`, old, old);
        const r = reserve_spend(1.0, 0.1, 'p', 'm', { path: p, now: NOW, run_id: 'r', hold_ms: HOLD, lock_wait_ms: 100 });
        expect(r).toEqual({ ok: false, reason: 'lock' });
        expect(fs.readFileSync(`${p}.lock`, 'utf-8')).toBe(`${process.pid} live-holder`);
    });

    it('an old lock whose holder is gone is taken over, and released after', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        fs.writeFileSync(`${p}.lock`, '2147483646 crashed-holder');
        const old = new Date(Date.now() - 60_000);
        fs.utimesSync(`${p}.lock`, old, old);
        const r = reserve_spend(1.0, 0.1, 'p', 'm', { path: p, now: NOW, run_id: 'r', hold_ms: HOLD, lock_wait_ms: 500 });
        expect(r.ok).toBe(true);
        expect(fs.existsSync(`${p}.lock`)).toBe(false);
        expect(fs.existsSync(`${p}.lock.break`)).toBe(false);
    });

    it('reservation-states-never-reopen', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        const done = reserve_spend(5.0, 0.5, 'p', 'm', { path: p, now: NOW, run_id: 'r', hold_ms: HOLD });
        const gone = reserve_spend(5.0, 0.5, 'p', 'm', { path: p, now: NOW, run_id: 'r', hold_ms: HOLD });
        const lost = reserve_spend(5.0, 0.5, 'p', 'm', { path: p, now: NOW, run_id: 'r', hold_ms: HOLD });
        if (!done.ok || !gone.ok || !lost.ok) throw new Error('setup: reservations refused');
        expect(close_reservation(done.id, 'completed', { path: p, now: NOW, usd: 0.25 })).toBe(true);
        expect(close_reservation(gone.id, 'released', { path: p, now: NOW })).toBe(true);
        expect(close_reservation(lost.id, 'unreconciled', { path: p, now: NOW })).toBe(true);
        // completed at the actual amount, released at zero, unreconciled at the estimate.
        expect(today_spend_usd({ path: p, now: NOW })).toBeCloseTo(0.25 + 0 + 0.5, 9);
        const before = fs.readFileSync(p, 'utf-8');
        for (const id of [done.id, gone.id, lost.id]) {
            for (const state of ['completed', 'released', 'unreconciled'] as const) {
                expect(close_reservation(id, state, { path: p, now: NOW, usd: 9 })).toBe(false);
            }
        }
        expect(close_reservation('no-such-id', 'completed', { path: p, now: NOW })).toBe(false);
        expect(fs.readFileSync(p, 'utf-8')).toBe(before);
        const states = reservation_states({ path: p, now: NOW });
        expect([states.get(done.id), states.get(gone.id), states.get(lost.id)]).toEqual([
            'completed',
            'released',
            'unreconciled',
        ]);
    });

    it('stale-reservation-expires-at-estimate', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        const r = reserve_spend(5.0, 0.7, 'p', 'm', { path: p, now: NOW, run_id: 'killed', hold_ms: 60_000 });
        if (!r.ok) throw new Error('setup: reservation refused');
        const later = NOW + 61_000;
        expect(reservation_states({ path: p, now: NOW }).get(r.id)).toBe('reserved');
        expect(reservation_states({ path: p, now: later }).get(r.id)).toBe('unreconciled');
        // The next locked read persists the closure; the killed run can no
        // longer settle it, and it still counts at its estimate, never zero.
        reserve_spend(5.0, 0.1, 'p', 'm', { path: p, now: later, run_id: 'next', hold_ms: 60_000 });
        const rows = read_entries(p).filter((e) => e.reservation_id === r.id);
        expect(rows.map((e) => [e.state, e.usd])).toEqual([
            ['reserved', 0.7],
            ['unreconciled', 0.7],
        ]);
        expect(close_reservation(r.id, 'completed', { path: p, now: later, usd: 0 })).toBe(false);
        expect(today_spend_usd({ path: p, now: later })).toBeCloseTo(0.7 + 0.1, 9);
    });

    it('no-ceiling-no-reservation-rows', () => {
        const dir = mkTmp();
        const viaRound = path.join(dir, 'round.jsonl');
        const direct = path.join(dir, 'direct.jsonl');
        const member = { name: 'anthropic', model: 'claude-sonnet-4-5' } as unknown as ExternalAIClient;
        const est: CostEstimate = {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
            input_tokens: 100,
            output_tokens: 50,
            input_usd: 0.01,
            output_usd: 0.02,
            priced: true,
        };
        const response = new CouncilResponse({ provider: 'anthropic', model: 'claude-sonnet-4-5', text: 'ok' });
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        try {
            const round = new RoundReservations(new CostBudget(), viaRound);
            expect(round.reserve(est, member)).toBeNull();
            expect(fs.existsSync(viaRound)).toBe(false);
            round.settle(response, member, est);
            round.finish([]);
            record_spend(0.03, 'anthropic', 'claude-sonnet-4-5', {
                path: direct,
                cache_read_input_tokens: 0,
                cache_creation_input_tokens: 0,
                cache_ttl: '5m',
            });
        } finally {
            vi.useRealTimers();
        }
        expect(fs.readFileSync(viaRound, 'utf-8')).toBe(fs.readFileSync(direct, 'utf-8'));
        expect(fs.readFileSync(viaRound, 'utf-8')).not.toContain('"state"');
    });

    it('a set ceiling reserves through the round and reconciles by outcome', () => {
        const p = path.join(mkTmp(), 'council-spend.jsonl');
        const member = { name: 'openai', model: 'gpt-x' } as unknown as ExternalAIClient;
        const est: CostEstimate = {
            provider: 'openai',
            model: 'gpt-x',
            input_tokens: 10,
            output_tokens: 10,
            input_usd: 0.1,
            output_usd: 0.1,
            priced: true,
        };
        const round = new RoundReservations(new CostBudget({ daily_limit_usd: 1.0 }), p);
        const fail = (error: string): CouncilResponse =>
            new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: '', error });
        // Refused auth with no tokens → released; a timeout → unknown until finish.
        expect(round.reserve(est, member)).toBeNull();
        round.settle(fail('Error: HTTP 401 unauthorized'), member, est);
        expect(round.reserve(est, member)).toBeNull();
        round.settle(fail('Error: request timed out'), member, est);
        const states = (): SpendState[] => [...reservation_states({ path: p }).values()];
        expect(states()).toEqual(['released', 'reserved']);
        round.finish([]);
        expect(states()).toEqual(['released', 'unreconciled']);
        expect(today_spend_usd({ path: p })).toBeCloseTo(0.2, 9);
    });

    it('an unreadable answer is billed; a stray three-digit number is not a 5xx', () => {
        expect(outcomeIsUnknown('parse_failed: SyntaxError')).toBe(true);
        expect(outcomeIsUnknown('Error: HTTP 503: unavailable')).toBe(true);
        expect(outcomeIsUnknown('exit_502')).toBe(true);
        expect(outcomeIsUnknown('invalid key at line 500')).toBe(false);
        expect(outcomeIsUnknown('refused after 500 ms')).toBe(false);
    });
});
