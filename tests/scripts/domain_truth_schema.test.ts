/**
 * domain-truth.schema.json (road-to-domain-soundness Phase 1).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCHEMA = JSON.parse(
    fs.readFileSync(path.join(REPO, 'src', 'scripts', 'schemas', 'domain-truth.schema.json'), 'utf-8'),
);

function validator() {
    return new Ajv({ allErrors: true }).compile(SCHEMA);
}

describe('domain-truth.schema.json', () => {
    it('compiles', () => {
        expect(() => validator()).not.toThrow();
    });

    it('accepts a deterministic case with a sourced key', () => {
        const v = validator();
        expect(
            v({
                skill: 'runway-cognition',
                domain: 'finance',
                cases: [
                    {
                        id: 'flat-burn',
                        scenario: 'Cash 1,200,000; net burn 100,000/mo, flat.',
                        source: 'Runway = cash / net monthly burn (standard definition).',
                        check: {
                            kind: 'deterministic',
                            expected: 12,
                            tolerance: 0,
                            rationale: '1,200,000 / 100,000 = 12 months.',
                        },
                    },
                ],
            }),
        ).toBe(true);
    });

    it('accepts a rubric case naming a practice', () => {
        const v = validator();
        expect(
            v({
                skill: 'incident-commander',
                domain: 'ops',
                cases: [
                    {
                        id: 'sev1-roles',
                        scenario: 'A SEV1 outage just paged.',
                        source: 'ICS / Google SRE incident-command roles.',
                        check: {
                            kind: 'rubric',
                            criterion: 'Assigns IC / comms / ops-lead roles matching the ICS practice.',
                        },
                    },
                ],
            }),
        ).toBe(true);
    });

    it('rejects a case missing the sourced basis', () => {
        const v = validator();
        expect(
            v({
                skill: 'dcf-modeling',
                domain: 'finance',
                cases: [
                    {
                        id: 'no-source',
                        scenario: 'Value these cash flows.',
                        check: { kind: 'deterministic', expected: 100, rationale: 'x' },
                    },
                ],
            }),
        ).toBe(false);
    });

    it('rejects an unknown domain and an unknown check kind', () => {
        const v = validator();
        expect(
            v({ skill: 'x', domain: 'legal', cases: [{ id: 'a', scenario: 's', source: 'y', check: { kind: 'rubric', criterion: 'c' } }] }),
        ).toBe(false);
        expect(
            v({ skill: 'x', domain: 'finance', cases: [{ id: 'a', scenario: 's', source: 'y', check: { kind: 'magic' } }] }),
        ).toBe(false);
    });
});
