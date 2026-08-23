/**
 * `end_image` — refusal over silent downgrade.
 *
 * The stdin contract gains an optional `end_image`. No adapter can honour it
 * yet: every model entry in every manifest answers `end_frame: null`, and
 * `null` means *unknown*, which is never treated as `true`. So the only correct
 * behaviour today is to REFUSE, by name, naming both the model and the field —
 * never to drop the image and render something the caller did not ask for.
 *
 * Two properties are asserted, and the second is the one that matters:
 *
 *   1. the refusal fires;
 *   2. it fires in the DEFAULT (dry-run) mode, BEFORE `aiv_assert_dryrun`.
 *
 * Property 2 is the lesson `ai_video_stitch_flags.test.ts` paid for: a refusal
 * placed after the dry-run exit is invisible in the mode operators actually
 * use. A `--crossfade` accepted in total silence is exactly this defect one
 * script over, and `stitch.sh:72-76` is the register this follows.
 *
 * Sensitivity is asserted too: against a fixture manifest that DOES claim a
 * probed `end_frame: true`, the same call is not refused. A guard never seen to
 * let something through has unknown sensitivity.
 *
 * No network, no spend: `AIV_DRYRUN` is left at its default `true` throughout,
 * and the gate runs before any provider credential is read.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ADAPTERS = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'adapters');
const CONTRACT = path.join(REPO_ROOT, 'src', 'scripts', 'media', 'lib', 'adapter-contract.md');

/** The exit code this refusal owns. Documented in the contract's code table. */
const EXIT_END_FRAME_UNSUPPORTED = 12;

function submit(
    adapter: string,
    stdin: unknown,
    env: Record<string, string> = {},
    sub = 'submit',
): { status: number; stdout: string; stderr: string } {
    const r = spawnSync('bash', [path.join(ADAPTERS, `${adapter}.sh`), sub], {
        encoding: 'utf-8',
        input: typeof stdin === 'string' ? stdin : JSON.stringify(stdin),
        env: { ...process.env, AIV_DRYRUN: 'true', ...env },
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const PROMPT = {
    prompt: { subject: 'a lone figure', action: 'turns toward the door' },
    duration: 5,
};

const WITH_END = { ...PROMPT, end_image: '/tmp/does-not-need-to-exist/end.png' };

/** A caps dir whose single entry claims a probed end-frame capability. */
function capsDirClaiming(adapter: string, model: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'end-image-'));
    fs.writeFileSync(
        path.join(dir, `${adapter}.json`),
        JSON.stringify({
            schema: 2,
            adapter,
            models: {
                [model]: {
                    label: 'fixture — claims a probed frame lock',
                    min_duration: 5,
                    max_duration: 10,
                    audio_sync: false,
                    verified: false,
                    start_frame: true,
                    end_frame: true,
                    frame_lock: { probed_at: '2026-08-23', psnr_frame0: 38.4 },
                },
            },
        }),
    );
    return dir;
}

describe('end_image is refused when the model cannot frame-lock', () => {
    it(`exits ${EXIT_END_FRAME_UNSUPPORTED} and names the model and the field`, () => {
        const r = submit('kling', WITH_END, { AIV_MODEL: 'kling-v2-master' });

        expect(r.status).toBe(EXIT_END_FRAME_UNSUPPORTED);
        expect(r.stderr).toMatch(/kling-v2-master/);
        expect(r.stderr).toMatch(/end_frame/);
        expect(r.stderr).toMatch(/end_image/);
        // Never a success payload alongside the refusal.
        expect(r.stdout).not.toMatch(/"job_id"/);
    });

    it('fires in the DEFAULT dry-run mode — before the live-call gate', () => {
        // Without the gate this call exits 4 ("live call refused") and the
        // dropped end_image is never mentioned. Exit 4 here is the regression.
        const r = submit('kling', WITH_END, { AIV_MODEL: 'kling-v2-master' });
        expect(r.status).not.toBe(4);
        expect(r.status).toBe(EXIT_END_FRAME_UNSUPPORTED);
    });

    it('refuses identically on a multiplexer adapter', () => {
        const r = submit('fal', {
            ...WITH_END,
            model_id: 'fal-ai/ltx-2/text-to-video',
        });
        expect(r.status).toBe(EXIT_END_FRAME_UNSUPPORTED);
        expect(r.stderr).toMatch(/fal-ai\/ltx-2\/text-to-video/);
        expect(r.stderr).toMatch(/end_frame/);
    });

    it('refuses when the model is not in the manifest at all — absent is not true', () => {
        const r = submit('kling', WITH_END, { AIV_MODEL: 'kling-v9-imaginary' });
        expect(r.status).toBe(EXIT_END_FRAME_UNSUPPORTED);
        expect(r.stderr).toMatch(/kling-v9-imaginary/);
    });
});

describe('the gate is conditional, not blanket', () => {
    it('a submit without end_image is untouched (still the dry-run refusal)', () => {
        const r = submit('kling', PROMPT, { AIV_MODEL: 'kling-v2-master' });
        expect(r.status).toBe(4);
        expect(r.stderr).toMatch(/live call refused/);
    });

    it('an explicit null end_image is not a request for one', () => {
        const r = submit(
            'kling',
            { ...PROMPT, end_image: null },
            { AIV_MODEL: 'kling-v2-master' },
        );
        expect(r.status).toBe(4);
    });

    it('SENSITIVITY: a probed end_frame:true manifest lets the same call through', () => {
        const dir = capsDirClaiming('kling', 'kling-v2-master');
        const r = submit('kling', WITH_END, {
            AIV_MODEL: 'kling-v2-master',
            AIV_MODEL_CAPS_DIR: dir,
        });
        // Not the refusal — the call reaches the ordinary live-call gate.
        expect(r.status).not.toBe(EXIT_END_FRAME_UNSUPPORTED);
        expect(r.status).toBe(4);
    });

    it('poll is not gated — it consumes no contract stdin', () => {
        const r = submit('kling', WITH_END, { AIV_MODEL: 'kling-v2-master' }, 'poll');
        expect(r.status).not.toBe(EXIT_END_FRAME_UNSUPPORTED);
    });

    it('capability is not gated', () => {
        const r = submit('kling', WITH_END, {}, 'capability');
        expect(r.status).toBe(0);
    });
});

describe('the contract documents the field and its exit code', () => {
    const doc = fs.readFileSync(CONTRACT, 'utf-8');

    it('names end_image in the stdin contract', () => {
        expect(doc).toMatch(/end_image/);
    });

    it('carries an exit-code table that documents the new code', () => {
        expect(doc).toMatch(new RegExp(`\\|\\s*\`?${EXIT_END_FRAME_UNSUPPORTED}\`?\\s*\\|`));
        expect(doc).toMatch(/refusal over silent downgrade|never dropped|refuses by name/i);
    });
});
