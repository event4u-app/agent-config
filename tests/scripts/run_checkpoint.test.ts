/**
 * run_checkpoint — the derived checkpoint and its re-verification.
 *
 * The two properties worth pinning, because both are the whole point:
 *
 *   · **Every field is DERIVED.** A handoff summary is authored and can be
 *     wrong in ways nothing catches; a checkpoint is recomputed from the
 *     roadmap on disk, which is what makes `verifyCheckpoint` possible at all.
 *   · **Verification reports per FIELD, and a disagreement is not an error.**
 *     Work landing between the checkpoint and the resume is the normal case.
 *     A verifier that treated progress as corruption would refuse every
 *     healthy resume, and a boolean verdict would tell a resumed run nothing
 *     it could act on.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    buildCheckpoint,
    checkpointFile,
    countRoadmap,
    readCheckpoint,
    renderVerification,
    verifyCheckpoint,
    writeCheckpoint,
    type RunCheckpoint,
} from '../../src/scripts/_lib/run_checkpoint.js';

const dirs: string[] = [];
afterEach(() => {
    while (dirs.length > 0) {
        const d = dirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

function root(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'run-checkpoint-'));
    dirs.push(d);
    return d;
}

function writeRoadmap(repoRoot: string, slug: string, lines: string[]): void {
    const dir = path.join(repoRoot, 'agents', 'roadmaps');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug}.md`), `${lines.join('\n')}\n`, 'utf-8');
}

const ROADMAP = [
    '# R',
    '',
    '- [x] **0.0** done one',
    '- [x] **0.1** done two',
    '- [ ] **0.2** the next open one',
    '- [ ] **0.3** a later one',
    '- [~] **0.4** deferred by design',
    '- [-] **0.5** cancelled',
];

describe('countRoadmap', () => {
    it('separates open, done and parked', () => {
        expect(countRoadmap(ROADMAP.join('\n'))).toEqual({
            open: 2,
            done: 2,
            parked: 2,
            next: '**0.2** the next open one',
        });
    });

    it('[~] and [-] are PARKED, never open', () => {
        // A resumed run that treated these as work would re-engage into the
        // exact items a human decided not to do — the anti-stall mechanism
        // manufacturing a stall.
        const c = countRoadmap('- [~] a\n- [-] b\n');
        expect(c.open).toBe(0);
        expect(c.parked).toBe(2);
        expect(c.next).toBeNull();
    });

    it('next is the FIRST open step, not the last', () => {
        expect(countRoadmap('- [ ] first\n- [ ] second\n').next).toBe('first');
    });

    it('prose that merely looks like a checkbox is not counted', () => {
        expect(countRoadmap('the value [ ] means open\n').open).toBe(0);
    });

    it('an empty roadmap counts to zero rather than throwing', () => {
        expect(countRoadmap('')).toEqual({ open: 0, done: 0, parked: 0, next: null });
    });
});

describe('buildCheckpoint', () => {
    it('derives every field from the roadmap on disk', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ROADMAP);
        const cp = buildCheckpoint(r, 'run1', 'road-to-x', {
            head: 'abc123',
            now: () => new Date('2026-08-19T00:00:00.000Z'),
        });
        expect(cp).toMatchObject({
            run_id: 'run1',
            roadmap: 'road-to-x',
            open_steps: 2,
            done_steps: 2,
            parked_steps: 2,
            next_step: '**0.2** the next open one',
            head: 'abc123',
            written_at: '2026-08-19T00:00:00.000Z',
        });
    });

    it('returns null when the roadmap does not read — never a guessed checkpoint', () => {
        // The contract of this file is that its fields were computed. A
        // checkpoint built from nothing would break exactly that.
        expect(buildCheckpoint(root(), 'run1', 'missing')).toBeNull();
    });
});

describe('writeCheckpoint / readCheckpoint', () => {
    it('round-trips', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ROADMAP);
        const cp = buildCheckpoint(r, 'run1', 'road-to-x') as RunCheckpoint;
        const file = writeCheckpoint(r, cp);
        expect(file).toBe(checkpointFile(r, 'run1'));
        expect(readCheckpoint(r, 'run1')).toEqual(cp);
    });

    it('an absent or malformed checkpoint reads as null, never a throw', () => {
        const r = root();
        expect(readCheckpoint(r, 'nope')).toBeNull();
        const f = checkpointFile(r, 'bad');
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, 'not json', 'utf-8');
        expect(readCheckpoint(r, 'bad')).toBeNull();
    });

    it('a run id that is not a safe filename component is collapsed, not escaped', () => {
        const r = root();
        const f = checkpointFile(r, '../escape');
        expect(path.dirname(f)).toBe(path.join(r, 'agents', 'runtime', 'state', 'checkpoints'));
    });
});

describe('verifyCheckpoint — resume by evidence, not by bookkeeping', () => {
    it('agrees when nothing moved', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ROADMAP);
        const cp = buildCheckpoint(r, 'run1', 'road-to-x') as RunCheckpoint;
        const res = verifyCheckpoint(r, cp);
        expect(res.readable).toBe(true);
        expect(res.agrees).toBe(true);
    });

    it('names WHICH field moved when a step landed after the checkpoint', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ROADMAP);
        const cp = buildCheckpoint(r, 'run1', 'road-to-x') as RunCheckpoint;
        // A step got done between the checkpoint and the resume — the normal
        // case, and the one a boolean verdict would render unactionable.
        writeRoadmap(r, 'road-to-x', ROADMAP.map((l) => l.replace('- [ ] **0.2**', '- [x] **0.2**')));
        const res = verifyCheckpoint(r, cp);
        expect(res.agrees).toBe(false);
        const byField = Object.fromEntries(res.fields.map((f) => [f.field, f]));
        expect(byField['open_steps']).toMatchObject({ claimed: 2, actual: 1, agrees: false });
        expect(byField['done_steps']).toMatchObject({ claimed: 2, actual: 3, agrees: false });
        expect(byField['next_step']?.actual).toBe('**0.3** a later one');
        // parked did not move, and says so — the point of per-field reporting.
        expect(byField['parked_steps']?.agrees).toBe(true);
    });

    it('an unreadable roadmap is not-readable, not merely disagreeing', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ROADMAP);
        const cp = buildCheckpoint(r, 'run1', 'road-to-x') as RunCheckpoint;
        fs.rmSync(path.join(r, 'agents', 'roadmaps', 'road-to-x.md'));
        const res = verifyCheckpoint(r, cp);
        expect(res.readable).toBe(false);
        expect(res.fields).toEqual([]);
        expect(res.agrees).toBe(false);
    });
});

describe('renderVerification', () => {
    it('an agreeing report says the tree still matches', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ROADMAP);
        const cp = buildCheckpoint(r, 'run1', 'road-to-x') as RunCheckpoint;
        const out = renderVerification(cp, verifyCheckpoint(r, cp));
        expect(out).toContain('the tree still matches');
        expect(out).not.toContain('CHANGED');
    });

    it('a disagreeing report marks the moved field and points at ACTUAL', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ROADMAP);
        const cp = buildCheckpoint(r, 'run1', 'road-to-x') as RunCheckpoint;
        writeRoadmap(r, 'road-to-x', ROADMAP.map((l) => l.replace('- [ ] **0.2**', '- [x] **0.2**')));
        const out = renderVerification(cp, verifyCheckpoint(r, cp));
        expect(out).toContain('CHANGED  open_steps: claimed 2 → actual 1');
        expect(out).toContain('ACTUAL column is what to resume from');
    });

    it('an unreadable roadmap says none of the claimed state may be assumed', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ROADMAP);
        const cp = buildCheckpoint(r, 'run1', 'road-to-x') as RunCheckpoint;
        fs.rmSync(path.join(r, 'agents', 'roadmaps', 'road-to-x.md'));
        expect(renderVerification(cp, verifyCheckpoint(r, cp))).toContain('may be assumed');
    });
});
