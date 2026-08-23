/**
 * Model-capabilities manifest schema v2 — the frame axis.
 *
 * Why this test exists: before it, NOTHING under `tests/` read a
 * `src/scripts/ai-video/lib/model-capabilities/*.json` manifest. The schema was
 * prose in that directory's README and `jq` reads scattered across the
 * adapters, so a manifest could gain, lose, or contradict a field and no gate
 * would notice.
 *
 * Schema v2 adds three keys per model entry — `start_frame`, `end_frame`,
 * `frame_lock` — and one rule that cannot be expressed as a shape: `null`
 * means *unknown*, and unknown is NEVER treated as `true`. The coherence case
 * (`end_frame: true` with `start_frame: false`) is asserted against the real
 * production reader in `adapter-common.sh`, not against a validator that lives
 * only in this file — a validator a test owns proves nothing about the shipped
 * path.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const CAPS_DIR = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'lib', 'model-capabilities');
const ADAPTERS = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'adapters');

/** Every manifest in the family, multiplexer and direct adapter alike. */
function manifestFiles(): string[] {
    return fs
        .readdirSync(CAPS_DIR)
        .filter((f) => f.endsWith('.json'))
        .sort();
}

function readManifest(file: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(CAPS_DIR, file), 'utf-8')) as Record<
        string,
        unknown
    >;
}

function models(file: string): Record<string, Record<string, unknown>> {
    const m = readManifest(file).models as Record<string, Record<string, unknown>>;
    return m ?? {};
}

