/**
 * The pipe reader that only breaks on big inputs.
 *
 * `fs.readFileSync(0)` returned everything for years because every diff piped
 * into a gate fit in the ~64 KB pipe buffer. The first PR whose diff did not
 * (~6,400 lines) crashed CI with `EAGAIN` — reproducibly, not flakily. So the
 * property under test is a SIZE one: a payload larger than one pipe buffer must
 * come back whole, and a failed read must never masquerade as empty input.
 */
import { describe, expect, it } from 'vitest';

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TSX = join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

/** Run a tiny script that pipes `input` through `readStdinText` and echoes its length. */
function pipeThrough(input: string): { status: number | null; stdout: string; stderr: string } {
    const dir = mkdtempSync(join(tmpdir(), 'stdin-'));
    try {
        const script = join(dir, 'probe.mts');
        writeFileSync(
            script,
            `import { readStdinText } from ${JSON.stringify(join(REPO_ROOT, 'src/scripts/_lib/stdin.ts'))};\n` +
                'process.stdout.write(String(readStdinText().length));\n',
            'utf-8',
        );
        const r = spawnSync(TSX, [script], { input, encoding: 'utf-8', cwd: REPO_ROOT });
        return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

describe('readStdinText', () => {
    it('returns a small payload whole', () => {
        const payload = 'diff --git a/x b/x\n+one line\n';
        const r = pipeThrough(payload);
        expect(r.stderr).toBe('');
        expect(r.status).toBe(0);
        expect(Number(r.stdout)).toBe(payload.length);
    });

    it('returns a payload larger than the pipe buffer whole', () => {
        // The regression: ~1 MB is many times the ~64 KB a pipe holds, so the
        // writer is still filling it when the reader arrives. `readFileSync(0)`
        // raises EAGAIN here instead of waiting.
        const line = 'a'.repeat(199) + '\n';
        const payload = line.repeat(5_000); // ~1 MB
        expect(payload.length).toBeGreaterThan(64 * 1024);
        const r = pipeThrough(payload);
        expect(r.stderr).toBe('');
        expect(r.status).toBe(0);
        expect(Number(r.stdout)).toBe(payload.length);
    });

    it('reports genuinely empty stdin as empty', () => {
        // The distinction that matters: `''` must mean "nothing was piped", never
        // "the read failed". A sibling gate wraps the same call in
        // `catch { data = '' }`, which turns an oversized diff into a clean one.
        const r = pipeThrough('');
        expect(r.status).toBe(0);
        expect(Number(r.stdout)).toBe(0);
    });
});
