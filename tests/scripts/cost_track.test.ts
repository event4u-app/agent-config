// Tests for src/scripts/cost/track.mjs — the `rate_missing` flag
// (inbox-harvest-2026-08-b-ledger-truth 2.4).
//
// `costForUsage` returns 0 for any tier PRICING has no row for. That zero is
// byte-identical to a genuinely free message, so a session containing an
// unrecognised model reported a total that was understated with no warning and
// no flag anywhere. These tests pin the flag, the stderr warning, and — the
// part that makes a later backfill possible at all — that the token counts
// survive the missing rate.
//
// track.mjs has no export and no entry guard (it calls `main()` at module
// scope), so it is exercised as a SUBPROCESS rather than imported: importing
// it would run a real session scan against the developer's own ~/.claude.
// `HOME` is redirected to a temp dir, which is what makes the fixture the only
// transcript the run can see.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const TRACK = path.resolve(__dirname, '../../src/scripts/cost/track.mjs');
const tmps: string[] = [];

afterEach(() => {
    for (const d of tmps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** Claude Code slugs every character outside [A-Za-z0-9-] (see track.mjs). */
function encodeProjectPath(cwd: string): string {
    return cwd.replace(/[^A-Za-z0-9-]/g, '-');
}

function assistantLine(model: string, id: string) {
    return JSON.stringify({
        type: 'assistant',
        sessionId: 'sess-fixture',
        cwd: '/work/proj',
        timestamp: '2026-08-11T10:00:00.000Z',
        requestId: `req-${id}`,
        message: {
            id: `msg-${id}`,
            model,
            usage: { input_tokens: 1000, output_tokens: 500 },
        },
    });
}

/** Run track.mjs against a one-file transcript fixture; return summary + stderr. */
function runTrack(models: string[]): { summary: Record<string, unknown>; stderr: string } {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'track-home-'));
    tmps.push(home);
    const trackCwd = '/work/proj';
    const projectDir = path.join(home, '.claude', 'projects', encodeProjectPath(trackCwd));
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
        path.join(projectDir, 'sess-fixture.jsonl'),
        models.map((m, i) => assistantLine(m, String(i))).join('\n') + '\n',
        'utf8',
    );
    const out = path.join(home, 'summary.json');
    const r = spawnSync(process.execPath, [TRACK], {
        env: {
            ...process.env,
            HOME: home,
            TRACK_CWD: trackCwd,
            TRACK_OUT: out,
            TRACK_DRY_RUN: '1',
            TRACK_QUIET: '1',
        },
        encoding: 'utf8',
    });
    if (r.status !== 0) {
        throw new Error(`track.mjs exited ${r.status}: ${r.stderr}`);
    }
    return {
        summary: JSON.parse(fs.readFileSync(out, 'utf8')) as Record<string, unknown>,
        stderr: r.stderr ?? '',
    };
}

describe('cost/track.mjs — rate_missing', () => {
    it('flags a session whose model no tier claims, and names the id', () => {
        const { summary, stderr } = runTrack(['some-new-vendor-model-v9']);
        expect(summary['rate_missing']).toBe(true);
        expect(summary['rate_missing_models']).toEqual(['some-new-vendor-model-v9']);
        expect(stderr).toContain('rate_missing');
        expect(stderr).toContain('some-new-vendor-model-v9');
        // The whole point of flagging instead of throwing: the counts survive,
        // so the row can be re-priced once a rate exists.
        const byModel = summary['byModel'] as Record<string, Record<string, number>>;
        expect(byModel['some-new-vendor-model-v9']!['input_tokens']).toBe(1000);
        expect(byModel['some-new-vendor-model-v9']!['output_tokens']).toBe(500);
        expect(summary['total_cost_usd']).toBe(0);
    });

    it('a priced model is NOT flagged and warns about nothing — the negative control', () => {
        const { summary, stderr } = runTrack(['claude-sonnet-4-5']);
        expect(summary['rate_missing']).toBe(false);
        expect(summary['rate_missing_models']).toEqual([]);
        expect(stderr).not.toContain('rate_missing');
        expect(summary['total_cost_usd']).toBeGreaterThan(0);
    });

    it('a mixed session flags only the unpriced ids and still bills the priced ones', () => {
        const { summary } = runTrack(['claude-sonnet-4-5', 'mystery-model', 'claude-opus-4-1']);
        expect(summary['rate_missing']).toBe(true);
        expect(summary['rate_missing_models']).toEqual(['mystery-model']);
        expect(summary['total_cost_usd']).toBeGreaterThan(0);
    });

    it('reports every unpriced id, sorted — a backfill needs the whole set', () => {
        const { summary } = runTrack(['zeta-model', 'alpha-model', 'zeta-model']);
        expect(summary['rate_missing_models']).toEqual(['alpha-model', 'zeta-model']);
    });
});

// ── review repairs (R2 findings 3 and 4) ─────────────────────────────
describe('cost/track.mjs — rate_missing does not cry wolf', () => {
    /** Build a fixture whose assistant record carries usage with zero tokens. */
    function runZeroToken(model: string) {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'track-zero-'));
        tmps.push(home);
        const trackCwd = '/work/proj';
        const dir = path.join(home, '.claude', 'projects', encodeProjectPath(trackCwd));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'sess.jsonl'),
            JSON.stringify({
                type: 'assistant',
                sessionId: 'z',
                cwd: trackCwd,
                timestamp: '2026-08-11T10:00:00.000Z',
                requestId: 'r0',
                message: { id: 'm0', model, usage: { input_tokens: 0, output_tokens: 0 } },
            }) + '\n',
            'utf8',
        );
        const out = path.join(home, 's.json');
        const r = spawnSync(process.execPath, [TRACK], {
            env: { ...process.env, HOME: home, TRACK_CWD: trackCwd, TRACK_OUT: out, TRACK_DRY_RUN: '1', TRACK_QUIET: '1' },
            encoding: 'utf8',
        });
        return { summary: JSON.parse(fs.readFileSync(out, 'utf8')) as Record<string, unknown>, stderr: r.stderr ?? '' };
    }

    it('a zero-token message with an unknown model is NOT flagged — it costs nothing at any rate', () => {
        const { summary, stderr } = runZeroToken('some-unpriced-model');
        expect(summary['rate_missing']).toBe(false);
        expect(summary['rate_missing_models']).toEqual([]);
        expect(stderr).not.toContain('rate_missing');
    });

    it('a message with real tokens and an unknown model still IS flagged', () => {
        const { summary } = runTrack(['some-unpriced-model']);
        expect(summary['rate_missing']).toBe(true);
    });
});
