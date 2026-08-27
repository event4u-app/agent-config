/**
 * The resolved-deferral annotation — `archive_completed_roadmaps.ts`
 * `deferralProblems` / `parseDeferredItems`.
 *
 * WHY THIS EXISTS. `roadmap-progress-sync` Iron Law 3 says a `[~]` deferral must
 * be resolved before archival, and the preservation test routes four
 * dispositions to the council. Three of them — carry to a follow-up, merge into
 * existing work, restore to open — leave the `[~]` glyph in place, while the
 * sweep required `deferred === 0` unconditionally. So a genuinely UNEXECUTABLE
 * item (one needing elapsed time rather than effort) had no council-reachable
 * path to an archived roadmap, and the only glyph that cleared the gate was
 * `[-]`, which is owner-reserved and pinned to "won't happen at all".
 *
 * AI council 2026-08-27, 2 seats, convergent on option (c): a machine-readable
 * annotation the sweep validates, with `[-]` left as cancellation-only. Both
 * seats attached the same condition — **the validation must fail closed**,
 * because the annotation is cheap to write and must therefore be expensive to
 * satisfy. Every case below is one of those closed doors.
 *
 * FAIL-CLOSED PROBES, run 2026-08-27 against the real tree before this file was
 * written (each restored from a backup copy, never `git checkout`): bare `[~]`,
 * non-existent destination, destination in `archive/`, destination missing its
 * back-link, and a malformed annotation — all five refused the archive, and the
 * restored tree archived again. These specs pin the same six doors as units.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { deferralProblems, main, parseDeferredItems } from '../../src/agent-src/scripts/archive_completed_roadmaps.js';

const SRC = 'road-to-parent';
const DEST = 'road-to-child';

/** A roadmap tree under a throwaway root. `deferralProblems` only reads files. */
function _tree(files: Record<string, string>): string {
    const d = mkdtempSync(join(tmpdir(), 'adr-'));
    for (const [rel, body] of Object.entries(files)) {
        const f = join(d, rel);
        mkdirSync(join(f, '..'), { recursive: true });
        writeFileSync(f, body);
    }
    return d;
}

const _parent = (annotation: string): string =>
    `---\ncomplexity: lightweight\n---\n\n# parent\n\n## Phase 1\n\n- [x] **1.1 done**\n- [~] **1.2 needs elapsed time**\n${annotation}`;

const _child = (backlink: string): string =>
    `---\ncomplexity: lightweight\n${backlink}---\n\n# child\n\ncarries ${SRC} step 1.2\n\n- [ ] **1.1 measure it**\n`;

const OK_ANNOTATION = `      <!-- deferred-resolution: carried-to=${DEST} -->\n`;

function _problems(parentBody: string, extra: Record<string, string> = {}): string[] {
    const root = _tree({
        [`agents/roadmaps/${SRC}.md`]: parentBody,
        ...extra,
    });
    return deferralProblems(root, `${SRC}.md`, parentBody);
}

describe('parseDeferredItems', () => {
    it('finds the annotation in the step continuation block, not only on the step line', () => {
        const items = parseDeferredItems(_parent(OK_ANNOTATION));
        expect(items).toHaveLength(1);
        expect(items[0]?.kind).toBe('carried-to');
        expect(items[0]?.destination).toBe(DEST);
    });

    it('reports a bare `[~]` with a null kind rather than skipping it', () => {
        const items = parseDeferredItems(_parent(''));
        expect(items).toHaveLength(1);
        expect(items[0]?.kind).toBeNull();
    });

    it('does not let a LATER step`s annotation cover an earlier unannotated one', () => {
        // The block ends at the next checkbox. Without that boundary the first
        // step's block runs to EOF and swallows the second step's annotation —
        // the cheapest possible bypass of the whole mechanism, since one
        // annotation anywhere below would resolve every deferral above it.
        //
        // The ORDER here is the load-bearing part and the first draft of this
        // spec had it backwards: with the annotation ABOVE the unannotated step
        // the assertion holds whether or not the boundary exists, so it passed
        // against a build with `BLOCK_END_RE` disabled. Probed 2026-08-27:
        // disabling the boundary leaves that version 15/15 green and this
        // version red.
        const body =
            `---\ncomplexity: lightweight\n---\n\n# p\n\n## Phase 1\n\n` +
            `- [~] **first, unannotated**\n` +
            `- [~] **second, annotated**\n${OK_ANNOTATION}`;
        const items = parseDeferredItems(body);
        expect(items).toHaveLength(2);
        expect(items[0]?.kind, 'the earlier step must NOT inherit the later annotation').toBeNull();
        expect(items[1]?.kind).toBe('carried-to');
    });

    it('ignores every other glyph', () => {
        const body = `- [x] a\n- [ ] b\n- [-] c\n`;
        expect(parseDeferredItems(body)).toEqual([]);
    });
});

