/**
 * Seam-handoff declaration (`CONTINUITY:` in the blueprint) and the seam plan
 * the operator sees before any spend.
 *
 * Why these two live in one file: `parse-blueprint.sh` emits the per-scene
 * `continuity` value and `seam-plan.sh` is the only reader of it, so a test that
 * pinned one without the other would pass while the pair disagreed. The seam
 * plan is also where the connector gate lives, and the gate's whole point is
 * that `null` is not `true` — an unknown capability must refuse by name rather
 * than fall through to a generation the operator did not ask for.
 *
 * Nothing here calls a provider. `seam-plan.sh` is a pure planner: it reads
 * scene JSON plus the local capability manifests and prints.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const LIB = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'lib');
const PARSE = path.join(LIB, 'parse-blueprint.sh');
const SEAM_PLAN = path.join(LIB, 'seam-plan.sh');

const tmpdirs: string[] = [];
function tmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpdirs.push(dir);
    return dir;
}
afterEach(() => {
    while (tmpdirs.length > 0) {
        const dir = tmpdirs.pop();
        if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true });
    }
});

function run(script: string, args: readonly string[], stdin?: string) {
    const r = spawnSync('bash', [script, ...args], {
        encoding: 'utf-8',
        input: stdin,
        env: { ...process.env },
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** A minimal valid 12-block blueprint; `continuity` is appended when given. */
function blueprint(continuity?: string): string {
    const lines = [
        'STYLE: cinematic neo-noir',
        'SUBJECT: a lone figure in a long coat',
        'ENVIRONMENT: rain-slick alley',
        'ACTION: walks toward the camera',
        'CAMERA: slow dolly in',
        'LENS: 35mm',
        'LIGHTING: sodium streetlight from behind',
        'MOOD: tense',
        'DURATION: 4',
        'NEGATIVE: centered framing, text overlay',
    ];
    if (continuity !== undefined) lines.push(`CONTINUITY: ${continuity}`);
    return `${lines.join('\n')}\n`;
}

/** Write one scene JSON, optionally carrying the model identity. */
function scene(
    dir: string,
    name: string,
    continuity: string,
    model?: { adapter: string; model_id: string },
): string {
    const parsed = run(PARSE, [], blueprint(continuity));
    expect(parsed.status, `parse-blueprint failed for ${name}: ${parsed.stderr}`).toBe(0);
    const obj = JSON.parse(parsed.stdout) as Record<string, unknown>;
    if (model !== undefined) {
        obj.adapter = model.adapter;
        obj.model_id = model.model_id;
    }
    const file = path.join(dir, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(obj, null, 2));
    return file;
}

/** A capability manifest dir holding one adapter file with the given models. */
function capabilities(dir: string, adapter: string, models: Record<string, unknown>): string {
    const capDir = path.join(dir, 'caps');
    fs.mkdirSync(capDir, { recursive: true });
    fs.writeFileSync(
        path.join(capDir, `${adapter}.json`),
        JSON.stringify({ schema: 1, adapter, models }, null, 2),
    );
    return capDir;
}

describe('parse-blueprint.sh — the CONTINUITY block (3.1)', () => {
    it('defaults to cut when the block is absent', () => {
        const r = run(PARSE, [], blueprint());
        expect(r.status).toBe(0);
        expect(JSON.parse(r.stdout).continuity).toBe('cut');
    });

    it('accepts cut, handoff and connector', () => {
        for (const value of ['cut', 'handoff', 'connector']) {
            const r = run(PARSE, [], blueprint(value));
            expect(r.status, `${value}: ${r.stderr}`).toBe(0);
            expect(JSON.parse(r.stdout).continuity).toBe(value);
        }
    });

    it('rejects an unknown value and names it', () => {
        const r = run(PARSE, [], blueprint('crossfade'));
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/crossfade/);
        expect(r.stderr).toMatch(/continuity/i);
        expect(r.stdout).toBe('');
    });
});