function runAdapter(
    adapter: string,
    args: readonly string[],
    env: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
    const r = spawnSync('bash', [path.join(ADAPTERS, `${adapter}.sh`), ...args], {
        encoding: 'utf-8',
        env: { ...process.env, AIV_DRYRUN: 'true', ...env },
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('model-capabilities schema v2 — the frame keys exist everywhere', () => {
    it('every manifest declares schema 2', () => {
        for (const f of manifestFiles()) {
            expect(readManifest(f).schema, `${f} schema`).toBe(2);
        }
    });

    it('every model entry answers start_frame, end_frame and frame_lock', () => {
        const missing: string[] = [];
        for (const f of manifestFiles()) {
            for (const [id, entry] of Object.entries(models(f))) {
                for (const key of ['start_frame', 'end_frame', 'frame_lock']) {
                    if (!(key in entry)) missing.push(`${f}:${id}:${key}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });

    it('start_frame / end_frame are true, false or null — never absent, never a string', () => {
        for (const f of manifestFiles()) {
            for (const [id, entry] of Object.entries(models(f))) {
                for (const key of ['start_frame', 'end_frame'] as const) {
                    const v = entry[key];
                    expect([true, false, null], `${f}:${id}:${key} = ${JSON.stringify(v)}`).toContain(
                        v,
                    );
                }
            }
        }
    });

    it('frame_lock carries exactly probed_at and psnr_frame0', () => {
        for (const f of manifestFiles()) {
            for (const [id, entry] of Object.entries(models(f))) {
                const lock = entry.frame_lock as Record<string, unknown>;
                expect(Object.keys(lock).sort(), `${f}:${id}:frame_lock keys`).toEqual([
                    'probed_at',
                    'psnr_frame0',
                ]);
            }
        }
    });

    /**
     * A dB value is a MEASUREMENT. Phase 2's live probe is what writes one; a
     * number here before that probe ran would be a fabricated measurement, so
     * this asserts the honest state rather than a range.
     */
    it('no psnr_frame0 is populated — the probe that writes one has not run', () => {
        for (const f of manifestFiles()) {
            for (const [id, entry] of Object.entries(models(f))) {
                const lock = entry.frame_lock as Record<string, unknown>;
                expect(lock.psnr_frame0, `${f}:${id}:psnr_frame0`).toBeNull();
                expect(lock.probed_at, `${f}:${id}:probed_at`).toBeNull();
            }
        }
    });

    /** Unknown is never usable: a `true` must be backed by a probe date. */
    it('every start_frame/end_frame true carries a frame_lock.probed_at date', () => {
        for (const f of manifestFiles()) {
            for (const [id, entry] of Object.entries(models(f))) {
                const lock = entry.frame_lock as Record<string, unknown>;
                if (entry.start_frame === true || entry.end_frame === true) {
                    expect(lock.probed_at, `${f}:${id} claims a frame capability`).not.toBeNull();
                }
            }
        }
    });
});

describe('the four direct adapters have manifests too', () => {
    it.each(['higgsfield', 'kling', 'gemini-veo', 'sora'])('%s.json exists', (adapter) => {
        expect(fs.existsSync(path.join(CAPS_DIR, `${adapter}.json`))).toBe(true);
    });

    it.each(['higgsfield', 'kling', 'gemini-veo', 'sora'])(
        '%s.json is unverified throughout — no citable per-model trace id is in the tree',
        (adapter) => {
            const entries = Object.entries(models(`${adapter}.json`));
            expect(entries.length).toBeGreaterThan(0);
            for (const [id, entry] of entries) {
                expect(entry.verified, `${adapter}:${id}`).toBe(false);
            }
        },
    );

    it('kling capability --model answers from the manifest, not from the audio flag alone', () => {
        const r = runAdapter('kling', ['capability', '--model', 'kling-v2-master']);
        expect(r.status).toBe(0);
        const out = JSON.parse(r.stdout) as Record<string, unknown>;
        expect(out.model).toBe('kling-v2-master');
        expect(out.audio).toBe('none');
        expect(out.end_frame).toBeNull();
        expect(out.start_frame).toBeNull();
    });

    it('higgsfield capability --model answers from the manifest', () => {
        const r = runAdapter('higgsfield', ['capability', '--model', 'dop-turbo']);
        expect(r.status).toBe(0);
        const out = JSON.parse(r.stdout) as Record<string, unknown>;
        expect(out.model).toBe('dop-turbo');
        expect(out.end_frame).toBeNull();
    });

    it('higgsfield capability --preset still answers per-preset (unchanged surface)', () => {
        const r = runAdapter('higgsfield', ['capability', '--preset', 'talk']);
        expect(r.status).toBe(0);
        expect(JSON.parse(r.stdout)).toMatchObject({ audio: 'native', preset: 'talk' });
    });

    it.each([
        ['gemini-veo', 'native'],
        ['sora', 'native'],
        ['kling', 'none'],
    ])('%s bare capability still reports audio=%s (no regression)', (adapter, audio) => {
        const r = runAdapter(adapter, ['capability']);
        expect(r.status).toBe(0);
        expect((JSON.parse(r.stdout) as Record<string, unknown>).audio).toBe(audio);
    });

    it('an unknown model is refused by name, not answered with a default', () => {
        const r = runAdapter('sora', ['capability', '--model', 'sora-9-imaginary']);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/sora-9-imaginary/);
    });
});

describe('the incoherent pair is refused by the production reader', () => {
    /**
     * `end_frame: true` with `start_frame: false` is not a shape error — it is a
     * claim that a model can lock the LAST frame of a clip while being unable to
     * lock the first. The reader refuses it rather than passing it to a planner.
     */
    function fixtureCapsDir(entry: Record<string, unknown>): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-schema-'));
        fs.writeFileSync(
            path.join(dir, 'kling.json'),
            JSON.stringify({
                schema: 2,
                adapter: 'kling',
                models: { 'kling-v2-master': entry },
            }),
        );
        return dir;
    }

    const base = {
        label: 'fixture',
        min_duration: 5,
        max_duration: 10,
        audio_sync: false,
        verified: false,
        frame_lock: { probed_at: '2026-08-23', psnr_frame0: 41.2 },
    };

    it('refuses end_frame:true with start_frame:false and names the model', () => {
        const dir = fixtureCapsDir({ ...base, start_frame: false, end_frame: true });
        const r = runAdapter('kling', ['capability', '--model', 'kling-v2-master'], {
            AIV_MODEL_CAPS_DIR: dir,
        });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/kling-v2-master/);
        expect(r.stderr).toMatch(/start_frame/);
        expect(r.stderr).toMatch(/end_frame/);
    });

    it('accepts the coherent pair (sensitivity: the refusal is not unconditional)', () => {
        const dir = fixtureCapsDir({ ...base, start_frame: true, end_frame: true });
        const r = runAdapter('kling', ['capability', '--model', 'kling-v2-master'], {
            AIV_MODEL_CAPS_DIR: dir,
        });
        expect(r.status).toBe(0);
        expect((JSON.parse(r.stdout) as Record<string, unknown>).end_frame).toBe(true);
    });
});
