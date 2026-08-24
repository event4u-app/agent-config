/**
 * Per-seam sentinels in `resume-scan.sh` (roadmap step 3.2).
 *
 * A handoff seam is state the scene sentinels alone cannot express: clip *i+1*
 * was conditioned on the *rendered last frame* of clip *i*, so re-rolling either
 * side makes the join wrong even when both scenes are individually green. The
 * seam sentinel records the two input hashes the seam was built from; the scan
 * compares them against what is on disk now.
 *
 * The load-bearing assertion is the negative one: exactly the two seams touching
 * the re-rolled clip go stale, and the untouched seam stays green. A scan that
 * invalidated the whole chain would also pass a "lists the two adjacent seams"
 * check, so the third seam is asserted green explicitly.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const RESUME = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'lib', 'resume-scan.sh');

const tmpdirs: string[] = [];
afterEach(() => {
    while (tmpdirs.length > 0) {
        const dir = tmpdirs.pop();
        if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true });
    }
});

function runResume(args: readonly string[], stdin?: string) {
    const r = spawnSync('bash', [RESUME, ...args], { encoding: 'utf-8', input: stdin });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** The ONE canonicalization — asked of the script itself, never re-implemented. */
function canonicalHash(promptJson: unknown): string {
    const r = runResume(['hash'], JSON.stringify(promptJson));
    expect(r.status, r.stderr).toBe(0);
    return r.stdout.trim();
}

interface SceneSpec {
    id: string;
    continuity: 'cut' | 'handoff' | 'connector';
    /** Bumped to simulate a re-roll (a changed render input). */
    seed?: number;
    failed?: boolean;
}

/** Writes `<proj>/scenes/<id>/{prompt.json,final.mp4}` and returns the stamped hash. */
function writeScene(project: string, spec: SceneSpec): string {
    const dir = path.join(project, 'scenes', spec.id);
    fs.mkdirSync(dir, { recursive: true });
    const body: Record<string, unknown> = {
        prompt: { style: 'noir', subject: `scene ${spec.id}` },
        duration: 4,
        continuity: spec.continuity,
        seed: spec.seed ?? 1,
    };
    const hash = canonicalHash(body);
    fs.writeFileSync(path.join(dir, 'prompt.json'), JSON.stringify({ ...body, input_sha256: hash }));
    if (spec.failed === true) {
        fs.writeFileSync(
            path.join(dir, 'error.json'),
            JSON.stringify({ adapter: 'fal', exit_code: 8, user_action: 're-render' }),
        );
    } else {
        fs.writeFileSync(path.join(dir, 'final.mp4'), 'fixture bytes — never opened by the scan');
    }
    return hash;
}

function writeSeam(project: string, from: string, to: string, fromHash: string, toHash: string) {
    const dir = path.join(project, 'seams');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, `${from}__${to}.json`),
        JSON.stringify({
            from,
            to,
            mode: 'handoff',
            from_input_sha256: fromHash,
            to_input_sha256: toHash,
        }),
    );
}

interface SeamRow {
    from: string;
    to: string;
    state: string;
    reason?: string;
}
interface ScanOut {
    scenes: { scene_id: string; state: string }[];
    seams: SeamRow[];
    seams_green: number;
    seams_stale: number;
    seams_missing: number;
}

/** Four scenes, three handoff seams, every sentinel consistent. */
function chainProject(): { project: string; hashes: Record<string, string> } {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-seams-'));
    tmpdirs.push(project);
    const specs: SceneSpec[] = [
        { id: '0001', continuity: 'cut' },
        { id: '0002', continuity: 'handoff' },
        { id: '0003', continuity: 'handoff' },
        { id: '0004', continuity: 'handoff' },
    ];
    const hashes: Record<string, string> = {};
    for (const s of specs) hashes[s.id] = writeScene(project, s);
    const h = (id: string): string => {
        const v = hashes[id];
        expect(v, `no hash recorded for scene ${id}`).toBeTruthy();
        return v as string;
    };
    writeSeam(project, '0001', '0002', h('0001'), h('0002'));
    writeSeam(project, '0002', '0003', h('0002'), h('0003'));
    writeSeam(project, '0003', '0004', h('0003'), h('0004'));
    return { project, hashes };
}

function scan(project: string): ScanOut {
    const r = runResume(['scan', project]);
    expect(r.status, r.stderr).toBe(0);
    return JSON.parse(r.stdout) as ScanOut;
}

function seam(out: ScanOut, from: string, to: string): SeamRow {
    const row = out.seams.find((s) => s.from === from && s.to === to);
    expect(row, `no seam row ${from}->${to} in ${JSON.stringify(out.seams)}`).toBeDefined();
    return row as SeamRow;
}

describe('resume-scan.sh scan — per-seam sentinels (3.2)', () => {
    it('reports every declared seam green when the chain is consistent', () => {
        const { project } = chainProject();
        const out = scan(project);

        expect(out.seams).toHaveLength(3);
        expect(out.seams_green).toBe(3);
        expect(out.seams_stale).toBe(0);
        expect(out.seams_missing).toBe(0);
    });

    it('a re-rolled clip stales exactly the two seams it touches', () => {
        const { project, hashes } = chainProject();
        // Re-roll 0002: a new render input, correctly re-stamped, so the SCENE
        // is green again. Only the seams remember the old input.
        const newHash = writeScene(project, { id: '0002', continuity: 'handoff', seed: 99 });
        expect(newHash).not.toBe(hashes['0002']);

        const out = scan(project);

        expect(seam(out, '0001', '0002').state).toBe('stale');
        expect(seam(out, '0002', '0003').state).toBe('stale');
        expect(seam(out, '0003', '0004').state).toBe('green');
        expect(out.seams_stale).toBe(2);
        expect(out.seams_green).toBe(1);
    });

    it('a failed clip stales exactly the two seams it touches', () => {
        const { project, hashes } = chainProject();
        fs.writeFileSync(
            path.join(project, 'scenes', '0003', 'error.json'),
            JSON.stringify({ adapter: 'fal', exit_code: 8, user_action: 're-render' }),
        );
        expect(hashes['0003']).toBeTruthy();

        const out = scan(project);

        expect(seam(out, '0001', '0002').state).toBe('green');
        expect(seam(out, '0002', '0003').state).toBe('stale');
        expect(seam(out, '0003', '0004').state).toBe('stale');
        expect(out.seams_stale).toBe(2);
    });

    it('a declared handoff with no sentinel is missing, not green', () => {
        const { project } = chainProject();
        fs.rmSync(path.join(project, 'seams', '0002__0003.json'));

        const out = scan(project);

        expect(seam(out, '0002', '0003').state).toBe('missing');
        expect(out.seams_missing).toBe(1);
    });

    it('an all-cut project declares no seams at all', () => {
        const project = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-cuts-'));
        tmpdirs.push(project);
        writeScene(project, { id: '0001', continuity: 'cut' });
        writeScene(project, { id: '0002', continuity: 'cut' });

        const out = scan(project);

        expect(out.seams).toHaveLength(0);
        expect(out.seams_green).toBe(0);
    });

    it('leaves the pre-existing scene report untouched', () => {
        const { project } = chainProject();
        const out = scan(project);

        expect(out.scenes.map((s) => s.state)).toEqual(['green', 'green', 'green', 'green']);
    });
});
