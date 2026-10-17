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

/**
 * Steps 6.4 and 6.5 of `road-to-unknowns-that-say-so`, and AC-9.
 *
 * The defect, executed before these cases existed: `-c copy` never decodes, so
 * `stitch.sh` reported `{"output":…,"scenes":2,"missing":0}` and exit 0 over an
 * input it had never opened. A truncated file, a zero-byte file, and a second
 * clip at a different resolution all produced a success line and a file whose
 * later segments no player can decode.
 *
 * Every case here builds its clips with `ffmpeg -f lavfi -i testsrc`, so the
 * fixtures are real video rather than text pretending to be video — the
 * distinction matters because the whole point is what `ffprobe` says about the
 * bytes. They skip with a reason where ffmpeg is absent; the CI job that runs
 * them installs it (decision D7).
 */
const HAS_FFPROBE = spawnSync('ffprobe', ['-version'], { encoding: 'utf-8' }).status === 0;
// skip-reason: these cases decode real video; without ffmpeg/ffprobe there is
// nothing to decode and the script dies on the missing dependency before any
// assertion is reached.
const MEDIA = HAS_FFMPEG && HAS_FFPROBE;

/** A real clip at `size`, `seconds` long, written to `file`. */
function makeClip(file: string, size: string, seconds: number): void {
    const r = spawnSync(
        'ffmpeg',
        ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
         `testsrc=duration=${seconds}:size=${size}:rate=10`, '-pix_fmt', 'yuv420p', file],
        { encoding: 'utf-8' },
    );
    if (r.status !== 0) throw new Error(`fixture clip failed: ${r.stderr}`);
}

function mediaProject(scenes: { id: string; file: string; audio?: boolean }[]): {
    manifest: string;
    output: string;
    dir: string;
} {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stitch-media-'));
    const manifest = path.join(dir, 'manifest.json');
    fs.writeFileSync(
        manifest,
        JSON.stringify(
            scenes.map((s) => ({
                scene_id: s.id,
                clip_path: path.join(dir, s.file),
                audio_embedded: s.audio ?? false,
            })),
        ),
    );
    return { manifest, output: path.join(dir, 'out.mp4'), dir };
}

