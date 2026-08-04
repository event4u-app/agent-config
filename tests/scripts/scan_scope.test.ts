/**
 * Scope-assertion library — the primitive every gate conversion routes through.
 *
 * `reportScanned` is the pairing added while chartering the 189-gate conversion
 * (`road-to-gate-hardening-adoption`, AI council 2026-08-04): the assertion and
 * the published count had drifted apart across the tree — 12 gates asserted, 14
 * published, 8 did both — and a published number that was never asserted is the
 * invented-count failure downstream tooling cannot detect. These tests pin the
 * property that makes the pairing worth having: the number that reaches stdout
 * is the number the assertion accepted, and nothing reaches stdout when it did
 * not.
 */
import { describe, expect, it } from 'vitest';

import {
    DeadScopeError,
    assertScanned,
    assertWatchlistResolves,
    reportScanned,
} from '../../src/scripts/_lib/scan_scope.js';

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('assertScanned', () => {
    it('passes on a non-empty corpus', () => {
        expect(() => assertScanned({ gate: 'g', scanned: 3, units: 'file(s)', roots: ['src'] })).not.toThrow();
    });

    it('throws a DeadScopeError naming the gate and the root on a zero scan', () => {
        try {
            assertScanned({ gate: 'lint_example', scanned: 0, units: 'file(s)', roots: ['src/gone'] });
            expect.unreachable('a zero scan must not pass');
        } catch (e) {
            expect(e).toBeInstanceOf(DeadScopeError);
            expect((e as DeadScopeError).gate).toBe('lint_example');
            // The root is in the message on purpose: the next path migration has
            // to be told WHICH root died, not just that something did.
            expect((e as Error).message).toContain('src/gone');
        }
    });

    it('accepts a justified empty corpus but not a blank justification', () => {
        expect(() =>
            assertScanned({
                gate: 'g',
                scanned: 0,
                units: 'file(s)',
                roots: ['optional'],
                allowEmpty: 'OPTIONAL_INPUT: consumer tree is absent in this project',
            }),
        ).not.toThrow();
        // Whitespace is not a reason — otherwise `allowEmpty: ' '` silences the
        // guard while passing a reviewer's eye as "there is a justification".
        expect(() =>
            assertScanned({ gate: 'g', scanned: 0, units: 'file(s)', roots: ['x'], allowEmpty: '   ' }),
        ).toThrow(DeadScopeError);
    });
});

describe('reportScanned', () => {
    it('publishes exactly the count the assertion accepted', () => {
        const out: string[] = [];
        reportScanned({ gate: 'g', scanned: 42, units: 'file(s)', roots: ['src'] }, ((s: string) => {
            out.push(s);
            return true;
        }) as unknown as typeof process.stdout.write);
        expect(out).toEqual(['scanned: 42\n']);
    });

    it('publishes nothing when the scope is dead', () => {
        // The ordering is the whole point: a gate that emits first and asserts
        // second would publish `scanned: 0` and then die, leaving a coverage line
        // in the log for a run that proved nothing.
        const out: string[] = [];
        expect(() =>
            reportScanned({ gate: 'g', scanned: 0, units: 'file(s)', roots: ['src/gone'] }, ((s: string) => {
                out.push(s);
                return true;
            }) as unknown as typeof process.stdout.write),
        ).toThrow(DeadScopeError);
        expect(out).toEqual([]);
    });

    it('still publishes a justified zero, so the floor sees the real number', () => {
        const out: string[] = [];
        reportScanned(
            {
                gate: 'g',
                scanned: 0,
                units: 'file(s)',
                roots: ['optional'],
                allowEmpty: 'EMPTY_VALID: zero matches is the success state',
            },
            ((s: string) => {
                out.push(s);
                return true;
            }) as unknown as typeof process.stdout.write,
        );
        expect(out).toEqual(['scanned: 0\n']);
    });
});

describe('assertWatchlistResolves', () => {
    it('returns the resolvable subset and throws when the whole list is phantom', () => {
        const dir = mkdtempSync(join(tmpdir(), 'watchlist-'));
        try {
            writeFileSync(join(dir, 'real.md'), 'x\n');
            expect(
                assertWatchlistResolves({ gate: 'g', candidates: ['real.md', 'gone.md'], repoRoot: dir }),
            ).toEqual(['real.md']);
            expect(() =>
                assertWatchlistResolves({ gate: 'g', candidates: ['gone.md'], repoRoot: dir }),
            ).toThrow(DeadScopeError);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
