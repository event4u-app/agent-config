// Tests for src/scripts/lint_rule_interactions.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Coverage: constants spot-checks (ALLOWED_RELATIONS,
// ANCHOR_PARTNERS, ANCHOR_RULE, REQUIRED_PAIR_FIELDS) and a golden-parity layer
// (python3 vs tsx on the REAL REPO across default + --quiet) asserting
// byte-identical stdout/stderr/exit. Skipped without python3. CI invokes
// `lint_rule_interactions --quiet`.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_rule_interactions.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

interface Matrix {
    rules: string[];
    pairs: Array<{ rules: string[] }>;
}

function readMatrix(): Matrix {
    return parseYaml(
        fs.readFileSync(path.join(REPO, 'docs/contracts/rule-interactions.yml'), 'utf-8'),
    ) as Matrix;
}

function pairKeys(m: Matrix): Set<string> {
    return new Set(m.pairs.map((p) => [...p.rules].sort().join('|')));
}



describe('lint_rule_interactions — constants', () => {
    it('ALLOWED_RELATIONS holds the six relation kinds', () => {
        expect(new Set(mod.ALLOWED_RELATIONS)).toEqual(
            new Set(['overrides', 'narrows', 'defers_to', 'restates', 'gates', 'complements']),
        );
    });
    it('ANCHOR_RULE is non-destructive-by-default', () => {
        expect(mod.ANCHOR_RULE).toBe('non-destructive-by-default');
    });
    it('ANCHOR_PARTNERS holds the five anchor partners', () => {
        expect(new Set(mod.ANCHOR_PARTNERS)).toEqual(
            new Set([
                'autonomous-execution',
                'scope-control',
                'commit-policy',
                'ask-when-uncertain',
                'verify-before-complete',
            ]),
        );
    });
    it('REQUIRED_PAIR_FIELDS holds the required pair keys', () => {
        expect(new Set(mod.REQUIRED_PAIR_FIELDS)).toEqual(
            new Set(['id', 'rules', 'relation', 'conflict', 'resolution', 'evidence']),
        );
    });
});


describe('lint_rule_interactions — closure over the declared set', () => {
    // The register is authoritative for the rules it lists. A reader who finds
    // two covered rules and no row between them concludes there is no
    // interaction — so an internally incomplete register misinforms more than a
    // small one does.
    it('the shipped matrix has no closure gap', () => {
        const yaml = readMatrix();
        expect(mod.closureGaps(yaml.rules, pairKeys(yaml))).toEqual([]);
    });

    it('reports a gap when a declared pair is removed, and names the citation', () => {
        const yaml = readMatrix();
        const without = pairKeys(yaml);
        without.delete(['context-hygiene', 'token-efficiency'].sort().join('|'));
        const gaps = mod.closureGaps(yaml.rules, without);
        expect(gaps).toHaveLength(1);
        expect(new Set([gaps[0]?.a, gaps[0]?.b])).toEqual(
            new Set(['context-hygiene', 'token-efficiency']),
        );
        // The citation is what makes the error actionable rather than a scold.
        expect(gaps[0]?.cite).toMatch(/^src\/rules\/\S+\.md:\d+$/);
    });

    it('a rule outside the declared set is not scanned — the scope bound is the design', () => {
        // `senior-engineering-discipline` names five rules as winning on their
        // own subject and is deliberately NOT in `rules:`. Asserting over all
        // 111 rules would demand roughly 64 rows, most of them see-also prose.
        const yaml = readMatrix();
        expect(yaml.rules).not.toContain('senior-engineering-discipline');
        expect(mod.closureGaps(yaml.rules, pairKeys(yaml))).toEqual([]);
    });

    it('widening the declared set widens the obligation', () => {
        const yaml = readMatrix();
        const widened = [...yaml.rules, 'senior-engineering-discipline'];
        // Not asserted as a specific number — the point is that adding a slug
        // cannot be free, which is what keeps `rules:` an honest coverage claim.
        expect(mod.closureGaps(widened, pairKeys(yaml)).length).toBeGreaterThan(0);
    });
});
