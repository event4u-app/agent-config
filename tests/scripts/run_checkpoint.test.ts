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
    CHECKPOINT_DIR_REL,
    buildCheckpoint,
    checkpointFile,
    countRoadmap,
    latestCheckpointFor,
    readCheckpoint,
    renderVerification,
    verifyCheckpoint,
    writeCheckpoint,
    type RunCheckpoint,
} from '../../src/scripts/_lib/run_checkpoint.js';

/** This worktree's root — three levels up from tests/scripts/. */
const REPO_ROOT = path.resolve(__dirname, '..', '..');

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

describe('countRoadmap — the dashboard vocabulary and the phase span', () => {
    // R2 review, findings 11 and 15. Both directions matter and they pull
    // opposite ways: a narrow vocabulary under-counts open work (a run reads
    // `complete` while work remains), a whole-file scan over-counts it (a
    // an acceptance criterion is named as the next executable step).

    it('a `*` bullet and an uppercase [X] are read, not skipped', () => {
        const md = [
            '## Phase 1 — work',
            '',
            '* [X] done with a star bullet and a capital mark',
            '* [ ] open with a star bullet',
        ].join('\n');
        const c = countRoadmap(md);
        expect(c.done).toBe(1);
        expect(c.open).toBe(1);
    });

    it('checkboxes outside a phase span are not counted', () => {
        // The shape of the roadmap this review was run against: every phase
        // step closed, and the only open box an acceptance criterion.
        const md = [
            '## Phase 1 — work',
            '',
            '- [x] the real step',
            '',
            '## Acceptance criteria',
            '',
            '- [ ] a killed session resumes via the watcher',
            '',
            '## Blockers',
            '',
            '- [ ] someone funds the benchmark',
        ].join('\n');
        const c = countRoadmap(md);
        expect(c.open).toBe(0);
        expect(c.done).toBe(1);
        expect(c.next).toBeNull();
    });

    it('a roadmap with NO phase heading counts every line — the safe direction', () => {
        // Returning nothing here would make every unphased roadmap read as
        // `complete`, which is the more dangerous of the two errors.
        const c = countRoadmap('- [ ] a step\n- [x] another\n');
        expect(c.open).toBe(1);
        expect(c.done).toBe(1);
    });

    it('a phase span ends at the next H2, not at the end of the file', () => {
        const md = [
            '## Phase 1',
            '- [ ] inside',
            '## Notes',
            '- [ ] outside',
            '### Phase 2',
            '- [ ] inside again',
        ].join('\n');
        expect(countRoadmap(md).open).toBe(2);
    });
});

