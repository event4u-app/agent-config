// HANDOFF.md artifact validation (workflow-contracts Phase 2).
import { describe, expect, test } from 'vitest';

import {
    handoff_section_body,
    validate_handoff_artifact,
    validate_handoff_open_questions,
    validate_handoff_self_critique,
} from '../../src/scripts/lint_handoffs.js';

/**
 * The four self-critique sections, assembled from a heading helper rather than
 * written as literal `##` lines: a heading at the start of a source line reads
 * as report structure to `lint_code_comments`, and this is fixture DATA, not a
 * comment. The helper keeps the fixture the single source of the shape.
 */
const H = (name: string): string => `${'##'} ${name}`;

const NOT_DONE_BODY = '- the CLI flag is unwired — verify: rg -n "--slug" src/cli | wc -l\n';

const CRITIQUE = [
    `${H('Least confident')}\n- the slug collision path is untested for Unicode — verify: npx vitest run tests/slugify.test.ts -t unicode\n`,
    `${H('Biggest thing missed')}\n- none\n`,
    `${H('Breaks in three months because')}\n- the upstream regex is pinned by version — verify: npm ls slugify | head -1\n`,
    `${H('Not done')}\n${NOT_DONE_BODY}`,
].join('');

const FULL = [
    '# HANDOFF\n',
    `${H('Mode')}\nImplement (TDD)\n`,
    `${H('Contract received')}\nfailing test for slugify edge case\n`,
    `${H('Contract owed')}\ngreen run output\n`,
    `${H('Decisions')}\n- kept current API\n`,
    `${H('Open questions')}\n- none\n`,
    CRITIQUE,
    `${H('Next command')}\nnpx vitest run tests/slugify.test.ts\n`,
].join('');

test('complete artifact validates', () => {
    expect(validate_handoff_artifact(FULL)).toEqual([]);
});

test('missing "Contract owed" → red (acceptance fixture)', () => {
    const broken = FULL.replace(`${H('Contract owed')}\ngreen run output\n`, '');
    expect(validate_handoff_artifact(broken)).toEqual(['Contract owed']);
});

// The Open-questions SHAPE check. Every case is built by replacing the section
// body in FULL, so the fixture stays the single source of the artefact shape.
describe('Open questions — shape, not just the heading', () => {
    function withOpenQuestions(body: string): string {
        return FULL.replace(`${H('Open questions')}\n- none\n`, `${H('Open questions')}\n${body}`);
    }

    test('the shipped fixture passes — an explicit "none" is an answer, not a defect', () => {
        expect(validate_handoff_open_questions(FULL)).toBeNull();
    });

    test.each(['- none', 'None.', '- keine', '- n/a', '- Nothing', '- **none**'])(
        'accepts an explicit none-marker: %s',
        (body) => {
            expect(validate_handoff_open_questions(withOpenQuestions(`${body}\n`))).toBeNull();
        },
    );

    test('accepts a real question', () => {
        expect(
            validate_handoff_open_questions(
                withOpenQuestions('- should the old API stay until the next major?\n'),
            ),
        ).toBeNull();
    });

    test('flags an empty section', () => {
        expect(validate_handoff_open_questions(withOpenQuestions('\n'))).toContain('is empty');
    });

    test.each(['- TBD', '- TODO', '- ...', '?'])('flags a bare placeholder: %s', (body) => {
        expect(validate_handoff_open_questions(withOpenQuestions(`${body}\n`))).toContain(
            'placeholder',
        );
    });

    test('leaves a declarative note alone — this check is not a phrasing gate', () => {
        expect(
            validate_handoff_open_questions(
                withOpenQuestions('- the retry budget still needs a decision from the maintainer\n'),
            ),
        ).toBeNull();
    });

    test('says nothing when the section is absent — that is the other check', () => {
        const withoutSection = FULL.replace(`${H('Open questions')}\n- none\n`, '');
        expect(validate_handoff_open_questions(withoutSection)).toBeNull();
        expect(validate_handoff_artifact(withoutSection)).toEqual(['Open questions']);
    });

    test('a `##` inside a fence does not end the section early', () => {
        const fenced = withOpenQuestions('```\n## not a heading\n```\n- is this still read?\n');
        expect(validate_handoff_open_questions(fenced)).toBeNull();
    });

    test('the section body stops at the next heading', () => {
        const body = handoff_section_body(FULL, 'Open questions');
        expect(body).not.toBeNull();
        expect(body).toContain('none');
        expect(body).not.toContain('Next command');
    });
});


// 5.1 — the four self-critique sections
describe('self-critique sections carry falsifiable uncertainty', () => {
    function withNotDone(body: string): string {
        return FULL.replace(
            `${H('Not done')}\n${NOT_DONE_BODY}`,
            `${H('Not done')}\n${body}`,
        );
    }

    test('the shipped fixture passes — every line names how it would be killed', () => {
        expect(validate_handoff_self_critique(FULL)).toEqual([]);
    });

    test('a `## Not done` line with no verify: is rejected', () => {
        const findings = validate_handoff_self_critique(
            withNotDone('- the CLI flag is unwired\n'),
        );
        expect(findings).toHaveLength(1);
        expect(findings[0]).toContain('## Not done');
        expect(findings[0]).toContain('no `verify:`');
    });

    test('`none` is accepted as the whole section body', () => {
        expect(validate_handoff_self_critique(withNotDone('- none\n'))).toEqual([]);
    });

    test('blankness is not — matching the `## Open questions` treatment', () => {
        const findings = validate_handoff_self_critique(withNotDone('\n'));
        expect(findings).toHaveLength(1);
        expect(findings[0]).toContain('is empty');
    });

    test('`none` beside a real unverified line does not launder it', () => {
        const findings = validate_handoff_self_critique(
            withNotDone('- none\n- the CLI flag is unwired\n'),
        );
        expect(findings).toHaveLength(1);
        expect(findings[0]).toContain('no `verify:`');
    });

    test('all four sections are required by the artifact validator', () => {
        for (const heading of [
            'Least confident',
            'Biggest thing missed',
            'Breaks in three months because',
            'Not done',
        ]) {
            const body = handoff_section_body(FULL, heading);
            expect(body, `${heading} missing from the fixture`).not.toBeNull();
        }
        const stripped = FULL.replace(new RegExp(`${H('Not done')}\\n[^#]*`), '');
        expect(validate_handoff_artifact(stripped)).toEqual(['Not done']);
    });
});
