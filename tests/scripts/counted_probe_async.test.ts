import { describe, expect, it } from 'vitest';

import { ProbeOverflowError, runCountedProbeAsync } from '../../src/scripts/_lib/counted_probe.js';

describe('runCountedProbeAsync — same contract as the sync probe', () => {
    it('captures stdout and a zero exit', async () => {
        const r = await runCountedProbeAsync('node', ['-e', 'process.stdout.write("scanned: 7")']);
        expect(r).toMatchObject({ ok: true, status: 0, stdout: 'scanned: 7', failure: null });
    });

    it('reports a non-zero exit with its output, not as a crash', async () => {
        const r = await runCountedProbeAsync('node', ['-e', 'console.log("x"); process.exit(3)']);
        expect(r.ok).toBe(false);
        expect(r.status).toBe(3);
        expect(r.stdout).toContain('x');
    });

    it('rejects on overflow instead of resolving to a short read', async () => {
        await expect(
            runCountedProbeAsync('node', ['-e', 'process.stdout.write("y".repeat(5000))'], { maxBuffer: 100 }),
        ).rejects.toBeInstanceOf(ProbeOverflowError);
    });

    it('reports a missing command as a typed failure', async () => {
        const r = await runCountedProbeAsync('definitely-not-a-command-xyz', []);
        expect(r.ok).toBe(false);
        expect(r.status).toBeNull();
        expect(r.failure).toBe('ENOENT');
    });
});
