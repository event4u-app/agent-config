import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _runChecks, proposalSubjectOf } from '../../src/scripts/check_proposal.js';
import { commitAll } from './ratification_git_fixture.js';

/**
 * Step 6.1 of `road-to-self-modification-that-a-council-must-pass`: a package
 * proposal reaches `stage: gated` only on a council record AND an owner
 * authorization, both bound to the digest of the files the proposal declares as
 * its change. The order is ADR-281's amendment: the record is the review, the
 * authorization is the approval.
 *
 * What the suite does NOT claim, matching the check's own header: nothing here
 * establishes that the owner wrote the authorization. These cases pin the
 * binding and the reader, which are the checkable part.
 */

let root: string;
const SKILL = 'src/skills/sample/SKILL.md';
const RECORD = 'agents/evidence/ratifications/sample.md';
const AUTH = 'agents/evidence/owner-authorizations/sample.md';

function proposal(fm: Record<string, string>): string {
    return [
        '---',
        'proposal_id: sample-one',
        'type: skill',
        'author: team-x',
        'created: 2026-10-01',
        'last_updated: 2026-10-21',
        ...Object.entries(fm).map(([k, v]) => `${k}: ${v}`),
        '---',
        '',
        '# Proposal: sample',
        '',
        '## 1. Learning',
        '',
        'Pattern.',
        '',
        '## 2. Classification',
        '',
        'Scope.',
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
        'Body.',
        '',
        '## 5. Quality gate expectations',
        '',
        'Checks.',
        '',
        '## 6. Replacement justification',
        '',
        'None.',
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

const GATED = {
    scope: 'package',
    stage: 'gated',
    changed_files: `[${SKILL}]`,
    ratification_record: RECORD,
    owner_authorization: AUTH,
};

function write(rel: string, body: string): void {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
}

function record(subject: string, verdict = 'ratified', providers = ['anthropic', 'openai']): string {
    return [
        '---',
        'proposed_by: claude/session-a',
        'implemented_by: claude/session-a',
        'reviewed_by: ai-council',
        `subject: ${subject}`,
        `providers: [${providers.join(', ')}]`,
        `verdict: ${verdict}`,
        'seats:',
        ...providers.map((p) => `  ${p}: ${verdict}`),
        'effective_after: merge',
        '---',
        '',
        '<!-- evidence-type: ratification -->',
        '',
        'Review.',
        '',
    ].join('\n');
}

/** Commit the skill, then write record and authorization for its digest, then commit those. */
function setUp(opts: { recordSubject?: string; authSubject?: string | null; verdict?: string; providers?: string[] } = {}): string {
    write(SKILL, 'the skill body the learning changes\n');
    commitAll(root);
    const digest = proposalSubjectOf(root, [SKILL]);
    write(RECORD, record(opts.recordSubject ?? digest, opts.verdict, opts.providers));
    if (opts.authSubject !== null) {
        write(AUTH, `subject: ${opts.authSubject ?? digest}\n`);
    }
    commitAll(root);
    return digest;
}

function gated(fm: Record<string, string>): string[] {
    return _runChecks(proposal(fm), null, root)
        .filter((f) => f.section === 'gated')
        .map((f) => f.message);
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'gated-prop-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('check_proposal — a gated package proposal names its review and its approval', () => {
    it('passes when both are bound to the declared change', () => {
        setUp();
        expect(gated(GATED)).toEqual([]);
    });

    it('the digest covers an ungated skill body, so it is not the empty-set digest', () => {
        const digest = setUp();
        expect(digest).not.toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('a record with no owner authorization is refused, naming the missing approval', () => {
        setUp({ authSubject: null });
        const { owner_authorization: _drop, ...noAuth } = GATED;
        const out = gated(noAuth);
        expect(out).toHaveLength(1);
        expect(out[0]).toContain('owner_authorization');
    });

    it('an authorization naming a file that is not committed is refused', () => {
        setUp({ authSubject: null });
        expect(gated(GATED).join('\n')).toContain('not a committed regular file');
    });

    it('a record bound to other content is refused', () => {
        setUp({ recordSubject: 'a'.repeat(64) });
        expect(gated(GATED).join('\n')).toContain('ratification_record');
    });

    it('an authorization bound to other content is refused', () => {
        setUp({ authSubject: 'b'.repeat(64) });
        expect(gated(GATED).join('\n')).toContain('not to this proposal');
    });

    it('a `refused` record does not pass, whatever it is bound to', () => {
        setUp({ verdict: 'refused' });
        expect(gated(GATED).join('\n')).toContain('verdict is `refused`');
    });

    it('a one-provider record does not pass the committed provider policy', () => {
        setUp({ providers: ['anthropic'] });
        expect(gated(GATED).join('\n')).toContain('distinct providers are required');
    });

    it('editing the declared file after the review moves the digest and refuses both', () => {
        setUp();
        write(SKILL, 'edited after the review\n');
        commitAll(root);
        const out = gated(GATED);
        expect(out).toHaveLength(2);
    });

    it('a record path that escapes the tree is refused', () => {
        setUp();
        expect(gated({ ...GATED, ratification_record: '../outside.md' }).join('\n')).toContain(
            'ratification_record',
        );
    });

    it('a record outside the ratifications directory is refused', () => {
        setUp();
        expect(gated({ ...GATED, ratification_record: AUTH }).join('\n')).toContain('not a record under');
    });

    it('a missing or empty changed_files is refused', () => {
        setUp();
        const { changed_files: _drop, ...noFiles } = GATED;
        expect(gated(noFiles).join('\n')).toContain('changed_files');
        expect(gated({ ...GATED, changed_files: '[]' }).join('\n')).toContain('changed_files');
    });

    it('polarity: a project-scoped proposal at gated is checked as before', () => {
        setUp();
        expect(gated({ scope: 'project', stage: 'gated' })).toEqual([]);
    });

    it('polarity: a package proposal before gated is checked as before', () => {
        setUp();
        expect(gated({ scope: 'package', stage: 'proposed' })).toEqual([]);
    });
});