describe('stitch.sh — a clip nobody opened is not a clip', () => {
    it.skipIf(!MEDIA)('stitch-refuses-unreadable-clip', () => {
        const { manifest, output, dir } = mediaProject([
            { id: 's1', file: 'a.mp4' },
            { id: 's2', file: 'broken.mp4' },
        ]);
        makeClip(path.join(dir, 'a.mp4'), '320x240', 2);
        fs.writeFileSync(path.join(dir, 'broken.mp4'), 'not a video, and 11 bytes of it');

        const r = runStitch([manifest, output], { AIV_DRYRUN: 'false' });

        expect(r.status, r.stderr).toBe(7);
        expect(r.stderr).toMatch(/unreadable clip for scene=s2/);
        expect(r.stderr).toMatch(/ffprobe found no video stream/);
        // Never the success line. This is what the old path printed.
        expect(r.stdout).not.toMatch(/"output"/);
        expect(fs.existsSync(output)).toBe(false);
    });

    it.skipIf(!MEDIA)('honours --continue over an unreadable clip, exactly as over a missing one', () => {
        // The polarity partner. An unreadable clip is routed into the EXISTING
        // missing-clip policy rather than into a new fatal path of its own, so
        // the operator's three flags keep meaning what they meant.
        const { manifest, output, dir } = mediaProject([
            { id: 's1', file: 'a.mp4' },
            { id: 's2', file: 'broken.mp4' },
        ]);
        makeClip(path.join(dir, 'a.mp4'), '320x240', 2);
        fs.writeFileSync(path.join(dir, 'broken.mp4'), 'not a video');

        const r = runStitch([manifest, output, '--continue'], { AIV_DRYRUN: 'false' });

        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toMatch(/"scenes":1/);
        expect(r.stdout).toMatch(/"missing":1/);
    });

    it.skipIf(!MEDIA)('stitch-output-matches-manifest', () => {
        // The valid run: two clips of one shape. Both halves of 6.5 pass over
        // it — every fingerprint matches, and the output duration is within
        // tolerance of the summed inputs — and the stdout is byte-identical to
        // what this path printed before either check existed.
        const { manifest, output, dir } = mediaProject([
            { id: 's1', file: 'a.mp4' },
            { id: 's2', file: 'b.mp4' },
        ]);
        makeClip(path.join(dir, 'a.mp4'), '320x240', 2);
        makeClip(path.join(dir, 'b.mp4'), '320x240', 2);

        const r = runStitch([manifest, output], { AIV_DRYRUN: 'false' });

        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toBe(`{"output":"${output}","scenes":2,"missing":0}\n`);
        expect(fs.existsSync(output)).toBe(true);

        const dur = spawnSync(
            'ffprobe',
            ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', output],
            { encoding: 'utf-8' },
        ).stdout.trim();
        expect(Number(dur)).toBeGreaterThan(3.5);
    });

    it.skipIf(!MEDIA)('refuses a resolution change on the copy path and names the first divergent scene', () => {
        const { manifest, output, dir } = mediaProject([
            { id: 's1', file: 'a.mp4' },
            { id: 's2', file: 'big.mp4' },
        ]);
        makeClip(path.join(dir, 'a.mp4'), '320x240', 2);
        makeClip(path.join(dir, 'big.mp4'), '640x480', 2);

        const r = runStitch([manifest, output], { AIV_DRYRUN: 'false' });

        expect(r.status, r.stderr).toBe(8);
        expect(r.stderr).toMatch(/scene=s2 does not match scene=s1/);
        expect(r.stderr).toMatch(/640,480/);
        expect(r.stderr).toMatch(/320,240/);
        // The message points at the path that CAN reconcile them.
        expect(r.stderr).toMatch(/--mode handoff/);
        expect(r.stdout).not.toMatch(/"output"/);
    });

    it.skipIf(!MEDIA)('refuses a scene that declares audio_embedded over a clip with no audio stream', () => {
        const { manifest, output, dir } = mediaProject([{ id: 's1', file: 'a.mp4', audio: true }]);
        makeClip(path.join(dir, 'a.mp4'), '320x240', 2);

        const r = runStitch([manifest, output], { AIV_DRYRUN: 'false' });

        expect(r.status, r.stderr).toBe(8);
        expect(r.stderr).toMatch(/declares audio_embedded: true/);
        expect(r.stdout).not.toMatch(/"output"/);
    });

    it.skipIf(!MEDIA)('reports a short output, and the same run passes at the shipped tolerance', () => {
        // The one branch of 6.5 no fixture can provoke: a file ffprobe reads
        // as whole and ffmpeg copies as short is not something `testsrc` can
        // produce. Driving the tolerance negative makes a correct run look
        // short, which fires the branch on real measurements rather than on a
        // stub — and the second half runs the IDENTICAL project at the shipped
        // tolerance, so this cannot pass by the check being broken.
        const { manifest, output, dir } = mediaProject([
            { id: 's1', file: 'a.mp4' },
            { id: 's2', file: 'b.mp4' },
        ]);
        makeClip(path.join(dir, 'a.mp4'), '320x240', 2);
        makeClip(path.join(dir, 'b.mp4'), '320x240', 2);

        const forced = runStitch([manifest, output], {
            AIV_DRYRUN: 'false',
            AIV_DURATION_TOLERANCE: '-99',
        });
        expect(forced.status, forced.stderr).toBe(8);
        expect(forced.stderr).toMatch(/output is short/);
        expect(forced.stderr).toMatch(/4\.0+s against 4\.0+s of input/);
        expect(forced.stdout).not.toMatch(/"output"/);

        const shipped = runStitch([manifest, output], { AIV_DRYRUN: 'false' });
        expect(shipped.status, shipped.stderr).toBe(0);
    });

    it('leaves the dry-run path untouched — it opens no clip and checks nothing', () => {
        // Runs everywhere, ffmpeg or not, and that is the point: the dry-run
        // contract is that no clip is opened, so neither 6.4 nor 6.5 may reach
        // it. A fake clip is enough precisely because nothing reads it.
        const { manifest, output } = fixtureProject();
        const r = runStitch([manifest, output]);

        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/"dry_run":\s*true/);
        expect(r.stderr).not.toMatch(/ffprobe/);
    });
});
