// Unit tests for the ask surface added by road-to-asked-not-parked:
// `_lib/structured_ask.ts` (the shared structured-ask definition),
// `ask_block_census.ts` (the classification unit), and the `form` dimension
// `probe_unblocked_ask.ts` grew in 1.1.
//
// The property that matters most here is NEGATIVE: the census must stay silent
// on shapes that are not asks, and the structured-ask matcher must not claim a
// host ships a tool nobody observed. A detector that fires on everything
// measures nothing, so every block below carries its own near-miss.
import { describe, expect, it } from 'vitest';

import {
    ASK_CLASSES,
    isQuestionLine,
    scanFile,
    selfTest as censusSelfTest,
} from '../../src/scripts/ask_block_census.js';
import { askForm } from '../../src/scripts/probe_unblocked_ask.js';
import {
    countStructuredAskQuestions,
    isStructuredAskTool,
    STRUCTURED_ASK_SHAPES,
    structuredAskShape,
} from '../../src/scripts/_lib/structured_ask.js';

describe('structured_ask — the shared definition', () => {
    it('ships NO observed per-host shape', () => {
        // The whole honesty claim of the module. A row here means a real
        // session observed the tool; the registry being empty is the record
        // that none has.
        expect(Object.keys(STRUCTURED_ASK_SHAPES)).toEqual([]);
        expect(structuredAskShape('claude')).toBeUndefined();
        expect(structuredAskShape(null)).toBeUndefined();
    });

    it('matches structured-ask tool NAMES by shape', () => {
        expect(isStructuredAskTool('AskUserQuestion')).toBe(true);
        expect(isStructuredAskTool('ask_user_question')).toBe(true);
        expect(isStructuredAskTool('user-question')).toBe(true);
    });

    it('does not match ordinary tools', () => {
        for (const name of ['Bash', 'Read', 'Edit', 'Task', 'WebSearch', 'AskTheDocs']) {
            expect(isStructuredAskTool(name)).toBe(false);
        }
    });

    it('counts questions in the two recognised payload shapes', () => {
        expect(countStructuredAskQuestions({ questions: [{}, {}] })).toBe(2);
        expect(countStructuredAskQuestions({ questions: [{}] })).toBe(1);
        expect(countStructuredAskQuestions({ questions: [] })).toBe(0);
        expect(countStructuredAskQuestions({ question: 'which one?' })).toBe(1);
    });

    it('returns -1 — cannot tell — for an unrecognised payload', () => {
        // A gate must never read "cannot tell" as "one".
        expect(countStructuredAskQuestions(null)).toBe(-1);
        expect(countStructuredAskQuestions('questions')).toBe(-1);
        expect(countStructuredAskQuestions([{ question: 'x' }])).toBe(-1);
        expect(countStructuredAskQuestions({ unrelated: 3 })).toBe(-1);
        expect(countStructuredAskQuestions({ question: '   ' })).toBe(-1);
    });
});

describe('probe_unblocked_ask — the form partition', () => {
    it('is native only when a structured-ask tool was called', () => {
        expect(askForm(['AskUserQuestion'])).toBe('native');
        expect(askForm(['Bash', 'AskUserQuestion'])).toBe('native');
    });

    it('is text otherwise, including for a turn with no tools at all', () => {
        expect(askForm([])).toBe('text');
        expect(askForm(['Bash', 'Read'])).toBe('text');
    });
});

describe('ask_block_census — the classification unit', () => {
    it('passes its own fixture suite', () => {
        expect(censusSelfTest()).toBe(0);
    });

    it('declares exactly the four classes the roadmap names', () => {
        expect([...ASK_CLASSES].sort()).toEqual(
            ['batch', 'count-only', 'file-parked', 'single'].sort(),
        );
    });

    it('treats a whole fence as one region', () => {
        const regions = scanFile('```\nOne?\n\nTwo?\n\nThree?\n```\n');
        expect(regions.filter((r) => r.cls === 'batch')).toHaveLength(1);
        expect(regions.filter((r) => r.cls === 'single')).toHaveLength(0);
    });

    it('splits prose on blank lines', () => {
        const regions = scanFile('One?\n\nTwo?\n');
        expect(regions.filter((r) => r.cls === 'single')).toHaveLength(2);
        expect(regions.filter((r) => r.cls === 'batch')).toHaveLength(0);
    });

    it('reads a question count placeholder as count-only, not as a question', () => {
        const regions = scanFile('Open questions: {count}\n');
        expect(regions.map((r) => r.cls)).toEqual(['count-only']);
    });

    it('does not fire count-only on a count that is not about questions', () => {
        expect(scanFile('Files scanned: {count}\n')).toEqual([]);
    });

    it('clears file-parked once the section states the ask obligation', () => {
        const parked = '## Open questions\n\n- one\n- two\n';
        expect(scanFile(parked).filter((r) => r.cls === 'file-parked')).toHaveLength(1);
        const owed =
            '## Open questions\n\nEach entry is a question still owed to the user — put one at a time.\n';
        expect(scanFile(owed).filter((r) => r.cls === 'file-parked')).toHaveLength(0);
    });

    it('stays silent on ordinary prose', () => {
        expect(scanFile('This is a statement.\n\nSo is this.\n')).toEqual([]);
    });

    it('recognises a question line by its terminator or its placeholder', () => {
        expect(isQuestionLine('What belongs in scope?')).toBe(true);
        expect(isQuestionLine('**Was passt besser?**')).toBe(true);
        expect(isQuestionLine('- {question 1}')).toBe(true);
        expect(isQuestionLine('This is a statement.')).toBe(false);
        expect(isQuestionLine('- an ordinary bullet')).toBe(false);
        expect(isQuestionLine('')).toBe(false);
    });
});
