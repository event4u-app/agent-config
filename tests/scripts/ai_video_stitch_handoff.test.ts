/**
 * `stitch.sh --mode handoff` — the re-encode path the script's own refusal
 * message asked for (roadmap steps 3.4 and 3.5).
 *
 * Two things are pinned, and the second is the reason the first is safe:
 *
 *  1. The re-encode path exists, and `--xfade <s>` shortens the output by
 *     exactly the fade at a `handoff` seam. Measured with `ffprobe` on real
 *     ffmpeg-generated clips — the offset arithmetic (`offset = acc - xfade`)
 *     is the classic trap here, and a duration assertion is the only thing that
 *     catches an off-by-one-clip error in it.
 *  2. `--mode cut` is unchanged: `--crossfade` still exits 2, `--xfade` is
 *     refused outside handoff mode, and a plain cut run still stream-copies.
 *     `tests/scripts/ai_video_stitch_flags.test.ts` pins the refusal in the
 *     default mode; this file pins that adding `--mode` did not create a way
 *     around it.
 *
 * The port-invariant assertions (3.5) live here too: the invariants are a claim
 * about *this script*, so the check belongs next to the behaviour it describes.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const STITCH = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'stitch.sh');
const CONTRACT = path.join(REPO_ROOT, 'docs', 'contracts', 'skill-bundled-assets.md');

const HAS_FFMPEG = spawnSync('ffmpeg', ['-version'], { encoding: 'utf-8' }).status === 0;
const HAS_FFPROBE = spawnSync('ffprobe', ['-version'], { encoding: 'utf-8' }).status === 0;
const CAN_RENDER = HAS_FFMPEG && HAS_FFPROBE;

const tmpdirs: string[] = [];
afterEach(() => {
    while (tmpdirs.length > 0) {
        const dir = tmpdirs.pop();
        if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true });
    }
});

function runStitch(args: readonly string[], env: Record<string, string> = {}) {
    const r = spawnSync('bash', [STITCH, ...args], {
        encoding: 'utf-8',
        env: { ...process.env, ...env },
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function probeDuration(file: string): number {
    const r = spawnSync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
        { encoding: 'utf-8' },
    );
    expect(r.status, r.stderr ?? '').toBe(0);
    return Number.parseFloat((r.stdout ?? '').trim());
}

/**
 * Two real 2-second clips plus a manifest whose second scene declares a
 * `handoff` boundary. Clips are generated locally by ffmpeg — never fetched.
 */
function renderableProject(secondContinuity = 'handoff'): {
    manifest: string;
    output: string;
    dir: string;
} {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stitch-handoff-'));
    tmpdirs.push(dir);
    const clips: string[] = [];
    for (const [i, pattern] of ['testsrc', 'smptebars'].entries()) {
        const clip = path.join(dir, `scene-${i + 1}.mp4`);
        const r = spawnSync(
            'ffmpeg',
            [
                '-loglevel', 'error', '-y',
                '-f', 'lavfi', '-i', `${pattern}=duration=2:size=320x240:rate=25`,
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clip,
            ],
            { encoding: 'utf-8' },
        );
        expect(r.status, r.stderr ?? '').toBe(0);
        clips.push(clip);
    }
    const manifest = path.join(dir, 'manifest.json');
    fs.writeFileSync(
        manifest,
        JSON.stringify([
            { scene_id: '0001', clip_path: clips[0], audio_embedded: true, duration: 2, continuity: 'cut' },
            { scene_id: '0002', clip_path: clips[1], audio_embedded: true, duration: 2, continuity: secondContinuity },
        ]),
    );
    return { manifest, output: path.join(dir, 'final.mp4'), dir };
}

describe('stitch.sh — --mode cut is unchanged (3.4)', () => {
    it('--mode cut --crossfade 0.2 still exits 2', () => {
        const { manifest, output } = renderableProjectOrStub();
        const r = runStitch([manifest, output, '--mode', 'cut', '--crossfade', '0.2']);

        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/--crossfade is not implemented/);
        expect(fs.existsSync(output)).toBe(false);
    });

    it('--crossfade with no --mode (the default is cut) still exits 2', () => {
        const { manifest, output } = renderableProjectOrStub();
        const r = runStitch([manifest, output, '--crossfade', '0.2']);

        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/will not be silently downgraded/);
    });

    it('--xfade is refused in cut mode rather than silently ignored', () => {
        const { manifest, output } = renderableProjectOrStub();
        const r = runStitch([manifest, output, '--xfade', '0.2']);

        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/--xfade/);
        expect(r.stderr).toMatch(/--mode handoff/);
    });

    it('an unknown --mode value is refused and names the value', () => {
        const { manifest, output } = renderableProjectOrStub();
        const r = runStitch([manifest, output, '--mode', 'crossfade']);

        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/crossfade/);
    });

    it('a default dry run emits the historical JSON — no new key at all', () => {
        // Not merely "mode is cut": an ADDITIVE key is still a changed stdout
        // for every existing caller, so cut mode carries no `mode` key.
        const { manifest, output } = renderableProjectOrStub();
        const r = runStitch([manifest, output]);

        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/"dry_run":\s*true/);
        expect(r.stdout).not.toMatch(/"mode"/);
    });

    it('--mode cut explicitly is the same stdout as no flag at all', () => {
        const a = renderableProjectOrStub();
        const b = renderableProjectOrStub();
        const bare = runStitch([a.manifest, a.output]);
        const explicit = runStitch([b.manifest, b.output, '--mode', 'cut']);

        // Only the tmpdir path differs; normalise it away.
        const norm = (s: string, dir: string) => s.split(dir).join('<DIR>');
        expect(norm(explicit.stdout, b.dir)).toBe(norm(bare.stdout, a.dir));
        expect(norm(explicit.stderr, b.dir)).toBe(norm(bare.stderr, a.dir));
    });
});

