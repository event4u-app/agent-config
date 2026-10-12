import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _runChecks } from '../../src/scripts/check_proposal.js';
import { expectedSubjectFor } from '../../src/scripts/check_kernel_edit_ratified.js';

/**
 * Step 6.1 — the pipeline's review is the council's record; the approval is the
 * owner's.
 *
 * The order is the owner's amendment of 2026-10-07 and is the whole point of
 * the step: the council record is the REVIEW, the owner's authorization is the
 * APPROVAL. Both must be bound to the SAME digest as the files the proposal
 * declares as its change, so neither can be carried over from another one.
 *
 * What the suite does NOT claim, matching the gate's own header: nothing here
 * establishes that the owner wrote the authorization. ADR-281 § 5 makes his
 * route a forge bypass that leaves no artifact a gate can authenticate. These
 * cases pin the binding, which is the part that is checkable.
 */

let tmp: string;
const KERNEL = 'src/rules/commit-policy.md';

function proposal(fm: Record<string, string>): string {
    return [
        '---',
        'proposal_id: sample-one',
        'type: rule',
        'author: team-x',
        'created: 2026-10-01',
        'last_updated: 2026-10-12',
        ...Object.entries(fm).map(([k, v]) => `${k}: ${v}`),
        '---',
        '',
        '# Proposal: sample',
        '',
        '## 1. Learning',
        '',
        'Pattern description.',
        '',
        '## 2. Classification',
        '',
        'Scope / Type / etc.',
        '',
        '## 3. Evidence',
        '',
        '```yaml',
        'evidence:',
        '  - kind: pr',
        '    ref: https://github.com/org-a/repo-a/pull/1',
        '    summary: first.',
        '  - kind: review-comment',
        '    ref: https://gitlab.com/org-b/repo-b/pull/42',
        '    summary: second.',
        '```',
        '',
        '## 4. Proposed artefact',
        '',
        'Draft body.',
        '',
        '## 5. Quality gate expectations',
        '',
        'Checks.',
        '',
        '## 6. Replacement justification',
        '',
        'N/A.',
        '',
        '## 7. Success signal',
        '',
        '- Metric: reviewer comments per month',
        '- Baseline: 3',
        '- Target: < 1',
        '- Evaluation date: 2027-01-12',
        '',
        '## 8. Risks and alternatives rejected',
        '',
        'Risks.',
        '',
        '## 9. Gate verdict',
        '',
        'Pending.',
        '',
        '## 10. Upstream PR',
        '',
        'Pending.',
        '',
    ].join('\n');
}

function writeRecord(name: string, subject: string): string {
    const rel = `agents/evidence/ratifications/${name}`;
    mkdirSync(join(tmp, 'agents/evidence/ratifications'), { recursive: true });
    writeFileSync(
        join(tmp, rel),
        ['---', `subject: ${subject}`, 'verdict: ratified', '---', '', 'Body.', ''].join('\n'),
    );
    return rel;
}

/** Findings in the `gated` section, which is the only one these cases are about. */
function gatedFindings(text: string): string[] {
    return _runChecks(text, null, tmp)
        .filter((f) => f.section === 'gated')
        .map((f) => f.message);
}

beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'gated-prop-'));
    mkdirSync(join(tmp, 'src/rules'), { recursive: true });
    writeFileSync(join(tmp, KERNEL), 'the rule the proposal changes\n');
});

afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

describe('a package proposal cannot reach `gated` on nothing', () => {
    it('refuses it with no `changed_files`', () => {
        const out = gatedFindings(proposal({ scope: 'package', stage: 'gated' }));
        expect(out.join('\n')).toContain('needs `changed_files:`');
    });

    it('refuses it with files but no record and no authorization', () => {
        const text = proposal({
            scope: 'package',
            stage: 'gated',
            changed_files: `[${KERNEL}]`,
        });
        const out = gatedFindings(text).join('\n');
        expect(out).toContain('ratification_record');
        expect(out).toContain('owner_authorization');
    });

    it('refuses it with the council’s record but NO owner authorization', () => {
        // The amendment of 2026-10-07, as a test: a favourable council verdict
        // is a review, never the approval.
        const subject = expectedSubjectFor([KERNEL], tmp);
        const rec = writeRecord('review.md', subject);
        const out = gatedFindings(
            proposal({
                scope: 'package',
                stage: 'gated',
                changed_files: `[${KERNEL}]`,
                ratification_record: rec,
            }),
        ).join('\n');
        expect(out).toContain('owner_authorization');
        expect(out).not.toContain('`ratification_record:`');
    });
});

