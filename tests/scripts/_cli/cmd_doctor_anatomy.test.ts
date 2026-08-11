/**
 * `doctor --anatomy` — the injection-anatomy flag.
 *
 * Deliberately NOT in the golden-parity suite next door: that file byte-compares
 * a Python twin, and this flag has none. It is also not byte-stable by nature —
 * it renders a census of `~/.claude` and of local transcripts, so the figures
 * differ per machine and per day. What IS checkable, and what these fixtures
 * pin, is the shape: the flag is off unless asked for, `--json` emits ONE
 * parseable document rather than two concatenated ones, and an unavailable
 * dispatch-economy half is reported as unavailable instead of as a zero.
 */
import { describe, expect, it, vi } from 'vitest';

import { _parse, main } from '../../../src/scripts/_cli/cmd_doctor.js';

function captureStdout(run: () => number): { code: number; stdout: string } {
    let stdout = '';
    const spy = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation((chunk: string | Uint8Array): boolean => {
            stdout += String(chunk);
            return true;
        });
    try {
        return { code: run(), stdout };
    } finally {
        spy.mockRestore();
    }
}

describe('doctor --anatomy', () => {
    it('is off by default and set only when asked for', () => {
        expect(_parse([]).anatomy).toBe(false);
        expect(_parse(['--anatomy']).anatomy).toBe(true);
        // Independent of the machine-readable flags — anatomy is a view, not a mode.
        expect(_parse(['--anatomy', '--json']).json).toBe(true);
        expect(_parse(['--json']).anatomy).toBe(false);
    });

    it('--json emits one document, not two concatenated reports', () => {
        const { code, stdout } = captureStdout(() => main(['--anatomy', '--json']));
        expect(code).toBe(0);
        const parsed = JSON.parse(stdout) as Record<string, unknown>;
        expect(Object.keys(parsed).sort()).toEqual([
            'dispatch_economy',
            'dispatch_economy_unavailable',
            'preamble_byte_census',
        ]);
        // The census half is always computable — it reads files, and an absent
        // directory is a zero-file source, never a failure.
        expect(parsed['preamble_byte_census']).toBeTypeOf('object');
        // Exactly one of the economy pair carries content: a report OR the
        // reason there is none. Both null would be a silent zero.
        const hasReport = parsed['dispatch_economy'] !== null;
        const hasReason = parsed['dispatch_economy_unavailable'] !== null;
        expect(hasReport !== hasReason).toBe(true);
    });

    it('text mode renders the anatomy header and the census body', () => {
        const { code, stdout } = captureStdout(() => main(['--anatomy']));
        expect(code).toBe(0);
        expect(stdout).toContain('injection anatomy');
        expect(stdout).toContain('Preamble byte census');
    });
});
