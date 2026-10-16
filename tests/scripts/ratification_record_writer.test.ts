import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    RatificationWriteRefused,
    REVIEWER_SPELLING,
    answersFromReply,
    recordWouldPass,
    renderRatificationRecord,
    reviewSeatsFromCouncilSession,
    type ReviewSession,
} from '../../src/scripts/_lib/ratification_record_writer.js';
import {
    RATIFICATION_DIR,
    isRatified,
    readRatification,
} from '../../src/scripts/_lib/ratification_artifact.js';
import { MODIFICATION_REVIEW_QUESTIONS } from '../../src/scripts/ai_council/modification_review_questions.js';
import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
import { commitAll } from './ratification_git_fixture.js';

/**
 * Step 3.4 — the record is written from the run, not typed.
 *
 * The property under test is that no field a writer emits is a judgement it
 * could shade. `reviewed_by` is one constant, `providers` and `verdict` come
 * from the canonical derivation, `subject` is the gate's own digest, the seats
 * are read from the council's session record, and the record is read back
 * through the shipped reader before it is returned.
 *
 * What NONE of this establishes, and the suite does not pretend otherwise: the
 * session record is the caller's file. These cases prove the writer cannot
 * shade what it was given; they prove nothing about whether a council ran.
 */

const DIGEST = 'f'.repeat(64);

function answers(): Record<string, string> {
    return Object.fromEntries(
        MODIFICATION_REVIEW_QUESTIONS.map((q) => [q.id, `An answer about ${q.id}.`]),
    );
}

function session(overrides: Partial<ReviewSession> = {}): ReviewSession {
    return {
        seats: {
            anthropic: { verdict: 'ratified', answers: answers() },
            openai: { verdict: 'ratified', answers: answers() },
        },
        proposed_by: 'claude/session-a',
        implemented_by: 'claude/session-a',
        subject: DIGEST,
        summary: 'Widens the gate to the review mechanism itself.',
        ...overrides,
    };
}

/** A seat reply as a council run stores it: nine numbered answers, then the stance line. */
function reply(label: string): string {
    const body = MODIFICATION_REVIEW_QUESTIONS.map((q, i) => `${i + 1}. Answer to ${q.id}.`);
    return [...body, '', `STANCE: ${label} | CONFIDENCE: high | DEALBREAKER: no`].join('\n');
}

describe('no field is a judgement the writer could shade', () => {
    it('reads back as a valid, passing record', () => {
        const text = renderRatificationRecord(session(), 2);
        const reading = readRatification(text, 2, DIGEST);
        expect(reading.problems).toEqual([]);
        expect(isRatified(reading)).toBe(true);
    });

    it('names the reviewer in ONE spelling, whatever the seats are called', () => {
        const a = renderRatificationRecord(session(), 2);
        const b = renderRatificationRecord(
            session({
                seats: {
                    openai: { verdict: 'confirmed-non-expanding', answers: answers() },
                    anthropic: { verdict: 'confirmed-non-expanding', answers: answers() },
                },
            }),
            2,
        );
        for (const text of [a, b]) {
            expect(text).toContain(`reviewed_by: ${REVIEWER_SPELLING}`);
        }
    });

    it('derives providers from the seats that CONCLUDED, not from the seats present', () => {
        const text = renderRatificationRecord(
            session({
                seats: {
                    anthropic: { verdict: 'ratified', answers: answers() },
                    openai: { verdict: 'no-final-verdict', answers: {} },
                },
            }),
            2,
        );
        expect(text).toContain('providers: [anthropic]');
        // Both seats stay IN `seats:` — a dropped seat is indistinguishable
        // from a seat that was never asked.
        expect(text).toContain('openai: no-final-verdict');
    });

    it('carries the subject it was handed, never one of its own', () => {
        const text = renderRatificationRecord(session({ subject: 'a'.repeat(64) }), 2);
        expect(text).toContain(`subject: ${'a'.repeat(64)}`);
    });

    it('records an unanswered question as unanswered rather than omitting it', () => {
        const partial = answers();
        delete partial['smaller-change'];
        const text = renderRatificationRecord(
            session({
                seats: {
                    anthropic: { verdict: 'ratified', answers: partial },
                    openai: { verdict: 'ratified', answers: answers() },
                },
            }),
            2,
        );
        for (const q of MODIFICATION_REVIEW_QUESTIONS) {
            expect(text, q.id).toContain(`**${q.id}**`);
        }
        expect(text.match(/no answer recorded for this question/g)).toHaveLength(1);
    });
});