describe('seam-plan.sh — the preview the operator sees (3.1)', () => {
    it('lists both handoff boundaries and the generation count for a 4-scene chain', () => {
        const dir = tmp('seam-plan-');
        const files = [
            scene(dir, 'scene-1', 'cut'),
            scene(dir, 'scene-2', 'handoff'),
            scene(dir, 'scene-3', 'cut'),
            scene(dir, 'scene-4', 'handoff'),
        ];
        const r = run(SEAM_PLAN, files);

        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toMatch(/seam 1->2 .*: handoff/);
        expect(r.stdout).toMatch(/seam 2->3 .*: cut/);
        expect(r.stdout).toMatch(/seam 3->4 .*: handoff/);
        expect(r.stdout).toMatch(/gens: 4\b/);
        // The sequential trade is part of the preview, not a surprise later.
        expect(r.stdout).toMatch(/sequential=true/);
        expect(r.stdout).toMatch(/handoff=2/);
    });

    it('says sequential=false when every boundary is a cut', () => {
        const dir = tmp('seam-plan-cuts-');
        const files = [scene(dir, 'a', 'cut'), scene(dir, 'b', 'cut')];
        const r = run(SEAM_PLAN, files);

        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toMatch(/sequential=false/);
        expect(r.stdout).toMatch(/gens: 2\b/);
    });

    it('handles a project path containing a space', () => {
        // A space-separated argument string would split this into two paths.
        const dir = tmp('seam plan spaced-');
        const files = [scene(dir, 'scene-1', 'cut'), scene(dir, 'scene-2', 'handoff')];
        const r = run(SEAM_PLAN, files);

        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toMatch(/scenes=2/);
        expect(r.stdout).toMatch(/gens: 2\b/);
    });

    it('refuses a non-cut continuity on the first scene — it has no previous clip', () => {
        const dir = tmp('seam-plan-first-');
        const files = [scene(dir, 'lead', 'handoff'), scene(dir, 'b', 'cut')];
        const r = run(SEAM_PLAN, files);

        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/lead/);
        expect(r.stderr).toMatch(/no previous scene/);
    });
});

describe('seam-plan.sh — the connector gate (3.3)', () => {
    const MODEL_A = 'fal-ai/wan/v2.2-a14b/text-to-video';
    const MODEL_B = 'fal-ai/ltx-2/text-to-video';

    it('refuses the connector when one side reports end_frame: null, naming the model', () => {
        const dir = tmp('connector-null-');
        const capDir = capabilities(dir, 'fal', {
            [MODEL_A]: { end_frame: true },
            [MODEL_B]: { end_frame: null },
        });
        const files = [
            scene(dir, 'scene-1', 'cut', { adapter: 'fal', model_id: MODEL_A }),
            scene(dir, 'scene-2', 'connector', { adapter: 'fal', model_id: MODEL_B }),
        ];
        const r = run(SEAM_PLAN, [...files, '--capabilities-dir', capDir]);

        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/connector/i);
        expect(r.stderr).toContain(MODEL_B);
        expect(r.stderr).toMatch(/end_frame/);
    });

    it('reports a probed end_frame: false as false, not as null', () => {
        // jq's `//` operator treats `false` as absent; using it here would make
        // the refusal message blame "null" for a value that was actually probed.
        const dir = tmp('connector-false-');
        const capDir = capabilities(dir, 'fal', {
            [MODEL_A]: { end_frame: true },
            [MODEL_B]: { end_frame: false },
        });
        const files = [
            scene(dir, 'scene-1', 'cut', { adapter: 'fal', model_id: MODEL_A }),
            scene(dir, 'scene-2', 'connector', { adapter: 'fal', model_id: MODEL_B }),
        ];
        const r = run(SEAM_PLAN, [...files, '--capabilities-dir', capDir]);

        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain(MODEL_B);
        expect(r.stderr).toMatch(/end_frame=false/);
    });

    it('treats a missing end_frame key exactly like null', () => {
        const dir = tmp('connector-missing-');
        const capDir = capabilities(dir, 'fal', {
            [MODEL_A]: { end_frame: true },
            // No frame keys at all — Phase 1 may not have landed yet.
            [MODEL_B]: { label: 'LTX-2' },
        });
        const files = [
            scene(dir, 'scene-1', 'cut', { adapter: 'fal', model_id: MODEL_A }),
            scene(dir, 'scene-2', 'connector', { adapter: 'fal', model_id: MODEL_B }),
        ];
        const r = run(SEAM_PLAN, [...files, '--capabilities-dir', capDir]);

        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain(MODEL_B);
    });

    it('refuses when the model identity is unknown — an unnamed model is not a probed one', () => {
        const dir = tmp('connector-unknown-');
        const capDir = capabilities(dir, 'fal', { [MODEL_A]: { end_frame: true } });
        const files = [scene(dir, 'scene-1', 'cut'), scene(dir, 'scene-2', 'connector')];
        const r = run(SEAM_PLAN, [...files, '--capabilities-dir', capDir]);

        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/end_frame/);
    });

    it('reads 2N-1 generations when every boundary is a probed connector', () => {
        const dir = tmp('connector-ok-');
        const capDir = capabilities(dir, 'fal', { [MODEL_A]: { end_frame: true } });
        const m = { adapter: 'fal', model_id: MODEL_A };
        const files = [
            scene(dir, 'scene-1', 'cut', m),
            scene(dir, 'scene-2', 'connector', m),
            scene(dir, 'scene-3', 'connector', m),
            scene(dir, 'scene-4', 'connector', m),
        ];
        const r = run(SEAM_PLAN, [...files, '--capabilities-dir', capDir]);

        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toMatch(/gens: 7 \(2N-1\)/);
        expect(r.stdout).toMatch(/connector=3/);
        expect(r.stdout).toMatch(/sequential=true/);
    });
});
