// HANDOFF.md artifact validation (workflow-contracts Phase 2).
import { describe, expect, test } from 'vitest';

import {
    handoff_section_body,
    validate_handoff_artifact,
    validate_handoff_open_questions,
} from '../../src/scripts/lint_handoffs.js';

const FULL = `# HANDOFF
## Mode
Implement (TDD)
## Contract received
failing test for slugify edge case
## Contract owed
green run output
## Decisions
- kept current API
## Open questions
- none
## Next command
npx vitest run tests/slugify.test.ts
`;

test('complete artifact validates', () => {
    expect(validate_handoff_artifact(FULL)).toEqual([]);
});

test('missing "Contract owed" → red (acceptance fixture)', () => {
    const broken = FULL.replace('## Contract owed\ngreen run output\n', '');
    expect(validate_handoff_artifact(broken)).toEqual(['Contract owed']);
});

// The Open-questions SHAPE check. Every case is built by replacing the section
// body in FULL, so the fixture stays the single source of the artefact shape.
describe('Open questions — shape, not just the heading', () => {
    function withOpenQuestions(body: string): string {
        return FULL.replace('## Open questions\n- none\n', `## Open questions\n${body}`);
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
        const withoutSection = FULL.replace('## Open questions\n- none\n', '');
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
