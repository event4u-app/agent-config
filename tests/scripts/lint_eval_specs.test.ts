/**
 * lint_eval_specs — the gate on this package's own measurement inputs.
 *
 * Every case below is a MALFORMED INPUT, never a judgement about whether a
 * fixture is good. That boundary is the gate's contract and the tests hold it:
 * a check that graded authorship would produce findings nobody can act on.
 *
 * The accept cases carry as much weight as the reject ones here. Three of the
 * four defect classes were first implemented too eagerly and reported real,
 * correct fixtures as broken — chained derivations read as three separate
 * claims, `^` unparsed so an exponent became a bare operand, and a
 * unit-scaled expectation compared against a derivation working in dollars.
 * Each of those is pinned below as a fixture that must PASS.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    findArithChains,
    findArithDisagreements,
    chainSupportsExpected,
    evaluateSegment,
} from '../../src/scripts/_lib/arith_claims.js';
import { findDuplicateKeys } from '../../src/scripts/_lib/json_duplicate_keys.js';
import { checkSpec, listSpecs, type Finding } from '../../src/scripts/lint_eval_specs.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-eval-specs-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const kinds = (f: Finding[]): string[] => f.map((x) => x.kind).sort();

describe('findDuplicateKeys', () => {
    it('reports BOTH line numbers, because one is not actionable', () => {
        const src = '{\n  "id": "a",\n  "prompt": "p",\n  "id": "b"\n}\n';
        const [d] = findDuplicateKeys(src);
        expect(d?.key).toBe('id');
        expect(d?.firstLine).toBe(2);
        expect(d?.laterLine).toBe(4);
    });

    it('does NOT report the same key in a nested object — that is not a collision', () => {
        expect(findDuplicateKeys('{"a": 1, "b": {"a": 2}}')).toHaveLength(0);
    });

    it('does not confuse a string VALUE that looks like a key', () => {
        expect(findDuplicateKeys('{"a": "b", "c": "a"}')).toHaveLength(0);
    });

    it('does not report array elements as duplicate keys', () => {
        expect(findDuplicateKeys('{"q": [{"x": 1}, {"x": 2}]}')).toHaveLength(0);
    });

    it('an escaped quote inside a value does not desynchronise the scanner', () => {
        expect(findDuplicateKeys('{"a": "he said \\"hi\\"", "b": 1}')).toHaveLength(0);
    });

    it('an unterminated string returns what it has rather than throwing', () => {
        expect(() => findDuplicateKeys('{"a": "unterminated')).not.toThrow();
    });
});

describe('arithmetic claims', () => {
    it('reads a chain as ONE claim, not as one claim per step', () => {
        // `500 x 0.80 = 400` is an intermediate, not an assertion that
        // 0.80 / 0.02 is 400. The first implementation read it the wrong way.
        expect(findArithDisagreements('500 x 0.80 / 0.02 = 400 / 0.02 = 20,000.')).toHaveLength(0);
    });

    it('understands `^` as exponentiation, not as a bare operand', () => {
        expect(
            findArithDisagreements('1.12^3 = 1.404928; 200 / 1.404928 = 142.36 ($M).'),
        ).toHaveLength(0);
    });

    it('tolerates prose rounding to the precision the prose itself writes', () => {
        expect(findArithDisagreements('400,000/300,000 = 1.333 months')).toHaveLength(0);
    });

    it('catches a derivation that disagrees with itself', () => {
        const [d] = findArithDisagreements('4,200,000 / 560,000 = 8.5 months');
        expect(d?.left).toBeCloseTo(7.5, 6);
        expect(d?.right).toBeCloseTo(8.5, 6);
    });

    it('refuses to evaluate prose that is not pure arithmetic', () => {
        expect(evaluateSegment('about 7 months')).toBeNull();
        expect(evaluateSegment('Step 2 discounts each FCFF year')).toBeNull();
    });

    it('reports no chain at all when the rationale only cites a source', () => {
        expect(findArithChains('Standard startup-finance runway definition.')).toHaveLength(0);
        expect(chainSupportsExpected('Standard runway definition.', 7.5, 0)).toBeNull();
    });

    it('accepts a unit-scaled expectation, and the tolerance is bounded', () => {
        // Measured false positive: the derivation works in dollars, the
        // expectation is stated in $M, and nothing in the file says so.
        expect(
            chainSupportsExpected('4,200,000,000 x 0.006 = 25,200,000 = $25.2M.', 25.2, 0.05),
        ).toBe(true);
        // A different mantissa is still rejected — the scale tolerance does not
        // become a licence to agree with any number.
        expect(chainSupportsExpected('4,200,000,000 x 0.006 = 25,200,000.', 31.7, 0.05)).toBe(false);
    });
});

describe('checkSpec', () => {
    it('flags a tool-choice assertion that enforces nothing', () => {
        const src = JSON.stringify({
            skill: 's',
            scenarios: [{ id: 'x', prompt: 'p', assertions: [{ kind: 'tool-choice' }] }],
        });
        expect(kinds(checkSpec('a/evals.json', src, new Set()))).toEqual(['incomplete-grader']);
    });

    it('accepts a tool-choice assertion that names a tool', () => {
        const src = JSON.stringify({
            skill: 's',
            scenarios: [
                { id: 'x', prompt: 'p', assertions: [{ kind: 'tool-choice', must_not_use: ['Bash'] }] },
            ],
        });
        expect(checkSpec('a/evals.json', src, new Set())).toHaveLength(0);
    });

    it('flags a fixture that is not in the git INDEX', () => {
        const src = JSON.stringify({
            skill: 's',
            scenarios: [
                { id: 'x', prompt: 'p', assertions: [{ kind: 'file_exists', path: 'tests/fixtures/gone.json' }] },
            ],
        });
        expect(kinds(checkSpec('a/evals.json', src, new Set()))).toEqual(['untracked-fixture']);
        expect(checkSpec('a/evals.json', src, new Set(['tests/fixtures/gone.json']))).toHaveLength(0);
    });

    it('SKIPS the fixture check when git is unavailable, rather than reporting every path', () => {
        const src = JSON.stringify({
            skill: 's',
            scenarios: [
                { id: 'x', prompt: 'p', assertions: [{ kind: 'file_exists', path: 'tests/fixtures/gone.json' }] },
            ],
        });
        expect(checkSpec('a/evals.json', src, null)).toHaveLength(0);
    });

    it('ignores a run-relative artifact path — the run produces it, so it cannot be tracked', () => {
        const src = JSON.stringify({
            skill: 's',
            scenarios: [
                { id: 'x', prompt: 'p', assertions: [{ kind: 'file_exists', path: 'report.md' }] },
            ],
        });
        expect(checkSpec('a/evals.json', src, new Set())).toHaveLength(0);
    });

    it('flags a declared count the query list contradicts, in both directions', () => {
        const src = JSON.stringify({
            skill: 's',
            description: '3 positives + 2 near-misses.',
            queries: [
                { q: 'a', trigger: true },
                { q: 'b', trigger: false },
                { q: 'c', trigger: false },
            ],
        });
        expect(kinds(checkSpec('a/triggers.json', src, new Set()))).toEqual(['declared-count-mismatch']);
    });

    it('accepts a description whose counts match', () => {
        const src = JSON.stringify({
            skill: 's',
            description: '1 positive + 2 near-misses.',
            queries: [
                { q: 'a', trigger: true },
                { q: 'b', trigger: false },
                { q: 'c', trigger: false },
            ],
        });
        expect(checkSpec('a/triggers.json', src, new Set())).toHaveLength(0);
    });

    it('says nothing about a description that declares no count', () => {
        const src = JSON.stringify({
            skill: 's',
            description: 'Positives cover the two adjacent decision surfaces.',
            queries: [{ q: 'a', trigger: true }],
        });
        expect(checkSpec('a/triggers.json', src, new Set())).toHaveLength(0);
    });

    it('leaves unparseable JSON to the schema validator, but still reports the duplicate key', () => {
        const src = '{\n  "id": "a",\n  "id": "b",\n';
        expect(kinds(checkSpec('a/evals.json', src, new Set()))).toEqual(['duplicate-key']);
    });
});

describe('listSpecs', () => {
    it('collects only files under an evals/ directory', () => {
        const mk = (rel: string, body: string): void => {
            const p = path.join(tmp, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, body, 'utf-8');
        };
        mk('src/skills/a/evals/evals.json', '{}');
        mk('src/skills/a/SKILL.md', '# a');
        mk('src/skills/a/config.json', '{}');
        mk('src/agent-src/commands/evals/x.json', '{}');
        expect(listSpecs(tmp)).toEqual([
            'src/agent-src/commands/evals/x.json',
            'src/skills/a/evals/evals.json',
        ]);
    });
});
