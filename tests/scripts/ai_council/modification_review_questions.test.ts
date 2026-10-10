import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    MODIFICATION_REVIEW_QUESTIONS,
    renderModificationReviewQuestions,
} from '../../../src/scripts/ai_council/modification_review_questions.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('3.1 — the question set is one constant', () => {
    it('asks the nine the roadmap enumerates, in order, each addressable alone', () => {
        expect(MODIFICATION_REVIEW_QUESTIONS).toHaveLength(9);
        expect(MODIFICATION_REVIEW_QUESTIONS.map((q) => q.id)).toEqual([
            'behaviour-change',
            'boundary-direction',
            'weakens-its-own-judge',
            'route-around',
            'undo',
            'falsifier',
            'smaller-change',
            'instruction-weight',
            'untrusted-steering',
        ]);
        for (const q of MODIFICATION_REVIEW_QUESTIONS) {
            expect(q.text.length).toBeGreaterThan(30);
            expect(q.text.trim()).toBe(q.text);
        }
    });

    it('the ids are unique — a duplicate would silently drop a question', () => {
        const ids = MODIFICATION_REVIEW_QUESTIONS.map((q) => q.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('reuses the tree’s own wording where the tree already words a question', () => {
        const weakens = MODIFICATION_REVIEW_QUESTIONS.find((q) => q.id === 'weakens-its-own-judge');
        const falsifier = MODIFICATION_REVIEW_QUESTIONS.find((q) => q.id === 'falsifier');
        // The evaluator rule's own weakening clause, not a paraphrase of it.
        expect(weakens?.text).toContain('weakens an assertion');
        expect(weakens?.text).toContain('lowers a threshold');
        expect(weakens?.source).toContain('evaluator-independence');
        // The synthesis prompt's own kill-switch wording.
        expect(falsifier?.text.toLowerCase()).toContain('kill-switch');
        expect(falsifier?.source).toContain('prompts.ts');
    });

    it('the cited sources still carry the wording they are cited for', () => {
        const rule = fs.readFileSync(path.join(REPO, 'src/rules/evaluator-independence.md'), 'utf8');
        expect(rule.toUpperCase()).toContain('WEAKENS AN ASSERTION');
        expect(rule.toUpperCase()).toContain('LOWERS A THRESHOLD');
        const prompts = fs.readFileSync(
            path.join(REPO, 'src/scripts/ai_council/prompts.ts'),
            'utf8',
        );
        expect(prompts.toLowerCase()).toContain('kill-switch criteria');
    });

    it('renders every question, numbered, with nothing dropped', () => {
        const rendered = renderModificationReviewQuestions();
        for (const [i, q] of MODIFICATION_REVIEW_QUESTIONS.entries()) {
            expect(rendered).toContain(`${i + 1}.`);
            expect(rendered).toContain(q.text);
        }
        expect(rendered.split('\n').filter((l) => /^\d+\./.test(l.trim()))).toHaveLength(9);
    });
    it('the contract quotes the list — and would fail if the two drifted', () => {
        const contract = fs.readFileSync(
            path.join(REPO, 'docs/contracts/ratification-artifact.md'),
            'utf8',
        );
        expect(contract).toContain('## The modification review asks a fixed set');
        // Every question, verbatim. This is the drift guard the quote exists
        // for: a question edited in the constant and not in the contract reds
        // here rather than leaving a prompt and a contract disagreeing.
        for (const q of MODIFICATION_REVIEW_QUESTIONS) {
            expect(contract).toContain(q.text);
        }
        // And the module is named, so a reader can find the single definition.
        expect(contract).toContain(
            'src/scripts/ai_council/modification_review_questions.ts',
        );
    });

    it('SENSITIVITY — the drift guard rejects a contract missing one question', () => {
        const contract = fs.readFileSync(
            path.join(REPO, 'docs/contracts/ratification-artifact.md'),
            'utf8',
        );
        const dropped = MODIFICATION_REVIEW_QUESTIONS[4]!.text;
        expect(contract.replace(dropped, '')).not.toContain(dropped);
    });
});
