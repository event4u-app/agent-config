/**
 * `stitch.sh` flag contract — the refused `--crossfade` path.
 *
 * Why this test exists at all: before it, NOTHING under `tests/` exercised
 * `stitch.sh`. The only executable coverage was one dry-run assertion in
 * `src/scripts/ai-video/test-pipeline.sh`, which never passes `--crossfade` —
 * so the defect this file pins was invisible in both directions.
 *
 * The defect: `--crossfade` printed "not yet implemented" to stderr and then
 * fell through to `ffmpeg -f concat -c copy`, emitting the success JSON and
 * exit 0. A caller asking for a crossfade got a hard cut and no error. And the
 * notice sat AFTER the dry-run exit while `AIV_DRYRUN` defaults to `true`, so
 * in the default mode the flag was accepted in total silence.
 *
 * Both halves are asserted: the refusal fires, and it fires BEFORE the dry-run
 * branch. A test that only checked the non-default mode would have passed
 * against the silent path.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const STITCH = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'stitch.sh');

/** One manifest entry whose clip exists, so the run would otherwise succeed. */
function fixtureProject(): { manifest: string; output: string; dir: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stitch-flags-'));
    const clip = path.join(dir, 'scene-1.mp4');
    fs.writeFileSync(clip, 'not a real mp4 — the dry-run path never opens it');
    const manifest = path.join(dir, 'manifest.json');
    fs.writeFileSync(
        manifest,
        JSON.stringify([
            { scene_id: 'scene-1', clip_path: clip, audio_embedded: true, duration: 4 },
        ]),
    );
    return { manifest, output: path.join(dir, 'out.mp4'), dir };
}

/**
 * Is ffmpeg on PATH?
 *
 * Load-bearing for exactly one case below. `stitch.sh` runs
 * `aiv_require_cmd ffmpeg` in the non-dry-run branch BEFORE it parses argv, so
 * without ffmpeg the script dies on the missing dependency and never reaches the
 * `--crossfade` refusal. That ordering is correct — a missing hard dependency is
 * the more fundamental error — but it makes the non-default-mode assertion
 * environment-dependent, and CI has no ffmpeg. Skipped with its reason rather
 * than weakened into an OR over two different error messages, which would have
 * passed for the wrong reason.
 *
 * The DEFAULT-mode case needs no ffmpeg and therefore runs everywhere. That is
 * the important half: the default mode is the one where the old code was
 * completely silent.
 */
const HAS_FFMPEG = spawnSync('ffmpeg', ['-version'], { encoding: 'utf-8' }).status === 0;

function runStitch(
    args: readonly string[],
    env: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
    const r = spawnSync('bash', [STITCH, ...args], {
        encoding: 'utf-8',
        env: { ...process.env, ...env },
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('stitch.sh — --crossfade is refused, never downgraded', () => {
    it('exits 2 and names the reason in the DEFAULT (dry-run) mode', () => {
        const { manifest, output } = fixtureProject();
        // No AIV_DRYRUN → defaults to true. This is the path that used to be
        // silent, because the old notice printed after the dry-run exit.
        const r = runStitch([manifest, output, '--crossfade', '0.5']);

        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/--crossfade is not implemented/);
        expect(r.stderr).toMatch(/will not be silently downgraded/);
        // The refusal must precede the plan, not follow it.
        expect(r.stdout).toBe('');
        expect(fs.existsSync(output)).toBe(false);
    });

    it.skipIf(!HAS_FFMPEG)('exits 2 in the explicit non-dry-run mode too', () => {
        const { manifest, output } = fixtureProject();
        const r = runStitch([manifest, output, '--crossfade', '1'], { AIV_DRYRUN: 'false' });

        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/--crossfade is not implemented/);
        expect(fs.existsSync(output)).toBe(false);
    });

    it('never reports success alongside the refusal', () => {
        const { manifest, output } = fixtureProject();
        const r = runStitch([manifest, output, '--crossfade', '0.5']);

        // The old path emitted `{"output":…,"scenes":N,…}` on stdout with exit 0.
        expect(r.stdout).not.toMatch(/"output"/);
        expect(r.status).not.toBe(0);
    });

    it('the usage string no longer advertises the flag', () => {
        const r = runStitch([]);

        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/usage: stitch\.sh/);
        expect(r.stderr).not.toMatch(/--crossfade/);
    });

    it('a hard-cut dry run still plans normally without the flag', () => {
        const { manifest, output } = fixtureProject();
        const r = runStitch([manifest, output]);

        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/"dry_run":\s*true/);
        expect(r.stdout).toMatch(/"scenes":\s*1/);
    });

    it('an unknown flag is still refused the same way', () => {
        const { manifest, output } = fixtureProject();
        const r = runStitch([manifest, output, '--loudnorm']);

        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/unknown flag/);
    });
});
