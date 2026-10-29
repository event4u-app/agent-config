import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODIFICATION_REVIEW_QUESTIONS } from '../../src/scripts/ai_council/modification_review_questions.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const GATED_SKILLS = [
    'src/skills/learning-to-rule-or-skill/SKILL.md',
    'src/skills/skill-improvement-pipeline/SKILL.md',
];

describe('learning promotion gates ask about their own judge', () => {
    const question = MODIFICATION_REVIEW_QUESTIONS.find((q) => q.id === 'weakens-its-own-judge');

    it('the question still exists in the constant', () => {
        expect(question).toBeDefined();
    });

    for (const rel of GATED_SKILLS) {
        it(`${rel} carries the question text verbatim`, () => {
            const body = fs.readFileSync(path.join(REPO, rel), 'utf8');
            expect(body).toContain(question!.text);
        });
    }
});