describe('both must be bound to the proposal’s OWN change', () => {
    it('passes when record and authorization carry this change’s digest', () => {
        const subject = expectedSubjectFor([KERNEL], tmp);
        const text = proposal({
            scope: 'package',
            stage: 'gated',
            changed_files: `[${KERNEL}]`,
            ratification_record: writeRecord('review.md', subject),
            owner_authorization: writeRecord('owner.md', subject),
        });
        expect(gatedFindings(text)).toEqual([]);
    });

    it('refuses a record bound to a DIFFERENT change', () => {
        const subject = expectedSubjectFor([KERNEL], tmp);
        const text = proposal({
            scope: 'package',
            stage: 'gated',
            changed_files: `[${KERNEL}]`,
            ratification_record: writeRecord('elsewhere.md', 'a'.repeat(64)),
            owner_authorization: writeRecord('owner.md', subject),
        });
        expect(gatedFindings(text).join('\n')).toContain('answers for different content');
    });

    it('refuses an authorization bound to a DIFFERENT change', () => {
        // The carry-over this step exists to stop: a real owner authorization
        // from last week, reused for this week's diff.
        const subject = expectedSubjectFor([KERNEL], tmp);
        const text = proposal({
            scope: 'package',
            stage: 'gated',
            changed_files: `[${KERNEL}]`,
            ratification_record: writeRecord('review.md', subject),
            owner_authorization: writeRecord('lastweek.md', 'b'.repeat(64)),
        });
        expect(gatedFindings(text).join('\n')).toContain('answers for different content');
    });

    it('refuses a record that carries no digest at all', () => {
        const subject = expectedSubjectFor([KERNEL], tmp);
        mkdirSync(join(tmp, 'agents/evidence/ratifications'), { recursive: true });
        writeFileSync(
            join(tmp, 'agents/evidence/ratifications/old.md'),
            '---\nverdict: ratified\n---\n\nA record from before the binding.\n',
        );
        const text = proposal({
            scope: 'package',
            stage: 'gated',
            changed_files: `[${KERNEL}]`,
            ratification_record: 'agents/evidence/ratifications/old.md',
            owner_authorization: writeRecord('owner.md', subject),
        });
        expect(gatedFindings(text).join('\n')).toContain('not bound to any change');
    });

    it('refuses a named file that does not exist', () => {
        const subject = expectedSubjectFor([KERNEL], tmp);
        const text = proposal({
            scope: 'package',
            stage: 'gated',
            changed_files: `[${KERNEL}]`,
            ratification_record: 'agents/evidence/ratifications/ghost.md',
            owner_authorization: writeRecord('owner.md', subject),
        });
        expect(gatedFindings(text).join('\n')).toContain('not readable');
    });

    it('the digest moves when the declared file changes', () => {
        const subject = expectedSubjectFor([KERNEL], tmp);
        const text = proposal({
            scope: 'package',
            stage: 'gated',
            changed_files: `[${KERNEL}]`,
            ratification_record: writeRecord('review.md', subject),
            owner_authorization: writeRecord('owner.md', subject),
        });
        expect(gatedFindings(text)).toEqual([]);

        writeFileSync(join(tmp, KERNEL), 'edited after both were written\n');
        expect(gatedFindings(text).join('\n')).toContain('answers for different content');
    });
});

describe('what the check deliberately leaves alone', () => {
    it('a `scope: project` proposal at `gated` is checked as before', () => {
        // Its approval is the user's, on their own project.
        expect(gatedFindings(proposal({ scope: 'project', stage: 'gated' }))).toEqual([]);
    });

    it('a package proposal at an earlier stage is checked as before', () => {
        for (const stage of ['captured', 'classified', 'proposed']) {
            expect(gatedFindings(proposal({ scope: 'package', stage })), stage).toEqual([]);
        }
    });
});
