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
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { deferralProblems, parseDeferredItems } from '../../src/agent-src/scripts/archive_completed_roadmaps.js';

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

    it('6. `merged-into` needs no back-link but still needs the source mentioned', () => {
        // A merge target is pre-existing work, so it carries no `parent_roadmap`.
        // The traceability floor is that it names the source at all.
        const ann = `      <!-- deferred-resolution: merged-into=${DEST} -->\n`;
        expect(
            _problems(_parent(ann), { [`agents/roadmaps/${DEST}.md`]: _child('') }),
        ).toEqual([]);

        const silent = `---\ncomplexity: lightweight\n---\n\n# child\n\nno mention of the source at all\n`;
        const p = _problems(_parent(ann), { [`agents/roadmaps/${DEST}.md`]: silent });
        expect(p).toHaveLength(1);
        expect(p[0]).toMatch(/never mentions/);
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