describe('the seats are read from the council session record, not typed', () => {
    it('reads each seat’s verdict off its stance line and its answers off the numbering', () => {
        const seats = reviewSeatsFromCouncilSession({
            responses: [
                { provider: 'anthropic', text: reply('ratified'), error: null },
                { provider: 'openai', text: reply('confirmed-non-expanding'), error: null },
            ],
        });
        expect(seats.anthropic?.verdict).toBe('ratified');
        expect(seats.openai?.verdict).toBe('confirmed-non-expanding');
        expect(seats.anthropic?.answers['undo']).toBe('Answer to undo.');
        expect(Object.keys(seats.openai?.answers ?? {})).toHaveLength(
            MODIFICATION_REVIEW_QUESTIONS.length,
        );
    });

    it('a seat with no stance line, an error or no text is present and has no final verdict', () => {
        const seats = reviewSeatsFromCouncilSession({
            responses: [
                { provider: 'anthropic', text: 'I would call this ratified.', error: null },
                { provider: 'openai', text: '', error: 'ENOBUFS' },
            ],
        });
        expect(seats.anthropic?.verdict).toBe('no-final-verdict');
        expect(seats.openai?.verdict).toBe('no-final-verdict');
    });

    it('a label outside the review’s vocabulary is not a conclusion', () => {
        const seats = reviewSeatsFromCouncilSession({
            responses: [{ provider: 'anthropic', text: reply('approve'), error: null }],
        });
        expect(seats.anthropic?.verdict).toBe('no-final-verdict');
    });

    it('refuses a session record with no responses array, or a seat named twice', () => {
        expect(() => reviewSeatsFromCouncilSession({})).toThrow(RatificationWriteRefused);
        expect(() =>
            reviewSeatsFromCouncilSession({
                responses: [
                    { provider: 'anthropic', text: reply('ratified'), error: null },
                    { provider: 'anthropic', text: reply('refused'), error: null },
                ],
            }),
        ).toThrow(RatificationWriteRefused);
    });

    it('a nested list restarting at 1 does not overwrite the answer it sits in', () => {
        const text = [
            '1. Behaviour: two things change:',
            '   1. the first',
            '   2. the second',
            '2. Boundary: none.',
        ].join('\n');
        const got = answersFromReply(text);
        expect(got['behaviour-change']).toContain('the second');
        expect(got['boundary-direction']).toBe('Boundary: none.');
        expect(got['undo']).toBeUndefined();
    });
});

describe('the council’s resolution: the header says what the seats said', () => {
    const oneSeat = (): ReviewSession =>
        session({
            seats: {
                anthropic: { verdict: 'ratified', answers: answers() },
                openai: { verdict: 'no-final-verdict', answers: {} },
            },
        });

    it('a quorum-short review is WRITTEN, and says `ratified` with one provider', () => {
        const text = renderRatificationRecord(oneSeat(), 2);
        expect(text).toContain('verdict: ratified');
        expect(text).not.toContain('verdict: non-convergent');
    });

    it('AC-2: and that record does NOT pass — the diversity rule is what refuses it', () => {
        expect(recordWouldPass(oneSeat(), 2)).toBe(false);
        const reading = readRatification(renderRatificationRecord(oneSeat(), 2), 2, DIGEST);
        expect(reading.problems.map((p) => p.code)).toEqual(['diversity-required']);
    });

    it('a refusing seat refuses even when it is the only one that concluded', () => {
        const s = session({
            seats: {
                anthropic: { verdict: 'refused', answers: answers() },
                openai: { verdict: 'no-final-verdict', answers: {} },
            },
        });
        expect(renderRatificationRecord(s, 2)).toContain('verdict: refused');
        expect(recordWouldPass(s, 2)).toBe(false);
    });

    it('a non-passing record is still written, because the escalation needs it', () => {
        const s = session({
            seats: {
                anthropic: { verdict: 'refused', answers: answers() },
                openai: { verdict: 'ratified', answers: answers() },
            },
        });
        expect(() => renderRatificationRecord(s, 2)).not.toThrow();
        expect(recordWouldPass(s, 2)).toBe(false);
    });
});

describe('the writer refuses rather than hand back a file nobody can land', () => {
    it('a review with no seats at all', () => {
        expect(() => renderRatificationRecord(session({ seats: {} }), 2)).toThrow(
            RatificationWriteRefused,
        );
    });

    it('a producer that is also the reviewer spelling', () => {
        expect(() =>
            renderRatificationRecord(session({ proposed_by: REVIEWER_SPELLING }), 2),
        ).toThrow(RatificationWriteRefused);
    });

    it('a malformed subject', () => {
        expect(() => renderRatificationRecord(session({ subject: 'nope' }), 2)).toThrow(
            RatificationWriteRefused,
        );
    });

    it('a bad `effective_after`', () => {
        expect(() =>
            renderRatificationRecord(session({ effective_after: 'later' }), 2),
        ).toThrow(RatificationWriteRefused);
    });

    it('a producer field that would break the frontmatter line', () => {
        expect(() =>
            renderRatificationRecord(session({ implemented_by: 'a\nverdict: ratified' }), 2),
        ).toThrow(RatificationWriteRefused);
    });
});

describe('a written record lands through the real gate', () => {
    it('end to end: digest from the gate, record from the writer, gate green, then red on an edit', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-'));
        try {
            const kernel = 'src/rules/commit-policy.md';
            fs.mkdirSync(path.join(root, 'src/rules'), { recursive: true });
            fs.writeFileSync(path.join(root, kernel), 'the rule under review\n');
            commitAll(root);

            const { digest } = gate.expectedSubjectFor([kernel], root);
            const text = renderRatificationRecord(session({ subject: digest }), 2);

            const rel = path.join(RATIFICATION_DIR, 'written.md');
            fs.mkdirSync(path.join(root, RATIFICATION_DIR), { recursive: true });
            fs.writeFileSync(path.join(root, rel), text);
            commitAll(root);

            const r = gate.evaluate([kernel, rel], root, 2);
            expect(r.exitCode, r.lines.join('\n')).toBe(0);

            // The binding is live on a record this writer produced: edit the
            // reviewed file afterwards and the same record reds.
            fs.writeFileSync(path.join(root, kernel), 'edited after the review\n');
            commitAll(root);
            expect(gate.evaluate([kernel, rel], root, 2).exitCode).toBe(1);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
