import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { check, resolveUri, STATUSES, STATUS_RULES } from '../../src/scripts/check_score_contract';

const SCORECARD = path.join('agents', 'evidence', 'ac-capability-scorecard.yaml');
const TWINS = path.join('tests', 'fixtures', 'score-contract', 'twins');

const codes = (rel: string): string[] => check(rel).map((f) => f.code);

describe('the seeded scorecard is green', () => {
    it('exits clean — 23 recovered rows, no findings', () => {
        expect(check(SCORECARD)).toEqual([]);
    });

    it('declares its own incompleteness rather than 32 rows', () => {
        const text = fs.readFileSync(SCORECARD, 'utf8');
        expect(text).toContain('state: incomplete');
        expect(text).toContain('authority: unavailable-external-review');
        // 23 + 9 = 32. Guessing the nine would be the defect this asserts against.
        expect(text).toContain('recovered_category_count: 23');
        expect(text).toContain('missing_category_count: 9');
    });
});

describe('each twin reds on its own finding and nothing else', () => {
    // Step 1.1's four controls, plus the two the council added.
    const table: ReadonlyArray<readonly [string, string]> = [
        ['a-ten-with-empty-class', 'class_rule'],
        ['b-stale-pin', 'unresolvable_evidence'],
        ['c-fixture-as-production', 'fixture_in_production_class'],
        ['d-unresolvable-path', 'unresolvable_evidence'],
        ['e-false-completeness', 'false_completeness'],
        ['f-max-boundary-no-constraint', 'class_rule'],
    ];

    for (const [name, code] of table) {
        it(`${name} → exactly one ${code}`, () => {
            const got = codes(path.join(TWINS, `${name}.yaml`));
            expect(got, `${name} must produce exactly one finding`).toEqual([code]);
        });
    }

    it('every twin file in the directory is covered by the table above', () => {
        const onDisk = fs
            .readdirSync(TWINS)
            .filter((f) => f.endsWith('.yaml'))
            .map((f) => f.replace(/\.yaml$/, ''))
            .sort();
        expect(onDisk).toEqual(table.map(([n]) => n).sort());
    });
});

describe('the class rule', () => {
    it('covers every legal status, with no status left unruled', () => {
        expect(Object.keys(STATUS_RULES).sort()).toEqual([...STATUSES].sort());
    });

    it('forbids a standing_constraint on every status except max-boundary', () => {
        for (const s of STATUSES) {
            const rule = STATUS_RULES[s];
            if (s === 'max-boundary') {
                expect(rule.require).toContain('standing_constraint');
            } else {
                expect(rule.forbid, `${s} must forbid standing_constraint`).toContain('standing_constraint');
            }
        }
    });

    it('a seeded missing-* row needs no reason field — the status IS the reason', () => {
        // The contradiction the council resolved: 0.2 read literally would have
        // failed every row 0.1 creates.
        for (const s of ['missing-mechanism', 'missing-adoption', 'missing-proof'] as const) {
            expect(STATUS_RULES[s].require).not.toContain('production_window');
            expect(STATUS_RULES[s].require).not.toContain('standing_constraint');
        }
    });

    it('missing-adoption asserts mechanism evidence exists — statuses are ordered claims', () => {
        expect(STATUS_RULES['missing-adoption'].require).toContain('mechanism_evidence');
        expect(STATUS_RULES['missing-adoption'].forbid).toContain('adoption_evidence');
    });
});

describe('the evidence-URI grammar', () => {
    it('resolves an existing repo path, with and without a line', () => {
        expect(resolveUri('src/scripts/check_score_contract.ts')).toBeNull();
        expect(resolveUri('src/scripts/check_score_contract.ts:1')).toBeNull();
    });

    it('rejects a path that does not exist and one that escapes the repo', () => {
        expect(resolveUri('src/scripts/nope.ts')).toMatch(/does not exist/);
        expect(resolveUri('../outside.ts')).toMatch(/repo-relative/);
        expect(resolveUri('/etc/passwd')).toMatch(/repo-relative/);
    });

    it('checks a #substring against the file contents', () => {
        expect(resolveUri('src/scripts/check_score_contract.ts#STATUS_RULES')).toBeNull();
        expect(resolveUri('src/scripts/check_score_contract.ts#not-in-this-file-xyz')).toMatch(/does not contain/);
    });

    it('requires a dated stamp on an external cite, and never fetches', () => {
        expect(resolveUri('https://example.com/report (2026-08-24)')).toBeNull();
        expect(resolveUri('https://example.com/report')).toMatch(/no \(YYYY-MM-DD\) stamp/);
    });
});

