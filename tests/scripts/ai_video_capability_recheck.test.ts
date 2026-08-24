/**
 * `recheck_by` on the capability surface — a vendor capability is a dated
 * observation, not a permanent fact.
 *
 * Endpoints have gained and lost frame conditioning inside weeks, so a manifest
 * entry verified once is evidence about the past presented as the present unless
 * it carries its own expiry. The date is DERIVED from the trace index's
 * `captured_at`, never stored a second time, so one constant moves every side.
 *
 * `null` is asserted as distinct from a date. An entry with no `smoke_trace` is
 * *unknown*, and unknown must never read as *fresh* — that is the same
 * `null != true` rule the frame axis lives by, applied to time.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ADAPTERS = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'adapters');

interface Cap {
    model: string;
    verified: boolean;
    verified_at: string | null;
    recheck_by: string | null;
}

function capability(adapter: string, model: string, env: Record<string, string> = {}) {
    const res = spawnSync('bash', [path.join(ADAPTERS, `${adapter}.sh`), 'capability', '--model', model], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        env: { ...process.env, ...env },
    });
    return { res, cap: res.status === 0 ? (JSON.parse(res.stdout) as Cap) : null };
}

describe('capability recheck markers', () => {
    it('a traced model carries both dates', () => {
        const { res, cap } = capability('fal', 'fal-ai/ltx-2/text-to-video');
        expect(res.status, res.stderr).toBe(0);
        expect(cap?.verified).toBe(true);
        expect(cap?.verified_at).toBe('2026-06-10');
        // 180 days after the capture, derived — not a second stored value.
        expect(cap?.recheck_by).toBe('2026-12-07');
    });

    it('an untraced model carries null, never a date — unknown is not fresh', () => {
        const { res, cap } = capability('kling', 'kling-v2-master');
        expect(res.status, res.stderr).toBe(0);
        expect(cap?.verified).toBe(false);
        expect(cap?.verified_at).toBeNull();
        expect(cap?.recheck_by).toBeNull();
    });

    it('warns on stderr once the recheck date has passed', () => {
        const { res, cap } = capability('fal', 'fal-ai/ltx-2/text-to-video', {
            AIV_TRACE_RECHECK_DAYS: '1',
        });
        expect(res.status).toBe(0);
        expect(cap?.recheck_by).toBe('2026-06-11');
        expect(res.stderr).toMatch(/recheck-by date 2026-06-11 has PASSED/);
        expect(res.stderr).toMatch(/re-probe before trusting the capability/);
    });

    it('does not warn while the date is in the future — the warning is conditional', () => {
        // Sensitivity: without this the stderr assertion above would pass
        // against a helper that warns unconditionally.
        const { res } = capability('fal', 'fal-ai/ltx-2/text-to-video');
        expect(res.stderr).not.toMatch(/has PASSED/);
    });

    it('shares ONE window with the trace stamp and the lint', () => {
        const a = capability('fal', 'fal-ai/ltx-2/text-to-video', { AIV_TRACE_RECHECK_DAYS: '30' });
        const b = capability('fal', 'fal-ai/ltx-2/text-to-video', { AIV_TRACE_RECHECK_DAYS: '90' });
        expect(a.cap?.recheck_by).toBe('2026-07-10');
        expect(b.cap?.recheck_by).toBe('2026-09-08');
    });

    it('resolves the index regardless of which lib dir the caller came from', () => {
        // fal lives in ai-video/adapters (AIV_LIB_DIR = ai-video/lib); a
        // fixed `..` depth was right for one caller and silently wrong for the
        // other, which is how this first shipped with verified_at: null on a
        // traced model.
        for (const adapter of ['fal', 'replicate']) {
            const { res } = capability(adapter, 'nope/nope');
            // Refused by name, not answered with a default — and the refusal
            // proves the manifest was found at all.
            expect(res.status).not.toBe(0);
            expect(res.stderr).toMatch(/model not in manifest/);
        }
    });
});
