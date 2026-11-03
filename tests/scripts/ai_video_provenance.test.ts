/**
 * `embed-provenance.sh` — the one mechanical carrier behind the media
 * disclosure and transparency policies.
 *
 * Two layers:
 *
 * 1. The port of the deleted Python suite (`tests/test_ai_video_provenance.py`,
 *    removed in the py2ts migration without a TypeScript port): required sidecar
 *    fields, the determinism hook, input refusal, `extra` merge, no strip path.
 * 2. Rows for what the carriers really guarantee, each reproduced rather than
 *    asserted from prose: a stream copy strips the container comment, the mp4
 *    muxer drops keys it does not know, the wording and the C2PA source type
 *    follow the assertion, and the sidecar names the hash of the final bytes.
 *
 * The defect rows drive the legacy `embed` entry on purpose: it has existed
 * since the script shipped, so a red row names the defect instead of "unknown
 * subcommand", and a green row proves old callers get the corrected carriers.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'lib', 'embed-provenance.sh');

const has = (cmd: string, arg = '-version'): boolean => spawnSync(cmd, [arg]).status === 0;
const CAN_RUN = has('bash', '--version') && has('jq', '--version');
const HAS_FFMPEG = CAN_RUN && has('ffmpeg') && has('ffprobe');
const HAS_C2PATOOL = CAN_RUN && has('c2patool', '--version');

const NOW = '2026-06-07T12:00:00Z';
const BASE_PATH = '/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin';

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

const run = (argv: readonly string[], stdin?: string, env: Record<string, string> = {}): RunResult => {
    const r = spawnSync('bash', [SCRIPT, ...argv], {
        input: stdin,
        encoding: 'utf-8',
        timeout: 30_000,
        env: { PATH: BASE_PATH, AIV_PROVENANCE_NOW: NOW, ...env },
    });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
};

const sha256 = (file: string): string => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

let dir = '';
let counter = 0;

const freshDir = (): string => {
    counter += 1;
    const d = path.join(dir, `case-${String(counter)}`);
    fs.mkdirSync(d);
    return d;
};

const byteArtifact = (suffix = '.bin'): string => {
    const artifact = path.join(freshDir(), `final${suffix}`);
    fs.writeFileSync(artifact, Buffer.from([0]));
    return artifact;
};

const videoArtifact = (): string => {
    const artifact = path.join(freshDir(), 'final.mp4');
    const r = spawnSync('ffmpeg', [
        '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=1:size=64x64:rate=5',
        '-pix_fmt', 'yuv420p', artifact,
    ]);
    if (r.status !== 0) throw new Error(`fixture mp4 failed: ${String(r.stderr)}`);
    return artifact;
};

const payload = (artifact: string, extra: Record<string, unknown> = {}): string =>
    JSON.stringify({ artifact_path: artifact, provider: 'gemini-veo', model: 'veo-3.0', ...extra });

const formatTags = (file: string): Record<string, string> => {
    const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format_tags', '-of', 'json', file], {
        encoding: 'utf-8',
    });
    const parsed = JSON.parse(r.stdout) as { format?: { tags?: Record<string, string> } };
    return parsed.format?.tags ?? {};
};

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf-8')) as T;

interface Sidecar {
    assertion: string;
    provider: string;
    model: string;
    created: string;
    generator: string;
    prompt_sha256?: string;
    artifact_sha256?: string;
    digital_source_type?: string;
    [k: string]: unknown;
}

// skip-reason: tool absent — bash and jq are system tools the script requires
describe.skipIf(!CAN_RUN)('embed-provenance.sh — port of the deleted suite', () => {
    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiv-provenance-'));
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('sidecar carries the required policy fields', () => {
        const artifact = byteArtifact();
        const r = run(['embed'], payload(artifact, { prompt_sha256: 'ab'.repeat(32) }));
        expect(r.status, r.stderr).toBe(0);
        const out = JSON.parse(r.stdout) as { provenance_path: string; c2pa: string };
        expect(fs.realpathSync(out.provenance_path)).toBe(fs.realpathSync(`${artifact}.provenance.json`));
        const data = readJson<Sidecar>(out.provenance_path);
        expect(data.assertion).toBe('c2pa.ai_generated');
        expect(data.provider).toBe('gemini-veo');
        expect(data.model).toBe('veo-3.0');
        expect(data.created).toBe(NOW);
        expect(data.prompt_sha256).toBe('ab'.repeat(32));
        expect(data.generator).toBeTruthy();
        expect(['c2patool', 'sidecar-only']).toContain(out.c2pa);
    });

    it('extra fields merge without clobbering required ones', () => {
        const r = run(['embed'], payload(byteArtifact(), { extra: { distribution: 'internal-review' } }));
        expect(r.status, r.stderr).toBe(0);
        const data = readJson<Sidecar>((JSON.parse(r.stdout) as { provenance_path: string }).provenance_path);
        expect(data.distribution).toBe('internal-review');
        expect(data.provider).toBe('gemini-veo');
    });

    it('accepts the ai_edited assertion', () => {
        const r = run(['embed'], payload(byteArtifact(), { assertion: 'ai_edited' }));
        expect(r.status, r.stderr).toBe(0);
        expect((JSON.parse(r.stdout) as { assertion: string }).assertion).toBe('c2pa.ai_edited');
    });

    it.each([
        [{ provider: '' }, 'provider required'],
        [{ model: '' }, 'model required'],
        [{ assertion: 'human_made' }, 'assertion must be'],
        [{ prompt_sha256: 'nothex' }, 'prompt_sha256'],
    ])('refuses invalid input %j', (bad, fragment) => {
        const r = run(['embed'], payload(byteArtifact(), bad));
        expect(r.status, r.stderr).toBe(7);
        expect(r.stderr).toContain(fragment);
    });

    it('refuses a missing artifact', () => {
        const r = run(['embed'], payload(path.join(freshDir(), 'nope.mp4')));
        expect(r.status).not.toBe(0);
    });

    it('exits 2 on an unknown subcommand', () => {
        expect(run(['strip']).status).toBe(2);
    });

    it('ships no strip or remove path', () => {
        const source = fs.readFileSync(SCRIPT, 'utf-8');
        for (const verb of ['remove-provenance', 'strip-provenance', 'map_metadata -1']) {
            expect(source).not.toContain(verb);
        }
        const dispatch = [...source.matchAll(/^ {2}([a-z-]+)\) shift;/gm)].map((m) => m[1]);
        expect(dispatch.length).toBeGreaterThan(0);
        for (const verb of dispatch) {
            expect(['embed', 'finish', 'manifest']).toContain(verb);
        }
    });
});

// skip-reason: tool absent — bash and jq are system tools the script requires
describe.skipIf(!CAN_RUN)('embed-provenance.sh — what each carrier really guarantees', () => {
    beforeAll(() => {
        if (dir === '' || !fs.existsSync(dir)) dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiv-provenance-'));
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('sidecar names the sha256 of the final bytes', () => {
        const artifact = byteArtifact('.png');
        const r = run(['embed'], payload(artifact));
        expect(r.status, r.stderr).toBe(0);
        const data = readJson<Sidecar>(`${artifact}.provenance.json`);
        // Red at the pin: the sidecar was written before the container tag and
        // the C2PA step and never carried a hash, so it could not be tied to
        // the file it describes.
        expect(data.artifact_sha256).toBe(sha256(artifact));
    });

    it('the C2PA source type follows the assertion (edited ≠ fully generated)', () => {
        const generated = byteArtifact();
        const edited = byteArtifact();
        expect(run(['embed'], payload(generated)).status).toBe(0);
        expect(run(['embed'], payload(edited, { assertion: 'ai_edited' })).status).toBe(0);
        // Red at the pin: `digitalSourceType` was hard-coded to
        // trainedAlgorithmicMedia for every assertion, and nothing outside a
        // c2patool run could read it back.
        const typeOf = (artifact: string): string => {
            const m = run(['manifest', `${artifact}.provenance.json`]);
            expect(m.status, m.stderr).toBe(0);
            const manifest = JSON.parse(m.stdout) as {
                assertions: Array<{ label: string; data: { actions?: Array<{ digitalSourceType: string }> } }>;
            };
            const actions = manifest.assertions.find((a) => a.label === 'c2pa.actions');
            return actions?.data.actions?.[0]?.digitalSourceType ?? '';
        };
        expect(typeOf(generated)).toMatch(/\/trainedAlgorithmicMedia$/);
        expect(typeOf(edited)).toMatch(/\/compositeWithTrainedAlgorithmicMedia$/);
        expect(readJson<Sidecar>(`${edited}.provenance.json`).digital_source_type).toBe(
            'compositeWithTrainedAlgorithmicMedia',
        );
    });

    it('finish runs the fixed carrier order and reserves the visible slot as not applied', () => {
        const r = run(['finish'], payload(byteArtifact('.jpg')));
        expect(r.status, r.stderr).toBe(0);
        const out = JSON.parse(r.stdout) as {
            order: string[];
            carriers: Record<string, { status: string; removable?: boolean }>;
        };
        expect(out.order).toEqual(['visible', 'embedded', 'sidecar', 'c2pa']);
        expect(out.carriers.visible?.status).toBe('not-applied (rule pending)');
        expect(out.carriers.sidecar?.status).toBe('written');
        expect(out.carriers.sidecar?.removable).toBe(true);
    });
});

// skip-reason: tool absent — ffmpeg and ffprobe are system tools, not dependencies
describe.skipIf(!HAS_FFMPEG)('embed-provenance.sh — container carrier on a real mp4', () => {
    beforeAll(() => {
        if (dir === '' || !fs.existsSync(dir)) dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiv-provenance-'));
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('a stream copy strips the comment, so the embedded carrier is reported removable', () => {
        const artifact = videoArtifact();
        const r = run(['embed'], payload(artifact));
        expect(r.status, r.stderr).toBe(0);
        expect(formatTags(artifact).comment).toMatch(/AI-generated/);

        const stripped = path.join(path.dirname(artifact), 'stripped.mp4');
        const s = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', artifact, '-map_metadata', '-1', '-c', 'copy', stripped]);
        expect(s.status).toBe(0);
        expect(formatTags(stripped).comment).toBeUndefined();

        // Red at the pin: the script called this comment the "non-removable"
        // disclosure, and reported no carrier classification at all.
        const source = fs.readFileSync(SCRIPT, 'utf-8');
        expect(source).not.toMatch(/non-removable disclosure/i);
        const out = JSON.parse(r.stdout) as { carriers?: Record<string, { removable?: boolean }> };
        expect(out.carriers?.embedded?.removable).toBe(true);
    });

    it('every container key the script writes survives the mp4 muxer', () => {
        const artifact = videoArtifact();
        const r = run(['embed'], payload(artifact));
        expect(r.status, r.stderr).toBe(0);
        const source = fs.readFileSync(SCRIPT, 'utf-8');
        const written = [...source.matchAll(/-metadata\s+([a-z_]+)=/g)].map((m) => m[1] as string);
        expect(written.length).toBeGreaterThan(0);
        const tags = formatTags(artifact);
        // Red at the pin: `-metadata ai_generated=true` is silently dropped by
        // the mp4 muxer, so the second flag the script believed it wrote never existed.
        for (const key of written) {
            expect(tags, `container key ${key}`).toHaveProperty(key);
        }
    });

    it('edited material is not labelled "AI-generated" in the container', () => {
        const artifact = videoArtifact();
        const r = run(['embed'], payload(artifact, { assertion: 'ai_edited' }));
        expect(r.status, r.stderr).toBe(0);
        const comment = formatTags(artifact).comment ?? '';
        // Red at the pin: the comment said "AI-generated content" for ai_edited.
        expect(comment).not.toMatch(/AI-generated/);
        expect(comment).toMatch(/AI-modified/);
    });

    it('finish on an mp4: sidecar hash equals the final bytes after every carrier ran', () => {
        const artifact = videoArtifact();
        const r = run(['finish'], payload(artifact));
        expect(r.status, r.stderr).toBe(0);
        const out = JSON.parse(r.stdout) as { artifact_sha256: string; carriers: Record<string, { status: string }> };
        expect(out.carriers.embedded?.status).toBe('container-tags');
        expect(out.artifact_sha256).toBe(sha256(artifact));
        expect(readJson<Sidecar>(`${artifact}.provenance.json`).artifact_sha256).toBe(sha256(artifact));
    });

    it('re-finish after a re-cut re-binds the sidecar to the new bytes', () => {
        const artifact = videoArtifact();
        expect(run(['finish'], payload(artifact)).status).toBe(0);
        const first = readJson<Sidecar>(`${artifact}.provenance.json`).artifact_sha256;
        const recut = spawnSync('ffmpeg', [
            '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=64x64:rate=5', '-pix_fmt', 'yuv420p', artifact,
        ]);
        expect(recut.status).toBe(0);
        expect(sha256(artifact)).not.toBe(first);
        expect(run(['finish'], payload(artifact)).status).toBe(0);
        expect(readJson<Sidecar>(`${artifact}.provenance.json`).artifact_sha256).toBe(sha256(artifact));
    });
});

// skip-reason: tool absent — c2patool is operator-installed; the suite ships no signing keys or certificates
describe.skipIf(!HAS_C2PATOOL)('embed-provenance.sh — C2PA carrier (operator-installed c2patool)', () => {
    beforeAll(() => {
        if (dir === '' || !fs.existsSync(dir)) dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiv-provenance-'));
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('C2PA runs last and the sidecar still names the final bytes', () => {
        const artifact = byteArtifact('.jpg');
        const r = run(['finish'], payload(artifact), { PATH: process.env['PATH'] ?? BASE_PATH });
        expect(r.status, r.stderr).toBe(0);
        const out = JSON.parse(r.stdout) as { c2pa: string };
        expect(['c2patool', 'sidecar-only']).toContain(out.c2pa);
        expect(readJson<Sidecar>(`${artifact}.provenance.json`).artifact_sha256).toBe(sha256(artifact));
    });
});
