import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { lintProcedure, main, parseExit } from '../../src/scripts/lint_skill_procedures.js';

let root: string;
let skill: string;

const CHECKS = new Set(['report-has-verdict']);

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'procs-'));
    skill = path.join(root, 'src', 'skills', 'demo');
    fs.mkdirSync(path.join(skill, 'references', 'steps'), { recursive: true });
    fs.writeFileSync(path.join(skill, 'references', 'steps', 'one.md'), '# One\n');
    fs.writeFileSync(path.join(skill, 'references', 'steps', 'two.md'), '# Two\n');
    fs.writeFileSync(path.join(skill, 'references', 'report.schema.json'), '{"$id":"report"}\n');
    fs.writeFileSync(
        path.join(skill, 'SKILL.md'),
        '# Demo\n\n## Procedure\n\n| Step | File |\n|---|---|\n| one | [one](references/steps/one.md) |\n| two | [two](references/steps/two.md) |\n',
    );
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function manifest(stepsYaml: string, extra = ''): string {
    return [
        'schema_version: 1',
        'brief:',
        '  goal: Audit the thing',
        '  inputs: [a target path]',
        '  done_when: the report exists',
        extra,
        'steps:',
        stepsYaml,
    ].join('\n');
}

const GOOD_STEPS = [
    '  - id: one',
    '    file: references/steps/one.md',
    '    exit: "exists: agents/evidence/report.md"',
    '  - id: two',
    '    file: references/steps/two.md',
    '    exit: judgement',
    '    when: "file-exists: package.json"',
].join('\n');

describe('lint_skill_procedures', () => {
    it('accepts a well-formed sidecar and reports the judgement share', () => {
        const r = lintProcedure(skill, manifest(GOOD_STEPS), CHECKS);
        expect(r.errors).toEqual([]);
        expect(r.steps).toBe(2);
        expect(r.judgement).toBe(1);
    });

    it('rejects-skill-field: a step naming another skill is the chain the DAG lock rejects', () => {
        const steps = GOOD_STEPS.replace('    exit: judgement', '    exit: judgement\n    skill: design-review');
        const r = lintProcedure(skill, manifest(steps), CHECKS);
        expect(r.errors.join('\n')).toMatch(/unknown key 'skill'/);
    });

    it('rejects an unknown top-level key', () => {
        const r = lintProcedure(skill, manifest(GOOD_STEPS, 'next: other-skill'), CHECKS);
        expect(r.errors.join('\n')).toMatch(/unknown key 'next'/);
    });

    it('rejects-command-string-exit: an exit is typed, never a command', () => {
        for (const bad of ['npm test', 'check: rm -rf /', 'exists: ../../etc/passwd', 'schema: nope.json', 'check: unregistered-id']) {
            expect(parseExit(bad, skill, CHECKS).error, bad).toBeDefined();
        }
        const steps = GOOD_STEPS.replace('exit: judgement', 'exit: "npm test"');
        expect(lintProcedure(skill, manifest(steps), CHECKS).errors.join('\n')).toMatch(/exit/);
    });

    it('accepts the four exit kinds', () => {
        expect(parseExit('exists: out/report.md', skill, CHECKS).error).toBeUndefined();
        expect(parseExit('schema: references/report.schema.json#report', skill, CHECKS).error).toBeUndefined();
        expect(parseExit('check: report-has-verdict', skill, CHECKS).error).toBeUndefined();
        expect(parseExit('judgement', skill, CHECKS).error).toBeUndefined();
    });

    it('unknown-when-predicate is refused', () => {
        const steps = GOOD_STEPS.replace('file-exists: package.json', 'shell: test -f x');
        expect(lintProcedure(skill, manifest(steps), CHECKS).errors.join('\n')).toMatch(/when/);
    });

    it('a step file must exist under references/steps/, be linked from the head, and not escape', () => {
        const missing = GOOD_STEPS.replace('references/steps/two.md', 'references/steps/three.md');
        expect(lintProcedure(skill, manifest(missing), CHECKS).errors.join('\n')).toMatch(/three\.md/);
        const escape = GOOD_STEPS.replace('references/steps/two.md', 'references/steps/../../../x.md');
        expect(lintProcedure(skill, manifest(escape), CHECKS).errors.join('\n')).toMatch(/references\/steps/);
        fs.writeFileSync(path.join(skill, 'SKILL.md'), '# Demo\n\n[one](references/steps/one.md)\n');
        expect(lintProcedure(skill, manifest(GOOD_STEPS), CHECKS).errors.join('\n')).toMatch(/not linked from SKILL\.md/);
    });

    it('ids are unique', () => {
        const dup = GOOD_STEPS.replace('id: two', 'id: one');
        expect(lintProcedure(skill, manifest(dup), CHECKS).errors.join('\n')).toMatch(/duplicate/);
    });

    it('main fails on a bad sidecar and passes a tree with none', () => {
        const quiet = (fn: () => number): number => {
            const orig = process.stdout.write.bind(process.stdout);
            (process.stdout as { write: unknown }).write = (): boolean => true;
            try {
                return fn();
            } finally {
                process.stdout.write = orig;
            }
        };
        expect(quiet(() => main([], root))).toBe(0);
        fs.writeFileSync(path.join(skill, 'procedure.yaml'), manifest(GOOD_STEPS.replace('exit: judgement', 'exit: "make it"')));
        expect(quiet(() => main([], root))).toBe(1);
    });
});