describe('quality is never judged — the contract that keeps this a gate', () => {
    const source = fs.readFileSync(path.join('src', 'scripts', 'check_score_contract.ts'), 'utf8');

    it('the verifier applies no threshold to any outcome-quality field', () => {
        // Step 1.2's verify, mechanised: a comparison operator against a
        // quality-shaped field name would be a judgement behind a gate.
        const quality = /(quality|score|rating|grade|confidence)\w*\s*[<>]=?|[<>]=?\s*\w*(quality|rating|grade)/i;
        const offending = source
            .split('\n')
            .map((l, i) => [i + 1, l] as const)
            .filter(([, l]) => quality.test(l) && !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'));
        expect(offending).toEqual([]);
    });

    it('says so on the green path, so a reader is not left to assume it', () => {
        expect(source).toContain('quality is NOT judged here');
    });
});

describe('the gate refuses a row outside the declared manifest', () => {
    /** Copy the real scorecard and mutate it — never touches the tracked tree. */
    const mutated = (edit: (text: string) => string): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'score-contract-'));
        const rel = path.join(dir, 'scorecard.yaml');
        fs.writeFileSync(rel, edit(fs.readFileSync(SCORECARD, 'utf8')), 'utf8');
        return rel;
    };

    it('an extra row without a matching count bump is a row_count_mismatch', () => {
        const rel = mutated(
            (t) =>
                `${t}  - category: invented-category\n    baseline: 1.0\n    claim: "x"\n` +
                `    closing_path: "x"\n    mechanism_evidence: []\n    adoption_evidence: []\n` +
                `    negative_control_evidence: []\n    production_window: null\n` +
                `    outcome_evidence: []\n    non_regression_evidence: []\n    status: missing-mechanism\n`,
        );
        expect(check(rel).map((f) => f.code)).toContain('row_count_mismatch');
    });

    it('an arithmetic that does not add up is refused', () => {
        const rel = mutated((t) => t.replace('missing_category_count: 9', 'missing_category_count: 4'));
        expect(check(rel).map((f) => f.code)).toContain('bad_arithmetic');
    });

    it('a row named in excluded_from_manifest is refused', () => {
        const rel = mutated((t) => t.replace('category: security', 'category: runtime-simplicity'));
        expect(check(rel).map((f) => f.code)).toContain('excluded_row_present');
    });
});

describe('Phase 2 binding — companion roadmaps cite rows, never write status', () => {
    const COMPANIONS = [
        path.join('agents', 'roadmaps', 'road-to-ten-across-the-board.md'),
        path.join('agents', 'roadmaps', 'road-to-score-contract.md'),
    ];

    const declaredIds = (): Set<string> => {
        const text = fs.readFileSync(SCORECARD, 'utf8');
        return new Set([...text.matchAll(/^\s*- category:\s*(\S+)/gm)].map((m) => m[1] as string));
    };

    it('every category id cited in a companion resolves to a row', () => {
        const ids = declaredIds();
        expect(ids.size).toBe(23);
        const excluded = new Set(['runtime-simplicity', 'host-portability']);
        for (const rel of COMPANIONS) {
            const body = fs.readFileSync(rel, 'utf8');
            // Only backticked kebab tokens that look like a row id are candidates;
            // a bare English phrase is prose, not a citation.
            const cited = [...body.matchAll(/`([a-z][a-z0-9]*(?:-[a-z0-9]+){1,5})`/g)].map((m) => m[1] as string);
            const rowish = cited.filter((c) => ids.has(c) || excluded.has(c));
            expect(rowish.length, `${rel} must cite at least one row id`).toBeGreaterThan(0);
            for (const c of rowish) {
                expect(ids.has(c) || excluded.has(c), `${rel} cites unknown row \`${c}\``).toBe(true);
            }
        }
    });

    it('no roadmap step writes a status: value — the gate is the only authority', () => {
        for (const rel of COMPANIONS) {
            const lines = fs.readFileSync(rel, 'utf8').split('\n');
            const offending = lines
                .map((l, i) => [i + 1, l] as const)
                // A checkbox line, or its indented continuation, assigning a status.
                .filter(([, l]) => /^\s*(- \[[ x~-]\]\s+)?.*\bstatus:\s*(ten|measured-null|max-boundary|missing-)/.test(l))
                // Prose ABOUT the rule is allowed; an assignment is not. The
                // discriminator is a backtick-quoted mention vs a bare one.
                .filter(([, l]) => !/`[^`]*status:[^`]*`/.test(l) && !/\*\*/.test(l));
            expect(offending, `${rel} must not assign a scorecard status`).toEqual([]);
        }
    });

    it('the two excluded floors are named as excluded, not as rows', () => {
        const text = fs.readFileSync(SCORECARD, 'utf8');
        expect(text).toContain('excluded_from_manifest');
        for (const id of ['runtime-simplicity', 'host-portability']) {
            expect(text).toContain(`    - ${id}`);
            expect(text).not.toContain(`- category: ${id}`);
        }
    });
});
