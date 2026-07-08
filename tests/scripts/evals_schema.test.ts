/**
 * evals.json behavioural-eval schema (road-to-skill-eval-coverage Phase 1).
 * Every shipped evals.json validates; the assertion kinds match the grader.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCHEMA = JSON.parse(
    fs.readFileSync(path.join(REPO, 'src', 'scripts', 'schemas', 'evals.schema.json'), 'utf-8'),
);

function makeValidator() {
    const ajv = new Ajv({ allErrors: true });
    return ajv.compile(SCHEMA);
}

describe('evals.schema.json', () => {
    it('compiles', () => {
        expect(() => makeValidator()).not.toThrow();
    });

    it('every shipped src/skills/*/evals/evals.json validates', () => {
        const validate = makeValidator();
        const skillsDir = path.join(REPO, 'src', 'skills');
        const shipped: string[] = [];
        for (const name of fs.readdirSync(skillsDir)) {
            const f = path.join(skillsDir, name, 'evals', 'evals.json');
            if (fs.existsSync(f)) shipped.push(f);
        }
        expect(shipped.length).toBeGreaterThanOrEqual(2); // bug-analyzer + code-review
        for (const f of shipped) {
            const spec = JSON.parse(fs.readFileSync(f, 'utf-8'));
            const ok = validate(spec);
            if (!ok) {
                throw new Error(`${f} failed schema: ${JSON.stringify(validate.errors)}`);
            }
            expect(ok).toBe(true);
        }
    });

    it('accepts each deterministic assertion kind', () => {
        const validate = makeValidator();
        const spec = {
            skill: 'demo-skill',
            scenarios: [
                {
                    id: 'case-1',
                    prompt: 'do a thing',
                    assertions: [
                        { kind: 'contains', value: 'root cause' },
                        { kind: 'file_exists', path: 'out.md' },
                        { kind: 'finding_floor', n: 2, pattern: '(?m)^- ' },
                        { kind: 'rubric', criterion: 'the answer is actionable' },
                    ],
                },
            ],
        };
        expect(validate(spec)).toBe(true);
    });

    it('rejects an unknown assertion kind and a bad skill slug', () => {
        const validate = makeValidator();
        expect(
            validate({
                skill: 'x',
                scenarios: [{ id: 'a', prompt: 'p', assertions: [{ kind: 'magic', value: 'y' }] }],
            }),
        ).toBe(false);
        expect(
            validate({ skill: 'Bad_Slug', scenarios: [{ id: 'a', prompt: 'p', assertions: [] }] }),
        ).toBe(false);
    });

    it('accepts an optional skill_body_sha and rejects a malformed one', () => {
        const validate = makeValidator();
        const base = { skill: 'x', scenarios: [{ id: 'a', prompt: 'p', assertions: [{ kind: 'contains', value: 'z' }] }] };
        expect(validate({ ...base, skill_body_sha: 'f'.repeat(64) })).toBe(true);
        expect(validate({ ...base, skill_body_sha: 'nope' })).toBe(false);
    });
});