describe('deferralProblems — six closed doors', () => {
    it('a fully valid carry is RESOLVED', () => {
        expect(
            _problems(_parent(OK_ANNOTATION), {
                [`agents/roadmaps/${DEST}.md`]: _child(`parent_roadmap: ${SRC}\n`),
            }),
        ).toEqual([]);
    });

    it('a destination parked in `later/` is also live', () => {
        // Parked is not dead. One council seat argued time-gated follow-ups
        // belong in `later/`; the other declined to make that a rule here. The
        // sweep accepts both rather than deciding it.
        expect(
            _problems(_parent(OK_ANNOTATION), {
                [`agents/roadmaps/later/${DEST}.md`]: _child(`parent_roadmap: ${SRC}\n`),
            }),
        ).toEqual([]);
    });

    it('1. a bare `[~]` blocks', () => {
        const p = _problems(_parent(''));
        expect(p).toHaveLength(1);
        expect(p[0]).toMatch(/carries no `<!-- deferred-resolution/);
    });

    it('2. a malformed annotation blocks — it is not read as an absent one silently', () => {
        const p = _problems(_parent(`      <!-- deferred-resolution: carried_to ${DEST} -->\n`));
        expect(p).toHaveLength(1);
        expect(p[0]).toMatch(/carries no `<!-- deferred-resolution/);
    });

    it('3. a non-existent destination blocks', () => {
        const p = _problems(_parent('      <!-- deferred-resolution: carried-to=road-to-nowhere -->\n'));
        expect(p).toHaveLength(1);
        expect(p[0]).toMatch(/does not exist/);
    });

    it('4. a destination in `archive/` blocks — a dead roadmap cannot receive an item', () => {
        const p = _problems(_parent(OK_ANNOTATION), {
            [`agents/roadmaps/archive/${DEST}.md`]: _child(`parent_roadmap: ${SRC}\n`),
        });
        expect(p).toHaveLength(1);
        expect(p[0]).toMatch(/is in `archive\/`/);
    });

    it('4b. a destination in `skipped/` blocks for the same reason', () => {
        const p = _problems(_parent(OK_ANNOTATION), {
            [`agents/roadmaps/skipped/${DEST}.md`]: _child(`parent_roadmap: ${SRC}\n`),
        });
        expect(p).toHaveLength(1);
        expect(p[0]).toMatch(/is in `skipped\/`/);
    });

    it('5. a destination with no `parent_roadmap` back-link blocks', () => {
        const p = _problems(_parent(OK_ANNOTATION), {
            [`agents/roadmaps/${DEST}.md`]: _child(''),
        });
        expect(p).toHaveLength(1);
        expect(p[0]).toMatch(/carries no `parent_roadmap/);
    });

    it('5b. a back-link naming a DIFFERENT parent blocks', () => {
        // The link has to be verifiable from both ends, or a follow-up of some
        // other roadmap could be cited to clear any deferral in the tree.
        const p = _problems(_parent(OK_ANNOTATION), {
            [`agents/roadmaps/${DEST}.md`]: _child('parent_roadmap: road-to-someone-else\n'),
        });
        expect(p).toHaveLength(1);
        expect(p[0]).toMatch(/carries no `parent_roadmap/);
    });

    it('6. `merged-into` needs a STRUCTURED link, not a mention in prose', () => {
        // This spec is the inverse of the one it replaces. The original asserted
        // that any mention of the source slug was enough, which an independent
        // review called trivially spoofable: a filename, an example or an HTML
        // comment satisfies `includes()` without documenting any merge. Both
        // seats named it. A `relates:` row or a `parent_roadmap:` line is a
        // declaration the author made; prose is not.
        const ann = `      <!-- deferred-resolution: merged-into=${DEST} -->\n`;

        // A bare mention in the body is now REFUSED.
        const prose = `---\ncomplexity: lightweight\n---\n\n# child\n\nsee ${SRC} for background\n`;
        const p1 = _problems(_parent(ann), { [`agents/roadmaps/${DEST}.md`]: prose });
        expect(p1).toHaveLength(1);
        expect(p1[0]).toMatch(/no structured link/);

        // A `relates:` row IS accepted.
        const relates = `---\ncomplexity: lightweight\nrelates:\n  - slug: ${SRC}\n    relation: extends\n---\n\n# child\n`;
        expect(_problems(_parent(ann), { [`agents/roadmaps/${DEST}.md`]: relates })).toEqual([]);

        // So is a `parent_roadmap:` back-link.
        expect(
            _problems(_parent(ann), { [`agents/roadmaps/${DEST}.md`]: _child(`parent_roadmap: ${SRC}\n`) }),
        ).toEqual([]);
    });

    it('7. a slug with regex metacharacters is matched LITERALLY', () => {
        // The back-link slug was interpolated raw, so `road.parent` matched
        // `roadXparent` — and a slug containing `[` made `new RegExp` THROW and
        // abort the whole sweep, in a function whose contract is failing closed.
        // Both review seats named it.
        const dotted = 'road.parent';
        const root = _tree({
            [`agents/roadmaps/${dotted}.md`]: _parent(OK_ANNOTATION),
            [`agents/roadmaps/${DEST}.md`]: _child('parent_roadmap: roadXparent\n'),
        });
        const p = deferralProblems(root, `${dotted}.md`, _parent(OK_ANNOTATION));
        expect(p).toHaveLength(1);
        expect(p[0]).toMatch(/carries no `parent_roadmap/);

        // And a bracketed slug does not throw.
        const bracket = 'road[1]parent';
        const root2 = _tree({
            [`agents/roadmaps/${DEST}.md`]: _child(`parent_roadmap: ${bracket}\n`),
        });
        expect(() => deferralProblems(root2, `${bracket}.md`, _parent(OK_ANNOTATION))).not.toThrow();
        expect(deferralProblems(root2, `${bracket}.md`, _parent(OK_ANNOTATION))).toEqual([]);
    });

    it('8. a roadmap may not name ITSELF as the destination', () => {
        // It passes every other check — the file exists, and a `parent_roadmap:`
        // naming itself satisfies the back-link — and then the sweep archives it,
        // so the destination is dead the moment the source is. Found by review.
        const body = _parent(`      <!-- deferred-resolution: carried-to=${SRC} -->\n`);
        const root = _tree({ [`agents/roadmaps/${SRC}.md`]: body });
        const p = deferralProblems(root, `${SRC}.md`, body);
        expect(p).toHaveLength(1);
        expect(p[0]).toMatch(/names its OWN roadmap/);
    });

    it('9. a destination this same sweep will archive is REFUSED', () => {
        // The sharpest finding of the review: both roadmaps complete in one run,
        // parent carries to child, both validated as live, both archived — and the
        // carried item has no receiver. The mechanism meant to prevent the loss
        // produced it.
        const body = _parent(OK_ANNOTATION);
        const root = _tree({
            [`agents/roadmaps/${SRC}.md`]: body,
            [`agents/roadmaps/${DEST}.md`]: _child(`parent_roadmap: ${SRC}\n`),
        });
        // With the destination NOT in the sweep set, it is accepted.
        expect(deferralProblems(root, `${SRC}.md`, body, new Set())).toEqual([]);
        // With it in the set, refused.
        const p = deferralProblems(root, `${SRC}.md`, body, new Set([DEST]));
        expect(p).toHaveLength(1);
        expect(p[0]).toMatch(/being archived by this same sweep/);
    });

    it('every deferral is checked, not just the first', () => {
        const body =
            `---\ncomplexity: lightweight\n---\n\n# p\n\n## Phase 1\n\n` +
            `- [~] **first**\n${OK_ANNOTATION}` +
            `- [~] **second**\n`;
        const p = _problems(body, { [`agents/roadmaps/${DEST}.md`]: _child(`parent_roadmap: ${SRC}\n`) });
        expect(p).toHaveLength(1);
        expect(p[0]).toMatch(/"\*\*second\*\*"/);
    });
});

/**
 * The integration half. Both review seats made the same point independently:
 * every unit spec above stays green if the `deferralProblems()` call is deleted
 * from `archive_completed()`, so nothing proved the validation was WIRED. These
 * drive the real CLI over a real git repo.
 */
describe('archive_completed — the validation is actually wired in', () => {
    function _repo(files: Record<string, string>): string {
        const d = mkdtempSync(join(tmpdir(), 'acr-int-'));
        for (const [rel, body] of Object.entries(files)) {
            const f = join(d, rel);
            mkdirSync(join(f, '..'), { recursive: true });
            writeFileSync(f, body);
        }
        const git = (...a: string[]): void => {
            execFileSync('git', a, { cwd: d, encoding: 'utf-8' });
        };
        git('init', '-q');
        git('config', 'user.email', 't@example.com');
        git('config', 'user.name', 't');
        git('add', '-A');
        git('commit', '-qm', 'base');
        return d;
    }

    const DONE = '- [x] **1.1 done**\n';

    /**
     * A live destination: a `parent_roadmap:` back-link and a genuinely OPEN
     * step, so this sweep will not archive it.
     *
     * Built inline rather than from the unit helper `_child`, because that one's
     * checkbox sits outside any `## Phase` heading — `collect()` counts
     * checkboxes under phases, so it read as zero-open and therefore COMPLETE.
     * The first version of these specs used it and the destination archived
     * itself, which then correctly tripped the same-sweep guard and made the
     * happy-path spec fail for a reason that had nothing to do with the feature.
     */
    // NAMED phase headings ("## Phase 1 — Work", not "## Phase 1"). `PHASE_RE`'s
    // optional trailing-name group is `(?:[\s:—\-]+([\s\S]*?))?` anchored on
    // `[ \t\f\v\r]*$`, so on a bare `## Phase 1` it can consume the blank line
    // AND the checkbox line that follows — the phase span then starts after the
    // checkbox and `collect()` reports zero open. That is what made the first
    // version of these fixtures read as COMPLETE, archive themselves, and trip
    // the same-sweep guard in the happy-path spec. Real roadmaps always carry a
    // name, which is why nothing else hits it.
    const liveDest = `---\ncomplexity: lightweight\nparent_roadmap: ${SRC}\n---\n\n# child\n\ncarries ${SRC} step 1.2\n\n## Phase 1 — Work\n\n- [ ] **1.1 open**\n`;
    const doneDest = `---\ncomplexity: lightweight\nparent_roadmap: ${SRC}\n---\n\n# child\n\ncarries ${SRC} step 1.2\n\n## Phase 1 — Work\n\n- [x] **1.1 done**\n`;

    it('archives a roadmap whose deferral carries a VALID annotation', () => {
        const root = _repo({
            [`agents/roadmaps/${SRC}.md`]: `---\ncomplexity: lightweight\n---\n\n# p\n\n## Phase 1 — Work\n\n${DONE}- [~] **1.2 later**\n${OK_ANNOTATION}`,
            [`agents/roadmaps/${DEST}.md`]: liveDest,
        });
        expect(main(['--all', '--repo-root', root])).toBe(0);
        expect(existsSync(join(root, 'agents', 'roadmaps', 'archive', `${SRC}.md`))).toBe(true);
    });

    it('REFUSES a roadmap whose deferral carries no annotation — and this is the wiring proof', () => {
        // Identical repo, one line removed. If the `deferralProblems()` call were
        // deleted from `archive_completed()`, this roadmap would archive and the
        // assertion below would fail. That is what the unit specs could not show.
        const root = _repo({
            [`agents/roadmaps/${SRC}.md`]: `---\ncomplexity: lightweight\n---\n\n# p\n\n## Phase 1 — Work\n\n${DONE}- [~] **1.2 later**\n`,
            [`agents/roadmaps/${DEST}.md`]: liveDest,
        });
        expect(main(['--all', '--repo-root', root])).toBe(0);
        expect(existsSync(join(root, 'agents', 'roadmaps', 'archive', `${SRC}.md`))).toBe(false);
        expect(existsSync(join(root, 'agents', 'roadmaps', `${SRC}.md`))).toBe(true);
    });

    it('REFUSES both when the destination is complete in the same sweep', () => {
        // The review's sharpest reproducer, end to end: parent carries to child,
        // both complete, both would archive, and the carried item would be left
        // with no live receiver.
        const root = _repo({
            [`agents/roadmaps/${SRC}.md`]: `---\ncomplexity: lightweight\n---\n\n# p\n\n## Phase 1 — Work\n\n${DONE}- [~] **1.2 later**\n${OK_ANNOTATION}`,
            [`agents/roadmaps/${DEST}.md`]: doneDest,
        });
        expect(main(['--all', '--repo-root', root])).toBe(0);
        // The child is complete and unblocked, so it archives.
        expect(existsSync(join(root, 'agents', 'roadmaps', 'archive', `${DEST}.md`))).toBe(true);
        // The parent must NOT, because its receiver is going away.
        expect(existsSync(join(root, 'agents', 'roadmaps', `${SRC}.md`))).toBe(true);
        expect(existsSync(join(root, 'agents', 'roadmaps', 'archive', `${SRC}.md`))).toBe(false);
    });
});
