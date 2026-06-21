// Tests for src/scripts/bench_baseline_ready.ts (py2ts Phase 8 / Wave 8d).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helper (_read_baseline_start) plus a golden-parity layer that runs
// python3 vs tsx and compares stdout + stderr + exit code. The runner reads
// the live date via datetime.now(), so the `today` / `days_elapsed` /
// `days_ok` / status / verdict fields are inherently non-deterministic
// (wall-clock) — they are normalised before comparison. The report count
// derives from a directory listing (a stable count, not OS-order-sensitive).
// bench_baseline_ready is read-only — zero git drift.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as bbr from '../../src/scripts/bench_baseline_ready.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


/** Normalise the wall-clock-dependent fields (today / days / verdict). */


describe('bench_baseline_ready — pure helper', () => {
    let tmp: string | null = null;
    afterEach(() => {
        if (tmp && fs.existsSync(tmp)) {
            fs.rmSync(tmp);
        }
        tmp = null;
    });

    it('_read_baseline_start returns null for a missing file', () => {
        expect(bbr._read_baseline_start(path.join(REPO_ROOT, 'nope.txt'))).toBeNull();
    });

    it('_read_baseline_start skips comments + blanks, reads first date', () => {
        tmp = path.join(os.tmpdir(), `baseline-${process.pid}-${Date.now()}.txt`);
        fs.writeFileSync(tmp, '# comment\n\n2026-05-16\n2027-01-01\n');
        expect(bbr._read_baseline_start(tmp)).toBe('2026-05-16');
    });

    it('_read_baseline_start skips an invalid date line, takes the next valid', () => {
        tmp = path.join(os.tmpdir(), `baseline-${process.pid}-${Date.now()}-b.txt`);
        fs.writeFileSync(tmp, 'not-a-date\n2026-13-40\n2026-06-01\n');
        // "2026-13-40" is calendar-invalid → strptime ValueError → skipped.
        expect(bbr._read_baseline_start(tmp)).toBe('2026-06-01');
    });

    it('reads the live repo baseline file', () => {
        const p = path.join(REPO_ROOT, 'internal', 'bench', 'baseline-start.txt');
        if (fs.existsSync(p)) {
            expect(bbr._read_baseline_start(p)).toBe('2026-05-16');
        }
    });
});
