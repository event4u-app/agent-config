/**
 * Terse and expert prompt variants on the artifact corpus, so the
 * 2×2 (vanilla|package × terse|expert) runs from one corpus.
 */
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    expand_prompt_variants,
    load_artifact_corpus,
    parse_artifact_corpus,
    select_corpus,
    validate_artifact_task,
} from '../../internal/bench/core/_lib/bench_artifact_corpus.js';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const CORPUS = path.join(REPO, 'internal', 'bench', 'corpora', 'ab-artifact-v2.yaml');

const base = (variants: unknown): Record<string, unknown> => ({
    id: 't',
    kind: 'artifact',
    family: 'svg',
    fixture: 'f',
    prompt: 'Read BRIEF.md.',
    deliverable: { path: 'out/x.svg', type: 'svg' },
    graders: [{ id: 'g', role: 'primary' }],
    parity_bar: 1,
    network: 'none',
    feedback_ladder: { naive: ['a', 'b', 'c'], informed: ['d', 'e', 'f'] },
    ...(variants === undefined ? {} : { variants }),
});

describe('prompt variants', () => {
    it('a task without variants stays valid', () => {
        expect(validate_artifact_task(base(undefined))).toEqual([]);
    });
    it('needs exactly one terse and one expert entry', () => {
        expect(validate_artifact_task(base([{ prompt_variant: 'terse' }]))).toEqual(['t: variants needs exactly one terse and one expert entry']);
        expect(validate_artifact_task(base([{ prompt_variant: 'terse' }, { prompt_variant: 'loud', prompt: 'x' }]))).toContain('t: unknown prompt_variant "loud"');
    });
    it('terse is the task prompt itself; expert must extend it', () => {
        expect(validate_artifact_task(base([{ prompt_variant: 'terse', prompt: 'other' }, { prompt_variant: 'expert', prompt: 'Read BRIEF.md. More.' }]))).toEqual([
            't: the terse variant is the task prompt and carries no prompt of its own',
        ]);
        expect(validate_artifact_task(base([{ prompt_variant: 'terse' }, { prompt_variant: 'expert', prompt: 'A different and much longer prompt.' }]))).toEqual([
            't: the expert prompt must start with the task prompt and add to it',
        ]);
    });
    it('expands each task once per requested variant, prompt swapped and tagged', () => {
        const [t] = parse_artifact_corpus(
            `tasks:\n  - ${JSON.stringify(base([{ prompt_variant: 'terse' }, { prompt_variant: 'expert', prompt: 'Read BRIEF.md. Check X.' }]))}\n`,
        );
        const out = expand_prompt_variants([t as never], ['terse', 'expert']);
        expect(out.map((x) => [x['prompt_variant'], x['prompt']])).toEqual([
            ['terse', 'Read BRIEF.md.'],
            ['expert', 'Read BRIEF.md. Check X.'],
        ]);
        expect(expand_prompt_variants([t as never], [])).toEqual([t]);
    });
    it('a requested variant on a task without variants is refused', () => {
        expect(() => expand_prompt_variants([base(undefined) as never], ['expert'])).toThrow(/t has no prompt variants/);
    });
    it('--prompt-variant is stripped from argv and parsed; both means terse then expert', () => {
        const [rest, sel] = select_corpus(['--corpus', 'artifact', '--prompt-variant', 'both', '--seeds', '1'], REPO);
        expect(rest).toEqual(['--seeds', '1']);
        expect(sel.prompt_variants).toEqual(['terse', 'expert']);
        expect(select_corpus(['--prompt-variant=expert'], REPO)[1].prompt_variants).toEqual(['expert']);
        expect(select_corpus([], REPO)[1].prompt_variants).toEqual([]);
    });
    it('the shipped corpus carries both variants on every task (nine from 2.1, art-dnd-01 from 2.2)', () => {
        const tasks = load_artifact_corpus(CORPUS);
        expect(tasks).toHaveLength(10);
        expect(expand_prompt_variants(tasks, ['terse', 'expert'])).toHaveLength(20);
    });
});
