/**
 * The two lists that name `~/.claude/<family>` must agree.
 *
 * **Why this test exists, stated as the defect rather than as a principle.**
 *
 * On 2026-09-07 a session spent an hour reasoning about the two layers Claude
 * Code loads — `~/.claude/**` and `<repo>/.claude/**` — measured both, and
 * changed what the project layer withholds. In the same tree, the skill-catalogue
 * READER had never read `~/.claude/skills` at all: it tried two
 * workspace-relative roots and stopped at the first. `git grep` over the
 * dependency sets of the delivery side and the reader side returned two DISJOINT
 * sets. Two constants naming the same directories, no reference between them, and
 * nothing that could notice.
 *
 * What it cost: `suggest_skill_for_task` and the `skill-route` concern ranked
 * whichever single tree resolved first and reported it as if it were the
 * catalogue. A consumer carrying its own project skills while the shipped set
 * sits in `~/.claude/skills` got an answer over half its catalogue with no signal
 * that it was half.
 *
 * The reasoning failure underneath — repairing a mechanism's PARAMETER while
 * inheriting its SHAPE — is model-carried and unobservable. The RESULT is two
 * lists of strings. This file compares them, so the next omission reds instead of
 * waiting to be noticed.
 *
 * **Polarity is asserted, not assumed.**
 *
 * Every branch of `catalogueLayerParity` is driven in BOTH directions through its
 * injection points. A test that only ran the real constants would pass today and
 * pass again on the day someone deletes a root — it would be asserting that the
 * tree currently agrees with itself, which is the tautology this repository keeps
 * removing from its own suites.
 */
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    FAMILIES_WITHOUT_READER,
    READER_ROOT_LABELS,
    catalogueLayerParity,
    hostSkillsDirTriple,
} from '../../src/scripts/_lib/catalogue_layer_parity.js';
import { CLAUDE_ARTEFACT_DIRS } from '../../src/install/claudeLayerCarriage.js';

describe('the live tree', () => {
    it('has no disagreement between the delivery side and the reader side', () => {
        expect(catalogueLayerParity()).toEqual([]);
    });

    it('reads `~/.claude/skills` — the leg that was missing entirely', () => {
        // Named explicitly rather than left to the loop above: this is the exact
        // omission, and a future refactor that keeps the loop green while dropping
        // the host root would otherwise pass.
        expect(READER_ROOT_LABELS).toContain('~/.claude/skills');
    });

    it('every delivery family is either covered by a reader or declared reader-less', () => {
        const declared = new Set(Object.keys(FAMILIES_WITHOUT_READER));
        const unexplained = Object.keys(CLAUDE_ARTEFACT_DIRS).filter(
            (f) => !declared.has(f) && catalogueLayerParity().some((x) => x.family === f),
        );
        expect(unexplained).toEqual([]);
    });

    it('gives every reader-less family a non-empty REASON, not a bare exemption', () => {
        for (const [family, reason] of Object.entries(FAMILIES_WITHOUT_READER)) {
            expect(reason.trim().length, `${family} needs a reason`).toBeGreaterThan(20);
        }
    });
});

describe('the three authors of ~/.claude/skills name one directory', () => {
    it('fingerprint, delivery and reader agree for a given home', () => {
        // `hostLayerInputs` is the third author — the fingerprint side. A rename
        // there would silently un-verify the layer the reader reads, and nothing
        // else in the tree compares the two.
        const t = hostSkillsDirTriple('/probe-home');
        expect(t.fingerprint).not.toBeNull();
        expect(path.resolve(t.fingerprint as string)).toBe(path.resolve(t.delivery));
        expect(path.resolve(t.reader)).toBe(path.resolve(t.delivery));
    });
});

describe('polarity — each branch reds on the shape it is meant to catch', () => {
    it('an UNDECLARED, unread family is a finding', () => {
        const found = catalogueLayerParity({ widgets: '.claude/widgets' }, {}, {});
        expect(found).toHaveLength(1);
        expect(found[0]?.family).toBe('widgets');
        expect(found[0]?.reason).toContain('no reason is declared');
    });

    it('a DECLARED reader-less family is NOT a finding', () => {
        expect(
            catalogueLayerParity({ widgets: '.claude/widgets' }, {}, { widgets: 'nothing ranks widgets' }),
        ).toEqual([]);
    });

    it('a reader that misses the PROJECT root is a finding', () => {
        const found = catalogueLayerParity(
            { skills: '.claude/skills' },
            { skills: () => ['src/skills', '~/.claude/skills'] },
            {},
        );
        expect(found.map((f) => f.reason).join(' ')).toContain('.claude/skills`, which the delivery side names');
    });

    it('a reader that misses the HOST root is a finding — the 2026-09-07 defect', () => {
        // Exactly the pre-change state: two workspace-relative roots, no host leg.
        const found = catalogueLayerParity(
            { skills: '.claude/skills' },
            { skills: () => ['src/skills', '.claude/skills'] },
            {},
        );
        expect(found).toHaveLength(1);
        expect(found[0]?.reason).toContain('~/.claude/skills');
        expect(found[0]?.reason).toContain('the host layer the partition withholds against');
    });

    it('a reader covering both legs is NOT a finding', () => {
        expect(
            catalogueLayerParity(
                { skills: '.claude/skills' },
                { skills: () => ['src/skills', '.claude/skills', '~/.claude/skills'] },
                {},
            ),
        ).toEqual([]);
    });

    it('an EMPTY delivery list produces no findings, and that is not a pass to quote', () => {
        // A gate over an empty target set exits green everywhere. Pinned so the
        // degenerate case is a known shape rather than a silent one — the live-tree
        // block above is what actually asserts coverage.
        expect(catalogueLayerParity({}, {}, {})).toEqual([]);
    });
});
