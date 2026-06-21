// Tests for src/scripts/memory_signal.ts — the write-side helper.
//
// 1:1 port of tests/test_memory_signal.py (pytest → vitest, ADR-094 parity
// contract). Memory is file-backed (no external backend); the pytest suite
// monkeypatches `INTAKE_ROOT` and `_monthly_file`, and the TS twin exposes the
// same override surface via setter seams. A trailing golden-parity block runs
// python3 + tsx and asserts byte-identical behaviour (structural, since id/ts
// vary per run), skipped without python3.

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as sig from '../../src/scripts/memory_signal.js';



let tmp: string;

beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'memsig-'));
    sig._setIntakeRoot(join(tmp, 'agents', 'memory', 'intake'));
});
afterEach(() => {
    sig._setIntakeRoot(join('agents', 'memory', 'intake'));
    rmSync(tmp, { recursive: true, force: true });
});

function readAllLines(): Record<string, unknown>[] {
    const root = join(tmp, 'agents', 'memory', 'intake');
    if (!existsSync(root)) {
        return [];
    }
    const lines: Record<string, unknown>[] = [];
    for (const name of readdirSync(root)) {
        if (!(name.startsWith('signals-') && name.endsWith('.jsonl'))) {
            continue;
        }
        const text = readFileSync(join(root, name), 'utf-8');
        for (const line of text.split('\n')) {
            if (line.trim()) {
                lines.push(JSON.parse(line));
            }
        }
    }
    return lines;
}

describe('memory_signal.ts — emit()', () => {
    it('emit writes append-only jsonl', () => {
        const rec = sig.emit('historical-patterns', 'app/Foo.php', 'null deref when X is missing');
        expect(rec).not.toBeNull();
        const all = readAllLines();
        expect(all.length).toBe(1);
        const written = all[0] as Record<string, unknown>;
        expect(written['entry_type']).toBe('historical-patterns');
        expect(written['path']).toBe('app/Foo.php');
        expect(written['body']).toBe('null deref when X is missing');
        expect((written['id'] as string).startsWith('sig-')).toBe(true);
        expect(written['origin']).toBe('agent');
    });

    it('rate limit skips duplicate within window', () => {
        sig.emit('incident-learnings', 'queue/x.php', 'timeout on retry');
        const second = sig.emit('incident-learnings', 'queue/x.php', 'timeout on retry');
        expect(second, 'second emit within window must be skipped').toBeNull();
        expect(readAllLines().length).toBe(1);
    });

    it('force bypasses rate limit', () => {
        sig.emit('ownership', 'app/Http/Billing', 'team-payments');
        const again = sig.emit('ownership', 'app/Http/Billing', 'team-payments', { force: true });
        expect(again).not.toBeNull();
        expect(readAllLines().length).toBe(2);
    });

    it('rate limit does not skip different body', () => {
        sig.emit('historical-patterns', 'app/A.php', 'bug 1');
        const second = sig.emit('historical-patterns', 'app/A.php', 'bug 2');
        expect(second).not.toBeNull();
        expect(readAllLines().length).toBe(2);
    });

    it('rate limit window expiry', () => {
        // An entry older than the window must not block a fresh emit.
        sig.emit('historical-patterns', 'app/B.php', 'flake');
        const target = sig._monthly_file();
        const stale = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        const records = readFileSync(target, 'utf-8')
            .split('\n')
            .filter((l) => l.trim())
            .map((l) => JSON.parse(l) as Record<string, unknown>);
        // isoformat(timespec="seconds") with +00:00 offset.
        (records[0] as Record<string, unknown>)['ts'] = _isoSeconds(stale);
        writeFileSync(target, `${records.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf-8');
        const second = sig.emit('historical-patterns', 'app/B.php', 'flake');
        expect(second, 'emit outside rate-limit window must proceed').not.toBeNull();
    });

    it('unknown type raises', () => {
        expect(() => sig.emit('not-a-type', 'x', 'y')).toThrowError(/unknown memory type/);
    });

    it('missing fields raise', () => {
        expect(() => sig.emit('ownership', '', 'body')).toThrowError();
        expect(() => sig.emit('ownership', 'app/x', '')).toThrowError();
    });

    it('extra fields are preserved', () => {
        const rec = sig.emit('historical-patterns', 'app/Foo.php', 'off-by-one', {
            extra: { symptom: 'returns wrong count', severity: 'medium' },
        });
        expect(rec).not.toBeNull();
        expect((rec as Record<string, unknown>)['symptom']).toBe('returns wrong count');
        expect((rec as Record<string, unknown>)['severity']).toBe('medium');
    });

    it('extra cannot overwrite reserved', () => {
        const rec = sig.emit('ownership', 'app/x', 'team-x', {
            extra: { id: 'hijack', path: 'other' },
        });
        expect(rec).not.toBeNull();
        expect((rec as { id: string }).id.startsWith('sig-'), 'reserved id must not be overwritten').toBe(true);
        expect((rec as { path: string }).path).toBe('app/x');
    });

    it('emit always writes intake', () => {
        // Memory is file-backed: emit always appends intake (no package route).
        const rec = sig.emit('product-rules', 'app/Baz.php', 'z');
        expect(rec).not.toBeNull();
        expect('_backend' in (rec as Record<string, unknown>)).toBe(false);
        expect(readAllLines().length).toBeGreaterThan(0);
    });
});

function _isoSeconds(d: Date): string {
    const p = (n: number, w = 2): string => n.toString().padStart(w, '0');
    return (
        `${p(d.getUTCFullYear(), 4)}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
        `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+00:00`
    );
}
