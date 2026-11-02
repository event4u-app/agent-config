// `Do NOT` stage 1 (road-to-slices-at-agreed-seams step 3.3): a `## Do NOT`
// section listing only prohibitions earns an info-level hint, never an error or
// a warning — the status and the exit code must not move.
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { lint_do_not_pairing } from '../../src/scripts/_lib/skill_sections.js';
import { compute_exit_code, lint_file } from '../../src/scripts/skill_linter.js';

// The fixtures are flat `<name>.md` files, not `<name>/SKILL.md`: a file named
// SKILL.md anywhere in the tree counts as a new skill to lint_new_skill_gate.
const FIXTURES = path.resolve(import.meta.dirname, '..', 'fixtures', 'skill-linter');

describe('Do NOT pairing hint', () => {
    it('emits an info hint for a Do NOT section with no paired alternative', () => {
        const result = lint_file(path.join(FIXTURES, 'do-not-unpaired.md'));
        const hints = result.issues.filter((i) => i.code === 'do_not_unpaired');
        expect(hints).toHaveLength(1);
        expect(hints[0]?.severity).toBe('info');
    });

    it('stays additive — no error, no status change, no exit-code change', () => {
        const result = lint_file(path.join(FIXTURES, 'do-not-unpaired.md'));
        expect(result.issues.some((i) => i.severity === 'error')).toBe(false);
        const withoutHint = { ...result, issues: result.issues.filter((i) => i.code !== 'do_not_unpaired') };
        expect(compute_exit_code([result], true)).toBe(compute_exit_code([withoutHint], true));
    });

    it('is silent once one bullet names the alternative', () => {
        const result = lint_file(path.join(FIXTURES, 'do-not-paired.md'));
        expect(result.issues.some((i) => i.code === 'do_not_unpaired')).toBe(false);
    });

    it.each([
        ['an arrow', '* Do NOT hand-edit dist → edit src/'],
        ['"instead"', '* Do NOT guess; ask instead'],
        ['"prefer"', '* Do NOT inline SQL — prefer the query builder'],
    ])('counts %s as a pairing', (_label, bullet) => {
        expect(lint_do_not_pairing(`## Do NOT\n\n${bullet}\n`)).toEqual([]);
    });

    it('is silent when there is no Do NOT section or it has no bullets', () => {
        expect(lint_do_not_pairing('## Procedure\n\n1. x\n')).toEqual([]);
        expect(lint_do_not_pairing('## Do NOT\n\nProse only.\n')).toEqual([]);
    });
});