describe('latestCheckpointFor — the lookup a RELAUNCHED session can perform', () => {
    // R2 review, finding 7. `readCheckpoint` keys on the run id derived from
    // the session that DIED; a relaunched session has a new id and no index
    // from slug to old id, so the checkpoint was write-only in practice while
    // the loop contract instructed a resumed run to verify against it.
    const write = (root: string, cp: Record<string, unknown>): void => {
        const dir = path.join(root, CHECKPOINT_DIR_REL);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${String(cp['run_id'])}.json`), JSON.stringify(cp), 'utf-8');
    };
    const cp = (over: Record<string, unknown>): Record<string, unknown> => ({
        schema_version: 1,
        run_id: 'r-old',
        roadmap: 'road-to-thing',
        open_steps: 2,
        done_steps: 3,
        parked_steps: 0,
        next_step: 'do the next thing',
        head: 'abc',
        written_at: '2026-08-19T01:00:00Z',
        ...over,
    });

    it('finds the dying run\'s checkpoint from the roadmap slug alone', () => {
        const repoRoot = root();
        write(repoRoot, cp({}));
        const found = latestCheckpointFor(repoRoot, 'road-to-thing');
        expect(found?.run_id).toBe('r-old');
        expect(found?.next_step).toBe('do the next thing');
    });

    it('picks the NEWEST when a roadmap has several runs behind it', () => {
        const repoRoot = root();
        write(repoRoot, cp({ run_id: 'r-a', written_at: '2026-08-19T01:00:00Z' }));
        write(repoRoot, cp({ run_id: 'r-b', written_at: '2026-08-19T05:00:00Z' }));
        write(repoRoot, cp({ run_id: 'r-c', written_at: '2026-08-19T03:00:00Z' }));
        expect(latestCheckpointFor(repoRoot, 'road-to-thing')?.run_id).toBe('r-b');
    });

    it('ignores other roadmaps, and returns null when none matches', () => {
        const repoRoot = root();
        write(repoRoot, cp({ run_id: 'r-other', roadmap: 'road-to-something-else' }));
        expect(latestCheckpointFor(repoRoot, 'road-to-thing')).toBeNull();
    });

    it('skips a corrupt file instead of failing the whole lookup', () => {
        // A resume that refuses to start because one stale JSON is unparseable
        // is worse than one that verifies against the newest readable record.
        const repoRoot = root();
        const dir = path.join(repoRoot, CHECKPOINT_DIR_REL);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'aaa-broken.json'), '{ not json', 'utf-8');
        write(repoRoot, cp({ run_id: 'zzz-good' }));
        expect(latestCheckpointFor(repoRoot, 'road-to-thing')?.run_id).toBe('zzz-good');
    });

    it('returns null when no checkpoint directory exists at all', () => {
        expect(latestCheckpointFor(root(), 'road-to-thing')).toBeNull();
    });
});

describe('buildCheckpoint — head is resolved, not left null', () => {
    // R2 round 2, finding 5. `head` came only from `opts.head` and the one
    // production caller never passed it, so the field was always null while
    // three surfaces described it as carrying the commit. Only the test
    // injected a value, which is exactly why nothing noticed.
    it('resolves HEAD from a plain .git directory', () => {
        const repoRoot = root();
        writeRoadmap(repoRoot, 'road-to-thing', ['## Phase 1', '- [ ] a step']);
        const git = path.join(repoRoot, '.git');
        fs.mkdirSync(path.join(git, 'refs', 'heads'), { recursive: true });
        fs.writeFileSync(path.join(git, 'HEAD'), 'ref: refs/heads/main\n', 'utf-8');
        fs.writeFileSync(path.join(git, 'refs', 'heads', 'main'), `${'a'.repeat(40)}\n`, 'utf-8');
        expect(buildCheckpoint(repoRoot, 'r1', 'road-to-thing')?.head).toBe('a'.repeat(40));
    });

    it('resolves HEAD in a real LINKED WORKTREE layout', () => {
        // The layout `git worktree add` actually produces, and the round-2
        // version of this test did not: HEAD is per-worktree, refs are NOT.
        // The linked gitdir holds HEAD plus a `commondir` pointer, and
        // `refs/` lives at that commondir. Writing refs beside HEAD — which
        // the earlier fixture did — is a shape git never creates, so the test
        // agreed with the code instead of with reality and reported coverage
        // for a function that returned null in every real worktree.
        const repoRoot = root();
        writeRoadmap(repoRoot, 'road-to-thing', ['## Phase 1', '- [ ] a step']);
        const common = path.join(repoRoot, 'main-repo', '.git');
        const linked = path.join(common, 'worktrees', 'wt');
        fs.mkdirSync(path.join(common, 'refs', 'heads'), { recursive: true });
        fs.mkdirSync(linked, { recursive: true });
        fs.writeFileSync(path.join(linked, 'HEAD'), 'ref: refs/heads/feature\n', 'utf-8');
        // Relative, exactly as git writes it.
        fs.writeFileSync(path.join(linked, 'commondir'), '../..\n', 'utf-8');
        fs.writeFileSync(
            path.join(common, 'refs', 'heads', 'feature'),
            `${'b'.repeat(40)}\n`,
            'utf-8',
        );
        fs.writeFileSync(path.join(repoRoot, '.git'), `gitdir: ${linked}\n`, 'utf-8');
        expect(buildCheckpoint(repoRoot, 'r1', 'road-to-thing')?.head).toBe('b'.repeat(40));
    });

    it('resolves HEAD against THIS checkout — the reviewer reproduced null here', () => {
        // The end-to-end statement, and the one assertion the fixture above
        // cannot make: run the real function over the real repository this
        // test executes in. It is a linked worktree during development and a
        // plain clone in CI, so this passes only if BOTH paths work.
        const cp = buildCheckpoint(REPO_ROOT, 'r1', 'road-to-long-horizon-execution');
        expect(cp).not.toBeNull();
        expect(cp?.head).toMatch(/^[0-9a-f]{40}$/);
    });

    it('a worktree whose commondir is ABSOLUTE resolves too', () => {
        const repoRoot = root();
        writeRoadmap(repoRoot, 'road-to-thing', ['## Phase 1', '- [ ] a step']);
        const common = path.join(repoRoot, 'elsewhere', '.git');
        const linked = path.join(repoRoot, 'linked-gitdir');
        fs.mkdirSync(path.join(common, 'refs', 'heads'), { recursive: true });
        fs.mkdirSync(linked, { recursive: true });
        fs.writeFileSync(path.join(linked, 'HEAD'), 'ref: refs/heads/abs\n', 'utf-8');
        fs.writeFileSync(path.join(linked, 'commondir'), `${common}\n`, 'utf-8');
        fs.writeFileSync(path.join(common, 'refs', 'heads', 'abs'), `${'f'.repeat(40)}\n`, 'utf-8');
        fs.writeFileSync(path.join(repoRoot, '.git'), `gitdir: ${linked}\n`, 'utf-8');
        expect(buildCheckpoint(repoRoot, 'r1', 'road-to-thing')?.head).toBe('f'.repeat(40));
    });

    it('packed-refs is read from the COMMONDIR in a worktree, not beside HEAD', () => {
        const repoRoot = root();
        writeRoadmap(repoRoot, 'road-to-thing', ['## Phase 1', '- [ ] a step']);
        const common = path.join(repoRoot, 'main-repo', '.git');
        const linked = path.join(common, 'worktrees', 'wt');
        fs.mkdirSync(common, { recursive: true });
        fs.mkdirSync(linked, { recursive: true });
        fs.writeFileSync(path.join(linked, 'HEAD'), 'ref: refs/heads/packed\n', 'utf-8');
        fs.writeFileSync(path.join(linked, 'commondir'), '../..\n', 'utf-8');
        fs.writeFileSync(
            path.join(common, 'packed-refs'),
            `# pack-refs with: peeled\n${'c'.repeat(40)} refs/heads/packed\n`,
            'utf-8',
        );
        fs.writeFileSync(path.join(repoRoot, '.git'), `gitdir: ${linked}\n`, 'utf-8');
        expect(buildCheckpoint(repoRoot, 'r1', 'road-to-thing')?.head).toBe('c'.repeat(40));
    });

    it('falls back to packed-refs in a PLAIN repo when the loose ref is absent', () => {
        const repoRoot = root();
        writeRoadmap(repoRoot, 'road-to-thing', ['## Phase 1', '- [ ] a step']);
        const git = path.join(repoRoot, '.git');
        fs.mkdirSync(git, { recursive: true });
        fs.writeFileSync(path.join(git, 'HEAD'), 'ref: refs/heads/packed\n', 'utf-8');
        fs.writeFileSync(
            path.join(git, 'packed-refs'),
            `# pack-refs with: peeled\n${'c'.repeat(40)} refs/heads/packed\n`,
            'utf-8',
        );
        expect(buildCheckpoint(repoRoot, 'r1', 'road-to-thing')?.head).toBe('c'.repeat(40));
    });

    it('a detached HEAD is the sha itself', () => {
        const repoRoot = root();
        writeRoadmap(repoRoot, 'road-to-thing', ['## Phase 1', '- [ ] a step']);
        const git = path.join(repoRoot, '.git');
        fs.mkdirSync(git, { recursive: true });
        fs.writeFileSync(path.join(git, 'HEAD'), `${'d'.repeat(40)}\n`, 'utf-8');
        expect(buildCheckpoint(repoRoot, 'r1', 'road-to-thing')?.head).toBe('d'.repeat(40));
    });

    it('no git at all is null, never a throw — the Stop path must not fail', () => {
        const repoRoot = root();
        writeRoadmap(repoRoot, 'road-to-thing', ['## Phase 1', '- [ ] a step']);
        expect(buildCheckpoint(repoRoot, 'r1', 'road-to-thing')?.head).toBeNull();
    });

    it('an explicit opts.head still wins', () => {
        const repoRoot = root();
        writeRoadmap(repoRoot, 'road-to-thing', ['## Phase 1', '- [ ] a step']);
        const git = path.join(repoRoot, '.git');
        fs.mkdirSync(git, { recursive: true });
        fs.writeFileSync(path.join(git, 'HEAD'), `${'e'.repeat(40)}\n`, 'utf-8');
        expect(
            buildCheckpoint(repoRoot, 'r1', 'road-to-thing', { head: 'injected' })?.head,
        ).toBe('injected');
    });
});

