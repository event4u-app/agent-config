// 24 ratification rounds on PR #3005 asked the seats to close on `VERDICT:`.
// The record writer reads only the stance line, so none of them produced a
// record. A ratification prompt is now checked before a single seat is paid.
import { describe, expect, it } from 'vitest';

import { isRatificationPrompt, ratificationPromptProblem } from '../../src/scripts/ai_council/ratification_prompt.js';

const SUBJECT = `subject: ${'ab'.repeat(32)}`;
const STANCE = '`STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>`';

describe('ratification prompts are checked before the run', () => {
    it('a prompt with one subject line is a ratification prompt; one without is not', () => {
        expect(isRatificationPrompt(`# Review\n\n${SUBJECT}\n`)).toBe(true);
        expect(isRatificationPrompt('# Review\n\nno digest here\n')).toBe(false);
        expect(isRatificationPrompt(`a digest in prose ${'ab'.repeat(32)} binds nothing`)).toBe(false);
    });

    it('accepts a ratification prompt that asks for the stance line', () => {
        expect(ratificationPromptProblem(`# Review\n\n${SUBJECT}\n\nClose with:\n${STANCE}\n`)).toBeNull();
    });

    it('refuses a ratification prompt that asks for a VERDICT line instead', () => {
        const p = `# Review\n\n${SUBJECT}\n\nEnd with exactly one verdict line: \`VERDICT: ratified\`, \`VERDICT: refused — <reason>\`.\n`;
        expect(ratificationPromptProblem(p)).toMatch(/STANCE/);
    });

    it('refuses a stance line that omits a label the record writer needs', () => {
        const p = `${SUBJECT}\nSTANCE: <ratified | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>\n`;
        expect(ratificationPromptProblem(p)).toMatch(/confirmed-non-expanding/);
    });

    it('says nothing about a prompt that is not a ratification prompt', () => {
        expect(ratificationPromptProblem('VERDICT: whatever, this is a design question')).toBeNull();
    });
});
