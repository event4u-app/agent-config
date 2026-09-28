/**
 * The deletion-claim disproof (16.1.0 release-truth).
 *
 * MEASURED FAILURE this pins. At the 16.1.0 cut the self-review read 202 of
 * 401 changed files and reported two `critical security` findings —
 * "adversarial-review skill removed without threat analysis" and
 * "agent-security-review skill removed without migration". Neither skill was
 * touched: `git diff --name-status 16.0.0...release/16.1.0` carried exactly
 * four deletions, all roadmap archive moves, and both SKILL.md files are in
 * the tree. Both findings blocked the release and each cost an adjudication
 * cycle.
 *
 * The prompt already carried a sentence for the neighbouring class ("Do NOT
 * report a feature as not in the diff when it is present in the release
 * range") and the SAME run violated it, which is why this is a mechanical
 * check and not one more sentence.
 *
 * Every test below is written so it FAILS without the annotation: the two
 * negative cases assert that a real deletion and an unrelated finding stay
 * blocking, which is the direction a too-eager filter would break.
 */
import { describe, expect, it } from 'vitest';

import {
    annotateContradicted,
    assertsDeletion,
    classifyBlocking,
    contradictedByTree,
    namedArtifacts,
    parseDeletions,
    type Finding,
} from '../../src/scripts/self_review_gate.js';

import { isBlocking } from '../../src/scripts/check_finding_dispositions.js';

/** The finding that actually blocked 16.1.0, verbatim in shape. */
const FABRICATED: Finding = {
    severity: 'critical',
    kind: 'security',
    title: 'adversarial-review skill removed without threat analysis',
    detail:
        'The `adversarial-review` skill (SKILL.md) was deleted in this release. '
        + 'Removing it means no future PR can apply the three-lens adversarial pass.',
};

/** A real deletion must keep blocking — the direction a bad filter breaks. */
const GENUINE: Finding = {
    severity: 'critical',
    kind: 'security',
    title: 'secrets-management skill deleted without replacement',
    detail: 'The `secrets-management` skill was deleted and nothing replaces it.',
};

const exists = (present: readonly string[]) => (p: string) => present.includes(p);

describe('parseDeletions', () => {
    it('reads D rows and the OLD path of a rename, and nothing else', () => {
        const out = parseDeletions(
            [
                'M\tsrc/scripts/self_review_gate.ts',
                'A\tdocs/new.md',
                'D\tagents/roadmaps/road-to-gone.md',
                'R100\tagents/roadmaps/road-to-moved.md\tagents/roadmaps/archive/road-to-moved.md',
                '',
            ].join('\n'),
        );
        expect([...out].sort()).toEqual([
            'agents/roadmaps/road-to-gone.md',
            'agents/roadmaps/road-to-moved.md',
        ]);
    });

    it('is empty for a range that deletes nothing', () => {
        expect(parseDeletions('M\ta.ts\nA\tb.ts\n').size).toBe(0);
    });
});

describe('namedArtifacts', () => {
    it('collects the file field and every backticked bare token', () => {
        expect(
            namedArtifacts({
                title: 'the `foo-bar` skill went',
                detail: 'see `src/skills/foo-bar/SKILL.md`',
                file: 'CHANGELOG.md',
            }).sort(),
        ).toEqual(['CHANGELOG.md', 'foo-bar', 'src/skills/foo-bar/SKILL.md']);
    });

    it('ignores backticked prose — a token with whitespace is not a name', () => {
        expect(namedArtifacts({ title: 'x', detail: 'it says `no longer overwrites`' })).toEqual([]);
    });
});

describe('assertsDeletion', () => {
    it('fires on the removal vocabulary the measured findings used', () => {
        expect(assertsDeletion(FABRICATED)).toBe(true);
        expect(assertsDeletion({ title: 'skill was removed', detail: '' })).toBe(true);
    });

    it('stays silent on a finding that asserts no removal', () => {
        expect(assertsDeletion({ title: 'count drift in `CLAIMS.md`', detail: '203 vs 202' })).toBe(false);
    });
});

describe('contradictedByTree', () => {
    it('disproves the 16.1.0 fabrication: range deletes nothing, tree holds the skill', () => {
        const why = contradictedByTree(
            FABRICATED,
            new Set(['agents/roadmaps/road-to-gone.md']),
            exists(['src/skills/adversarial-review/SKILL.md']),
        );
        expect(why).toContain('adversarial-review');
        expect(why).toContain('present in the tree');
    });

    it('leaves a GENUINE deletion standing — the path is in the deletion set', () => {
        expect(
            contradictedByTree(
                GENUINE,
                new Set(['src/skills/secrets-management/SKILL.md']),
                exists([]),
            ),
        ).toBeNull();
    });

    it('leaves a deletion standing when the artifact is absent from the tree too', () => {
        expect(contradictedByTree(GENUINE, new Set(), exists([]))).toBeNull();
    });

    it('never fires on a finding that asserts no deletion at all', () => {
        expect(
            contradictedByTree(
                { title: 'count drift', detail: 'see `docs/CLAIMS.md`' },
                new Set(),
                exists(['docs/CLAIMS.md']),
            ),
        ).toBeNull();
    });
});

describe('the two gates agree', () => {
    it('a contradicted finding blocks in NEITHER gate, and is still reported', () => {
        const [annotated] = annotateContradicted(
            [FABRICATED],
            new Set(),
            exists(['src/skills/adversarial-review/SKILL.md']),
        );
        expect(annotated).toBeDefined();
        expect(annotated!.contradicted).toBeTruthy();
        expect(classifyBlocking(annotated!)).toBe(false);
        expect(isBlocking(annotated!)).toBe(false);
        // Reported, not deleted: the finding survives with its disproof.
        expect(annotated!.title).toBe(FABRICATED.title);
    });

    it('an un-annotated critical security finding still blocks in BOTH gates', () => {
        expect(classifyBlocking(FABRICATED)).toBe(true);
        expect(isBlocking(FABRICATED)).toBe(true);
    });

    it('a genuine deletion survives the annotation pass and still blocks', () => {
        const [annotated] = annotateContradicted(
            [GENUINE],
            new Set(['src/skills/secrets-management/SKILL.md']),
            exists([]),
        );
        expect(annotated!.contradicted).toBeUndefined();
        expect(classifyBlocking(annotated!)).toBe(true);
        expect(isBlocking(annotated!)).toBe(true);
    });

    it('an empty-string contradicted value is not a disproof', () => {
        expect(classifyBlocking({ ...FABRICATED, contradicted: '  ' })).toBe(true);
        expect(isBlocking({ ...FABRICATED, contradicted: '  ' })).toBe(true);
    });
});