describe('verifyCheckpoint — head is re-verified like every other field', () => {
    // R2 round 3, finding 2. Round 2 fixed only the WRITE half of finding 5,
    // so `§5d: every field is recomputed` was false for exactly the field that
    // says whether the tree moved under the run.
    const withGit = (sha: string): string => {
        const repoRoot = root();
        writeRoadmap(repoRoot, 'road-to-thing', ['## Phase 1', '- [ ] a step']);
        const git = path.join(repoRoot, '.git');
        fs.mkdirSync(git, { recursive: true });
        fs.writeFileSync(path.join(git, 'HEAD'), `${sha}\n`, 'utf-8');
        return repoRoot;
    };

    it('reports head among the fields, and agrees when the tree has not moved', () => {
        const repoRoot = withGit('a'.repeat(40));
        const cp = buildCheckpoint(repoRoot, 'r1', 'road-to-thing') as RunCheckpoint;
        const res = verifyCheckpoint(repoRoot, cp);
        const field = res.fields.find((f) => f.field === 'head');
        expect(field).toBeDefined();
        expect(field?.agrees).toBe(true);
        expect(field?.actual).toBe('a'.repeat(40));
    });

    it('an UNKNOWN head on either side is not a disagreement', () => {
        // R2 round 4, finding 2. `readHead` returns null on every failure by
        // design, so a strict comparison reported "the tree moved" for "I
        // could not read the commit" — on a resume at the same commit with
        // every other field agreeing.
        const repoRoot = withGit('a'.repeat(40));
        const cp = buildCheckpoint(repoRoot, 'r1', 'road-to-thing') as RunCheckpoint;
        // The checkpoint knows the commit; the verifying tree cannot read one.
        fs.rmSync(path.join(repoRoot, '.git'), { recursive: true, force: true });
        const res = verifyCheckpoint(repoRoot, cp);
        expect(res.fields.find((f) => f.field === 'head')?.agrees).toBe(true);
        expect(res.agrees).toBe(true);
    });

    it('a checkpoint written without a head does not fail its own verification', () => {
        const repoRoot = root();
        writeRoadmap(repoRoot, 'road-to-thing', ['## Phase 1', '- [ ] a step']);
        const cp = buildCheckpoint(repoRoot, 'r1', 'road-to-thing') as RunCheckpoint;
        expect(cp.head).toBeNull();
        expect(verifyCheckpoint(repoRoot, cp).agrees).toBe(true);
    });

    it('a moved HEAD is a reported DISAGREEMENT, never an error', () => {
        // Work landing between the checkpoint and the resume is the normal
        // case; treating it as corruption would refuse every healthy resume.
        const repoRoot = withGit('a'.repeat(40));
        const cp = buildCheckpoint(repoRoot, 'r1', 'road-to-thing') as RunCheckpoint;
        fs.writeFileSync(
            path.join(repoRoot, '.git', 'HEAD'),
            `${'9'.repeat(40)}\n`,
            'utf-8',
        );
        const res = verifyCheckpoint(repoRoot, cp);
        expect(res.readable).toBe(true);
        const field = res.fields.find((f) => f.field === 'head');
        expect(field?.agrees).toBe(false);
        expect(field?.claimed).toBe('a'.repeat(40));
        expect(field?.actual).toBe('9'.repeat(40));
        expect(renderVerification(cp, res)).toContain('head');
    });
});
