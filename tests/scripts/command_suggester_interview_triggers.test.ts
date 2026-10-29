import { beforeAll, describe, expect, it } from 'vitest';

import { load_commands, match } from '../../src/scripts/command_suggester/index.js';
import type { CommandSpec } from '../../src/scripts/command_suggester/types.js';
import { COMMANDS_DIR } from './_command_suggester.js';

const INTERVIEW_COMMANDS = new Set(['challenge-me', 'grill-me']);

// A user appending an "interview me" sentence to a task prompt must reach the
// interview, in English and in German, at or above the suggestion floor.
const PHRASINGS = [
    'Rewrite the release notes. If you need more info, interview me.',
    'Plan the migration and ask me follow-up questions before you start.',
    'Schneide das Video neu. Wenn du noch mehr Infos brauchst, stell mir Rückfragen und interview mich.',
    'Bau die Landingpage um, aber frag mich aus, bevor du loslegst.',
];

let SPECS: CommandSpec[] = [];

beforeAll(() => {
    SPECS = load_commands(COMMANDS_DIR);
});

describe('interview phrasings reach the interview', () => {
    for (const prompt of PHRASINGS) {
        it(prompt, () => {
            const top = match(prompt, [], SPECS)[0];
            expect(top).toBeDefined();
            expect(INTERVIEW_COMMANDS.has(top!.command)).toBe(true);
            expect(top!.score).toBeGreaterThanOrEqual(0.6);
        });
    }

    it('a prompt without an interview request does not reach it', () => {
        const top = match('Rewrite the release notes for 17.4.', [], SPECS)[0];
        expect(top === undefined || !INTERVIEW_COMMANDS.has(top.command)).toBe(true);
    });
});