describe('stitch.sh — --mode handoff bounds (3.4)', () => {
    it('refuses an --xfade above the 0.25 s ceiling', () => {
        const { manifest, output } = renderableProjectOrStub();
        const r = runStitch([manifest, output, '--mode', 'handoff', '--xfade', '0.4']);

        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/0\.25/);
    });

    it('states in the dry-run plan that handoff re-encodes and drops audio', () => {
        const { manifest, output } = renderableProjectOrStub();
        const r = runStitch([manifest, output, '--mode', 'handoff', '--xfade', '0.2']);

        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/"mode":\s*"handoff"/);
        expect(r.stderr).toMatch(/re-encode/i);
        expect(r.stderr).toMatch(/-an/);
    });
});

describe.skipIf(!CAN_RENDER)('stitch.sh — --mode handoff renders (3.4)', () => {
    it('--xfade 0.2 at a handoff seam yields sum - 0.2 s', () => {
        const { manifest, output } = renderableProject();
        const r = runStitch([manifest, output, '--mode', 'handoff', '--xfade', '0.2'], {
            AIV_DRYRUN: 'false',
        });

        expect(r.status, r.stderr).toBe(0);
        expect(fs.existsSync(output)).toBe(true);
        const sum = 2 + 2;
        expect(probeDuration(output)).toBeCloseTo(sum - 0.2, 1);
    });

    it('handoff without --xfade keeps the full sum (a hard cut, re-encoded)', () => {
        const { manifest, output } = renderableProject();
        const r = runStitch([manifest, output, '--mode', 'handoff'], { AIV_DRYRUN: 'false' });

        expect(r.status, r.stderr).toBe(0);
        expect(probeDuration(output)).toBeCloseTo(4, 1);
    });

    it('--xfade is applied only at handoff seams, never at a cut seam', () => {
        const { manifest, output } = renderableProject('cut');
        const r = runStitch([manifest, output, '--mode', 'handoff', '--xfade', '0.2'], {
            AIV_DRYRUN: 'false',
        });

        expect(r.status, r.stderr).toBe(0);
        expect(probeDuration(output)).toBeCloseTo(4, 1);
    });

    it('--mode cut still stream-copies to the full sum', () => {
        const { manifest, output } = renderableProject();
        const r = runStitch([manifest, output], { AIV_DRYRUN: 'false' });

        expect(r.status, r.stderr).toBe(0);
        expect(probeDuration(output)).toBeCloseTo(4, 1);
    });
});

describe('port invariants for a bundled executable (3.5)', () => {
    const INVARIANTS = [
        /hard-cut default/i,
        /refusal over silent downgrade/i,
        /handoff frame = rendered frame/i,
    ];

    it('stitch.sh carries the three invariants in its header', () => {
        const header = fs.readFileSync(STITCH, 'utf-8').split('\nset -euo pipefail')[0];
        expect(header).toMatch(/port_invariants/);
        for (const re of INVARIANTS) expect(header).toMatch(re);
    });

    it('the header no longer asks for a roadmap item that now exists', () => {
        const src = fs.readFileSync(STITCH, 'utf-8');
        expect(src).not.toMatch(/open a roadmap item for the re-encode path/);
    });

    it('the contract has the port-invariants section with the piloted three', () => {
        const doc = fs.readFileSync(CONTRACT, 'utf-8');
        expect(doc).toMatch(/^##+ .*[Pp]ort invariants/m);
        expect(doc).toMatch(/port_invariants:/);
        for (const re of INVARIANTS) expect(doc).toMatch(re);
    });

    it('the contract cites the field case by neutral descriptor, never by name', () => {
        const doc = fs.readFileSync(CONTRACT, 'utf-8');
        expect(doc).toMatch(/Source D/);
        expect(doc).toMatch(/## Provenance/);
        // source-confidentiality: an ENC1 pin, never a readable source name.
        expect(doc).toMatch(/ENC1:/);
    });

    it('the contract cites no specific roadmap file (no-roadmap-references)', () => {
        const doc = fs.readFileSync(CONTRACT, 'utf-8');
        expect(doc).not.toMatch(/agents\/roadmaps\/(?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9_-]*\.md/i);
    });
});

/**
 * The flag-contract cases need a manifest whose clip resolves, but never a real
 * video: every one of them exits before ffmpeg. Generating h264 for them would
 * make CI (no ffmpeg) skip assertions that do not need it.
 */
function renderableProjectOrStub(): { manifest: string; output: string; dir: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stitch-handoff-stub-'));
    tmpdirs.push(dir);
    const clip = path.join(dir, 'scene-1.mp4');
    fs.writeFileSync(clip, 'not a real mp4 — these cases never reach ffmpeg');
    const manifest = path.join(dir, 'manifest.json');
    fs.writeFileSync(
        manifest,
        JSON.stringify([
            { scene_id: '0001', clip_path: clip, audio_embedded: true, duration: 2, continuity: 'cut' },
        ]),
    );
    return { manifest, output: path.join(dir, 'final.mp4'), dir };
}
