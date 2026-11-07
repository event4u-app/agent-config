/**
 * A roadmap that changed a default asset closes only with the measurement it
 * ran, or one line naming why none was possible. A default asset is what loads
 * in every session: a rule, a skill's catalog entry, CLAUDE.md or AGENTS.md.
 */
import { describe, expect, it } from 'vitest';

import { defaultAssetsChanged, hasMeasurementLine, measurementLineProblem } from '../../src/agent-src/scripts/measurement_line.js';

const roadmap = (...body: string[]): string => ['# Road', '', '## Phase 1 — Go', ...body, ''].join('\n');

describe('defaultAssetsChanged', () => {
    it('finds rule, skill and CLAUDE.md paths named in closed steps', () => {
        const text = roadmap(
            '- [x] **1.1** Shorten `src/rules/ask-when-uncertain.md` to the look-first wording.',
            '- [x] **1.2** Reword the description of src/skills/code-review-lens/SKILL.md',
            '- [x] **1.3** Trim CLAUDE.md',
        );
        expect(defaultAssetsChanged(text)).toEqual([
            'CLAUDE.md',
            'src/rules/ask-when-uncertain.md',
            'src/skills/code-review-lens/SKILL.md',
        ]);
    });
    it('reads the path a step receipt records', () => {
        const text = roadmap('- [x] **1.1** done <!-- receipt: class=R2 · shadow · bound=production code touched: dist/agent-src/rules/scope-control.md -->');
        expect(defaultAssetsChanged(text)).toEqual(['dist/agent-src/rules/scope-control.md']);
    });
    it('ignores open steps, evidence lines outside steps, and non-default paths', () => {
        const text = roadmap(
            'Evidence (read): `src/rules/scope-control.md:12`',
            '- [ ] **1.1** Change `src/rules/direct-answers.md`',
            '- [x] **1.2** Add `src/scripts/check_x.ts` and `src/skills/foo/references/a.md`',
        );
        expect(defaultAssetsChanged(text)).toEqual([]);
    });
    it('reads a continuation line of a closed step', () => {
        const text = roadmap('- [x] **1.1** Look-first wording', '  in `src/rules/ask-when-uncertain.md`, measured first.');
        expect(defaultAssetsChanged(text)).toEqual(['src/rules/ask-when-uncertain.md']);
    });
});

describe('hasMeasurementLine', () => {
    it('accepts a body line or a frontmatter key, with a measurement or a reason', () => {
        expect(hasMeasurementLine(roadmap('**Measurement:** report `internal/bench/reports/x.json`'))).toBe(true);
        expect(hasMeasurementLine(roadmap('Measurement: none possible — the rule only changes wording no task scores'))).toBe(true);
        expect(hasMeasurementLine(['---', 'measurement: docs/benchmark.md § X', '---', '# Road'].join('\n'))).toBe(true);
    });
    it('refuses an empty line', () => {
        expect(hasMeasurementLine(roadmap('Measurement:'))).toBe(false);
        expect(hasMeasurementLine(roadmap('- [x] nothing measured'))).toBe(false);
    });
});

describe('measurementLineProblem', () => {
    it('names the assets when a roadmap changed one and carries no line', () => {
        const p = measurementLineProblem(roadmap('- [x] **1.1** Trim `src/rules/scope-control.md`'));
        expect(p).toContain('src/rules/scope-control.md');
        expect(p).toContain('Measurement:');
    });
    it('is silent when nothing default changed, or the line is there', () => {
        expect(measurementLineProblem(roadmap('- [x] **1.1** Add a test'))).toBeNull();
        expect(measurementLineProblem(roadmap('- [x] **1.1** Trim `src/rules/scope-control.md`', '', 'Measurement: none possible — wording only'))).toBeNull();
    });
});
