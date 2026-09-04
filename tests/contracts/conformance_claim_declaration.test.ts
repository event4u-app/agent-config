/**
 * A skill or rule claiming standard conformance names its resolver, or declares
 * the gap.
 *
 * road-to-defect-population-sweeps 3.1/3.2. The defect class: an artefact
 * ASSERTS a checkable property it does not satisfy. One release produced four
 * instances and exactly ONE got a resolver
 * (`accessibility_wcag_version_claim.test.ts`); the other three got prose.
 *
 * WHY A TEST AND NOT A `lint_*` GATE. AC-4 says "ratcheted gate" and step 3.2
 * says "reds the gate". Council 2026-09-04 (anthropic + openai, 1 round, quorum
 * 2/2, $0.0342) was UNANIMOUS that the ratchet is the load-bearing property and
 * "gate" names the function rather than the script kind. The measured
 * population is TWO artefacts; a gate script would owe a gate-coverage row, a
 * `--self-test` and a minimum-scan floor, and would land in a
 * `check-gate-completeness` count already red on main. The sibling resolver in
 * this exact class made the same call for the same reason and wrote it down.
 *
 * WHY THE DETECTOR REQUIRES A CONFORMANCE LEVEL. `WCAG 2.2 AA` is a claim about
 * this artefact; `RFC 9457`, `NIST SP 800-53` and "the WCAG 2.1 contrast ratio"
 * are references to someone else's document. The LEVEL token is what separates
 * them, and dropping it takes the population from 2 to 8 by pulling in six
 * citations. The roadmap's own Risk Register warns this phase sits one
 * generalisation step from a global semantic-consistency registry that two
 * reviewers rejected; the level requirement is where that line is drawn.
 *
 * WHAT THIS DOES NOT CHECK: whether the claim is TRUE. That is the resolver's
 * job — `accessibility_wcag_version_claim.test.ts` reads the criteria and
 * verifies them. This test checks only that a resolver is NAMED or a gap is
 * DECLARED, which is the `lint_rule_enforcement_declaration` shape the roadmap
 * names as the precedent for the general form.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE = path.join(REPO_ROOT, 'src/config/conformance-claim-baseline.json');

/**
 * A self-conformance claim: a named standard, a version, and a conformance
 * LEVEL. The standard set is an explicit registry — widening it is a deliberate
 * edit, never an emergent behaviour of the regex.
 */
export const CONFORMANCE_CLAIM = /\b(WCAG|EN\s*301\s*549|Section\s*508)\s+(\d+(?:\.\d+)*)\s+(AAA|AA|A)\b/;

/** Artefacts in scope: the ones step 3.1 names, which are the ones with frontmatter. */
export function scannedFiles(root: string): string[] {
    const out: string[] = [];
    const skills = path.join(root, 'src/skills');
    if (fs.existsSync(skills)) {
        for (const d of fs.readdirSync(skills, { withFileTypes: true })) {
            if (!d.isDirectory()) continue;
            const f = path.join(skills, d.name, 'SKILL.md');
            if (fs.existsSync(f)) out.push(path.relative(root, f));
        }
    }
    const rules = path.join(root, 'src/rules');
    if (fs.existsSync(rules)) {
        for (const f of fs.readdirSync(rules)) {
            if (f.endsWith('.md')) out.push(path.relative(root, path.join(rules, f)));
        }
    }
    return out.sort();
}

/** True when the frontmatter carries a non-empty `enforced_by:` list. */
export function declaresResolver(text: string): boolean {
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (!fm) return false;
    return /^enforced_by:\s*\n(\s+-\s+\S)/m.test(fm[1] as string);
}

/** Every scanned artefact that makes a conformance claim without declaring anything. */
export function undeclaredClaims(root: string): string[] {
    return scannedFiles(root).filter((rel) => {
        const text = fs.readFileSync(path.join(root, rel), 'utf8');
        return CONFORMANCE_CLAIM.test(text) && !declaresResolver(text);
    });
}

describe('a standard-conformance claim names its resolver or declares its gap', () => {
    const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as {
        count: number;
        undeclared: string[];
    };

    it('the scan is not vacuous — a path drift must not turn this file green', () => {
        // Every assertion below is trivially true over an empty scan set. This
        // is the minimum-scan floor a gate script would owe, kept because the
        // obligation does not disappear with the script kind.
        const files = scannedFiles(REPO_ROOT);
        expect(files.length, 'no skills or rules were scanned').toBeGreaterThan(200);
        expect(
            files.some((f) => CONFORMANCE_CLAIM.test(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'))),
            'no artefact matched the claim detector at all — the detector or the corpus drifted',
        ).toBe(true);
    });

    it('no artefact outside the baseline makes an undeclared conformance claim', () => {
        const offenders = undeclaredClaims(REPO_ROOT).filter(
            (f) => !baseline.undeclared.includes(f),
        );
        expect(
            offenders,
            'a skill or rule claims standard conformance with no `enforced_by:` — name the ' +
                'resolver with `test:<path>`, or declare the gap with `instruction-only: <reason>`',
        ).toEqual([]);
    });

    it('the baseline may only shrink — every entry still exists and is still undeclared', () => {
        const live = undeclaredClaims(REPO_ROOT);
        const stale = baseline.undeclared.filter((f) => !live.includes(f));
        expect(
            stale,
            'a baseline entry gained a declaration or vanished — remove it in the same change',
        ).toEqual([]);
    });

    it('the baseline count matches its own list', () => {
        expect(baseline.count).toBe(baseline.undeclared.length);
    });

    it('is sensitive — a planted undeclared claim is reported, and the baseline is unchanged', () => {
        const before = baseline.count;
        const planted = '---\nname: planted\n---\n\nAudited against WCAG 2.2 AA throughout.\n';
        expect(CONFORMANCE_CLAIM.test(planted)).toBe(true);
        expect(declaresResolver(planted), 'a claim with no enforced_by must not read as declared').toBe(
            false,
        );
        // Both directions in one test, as step 3.1 requires: the same content
        // PASSES once it names a resolver, and once it declares the gap.
        const withResolver =
            '---\nname: planted\nenforced_by:\n  - "test:tests/contracts/x.test.ts"\n---\n\nAudited against WCAG 2.2 AA.\n';
        expect(declaresResolver(withResolver)).toBe(true);
        const withGap =
            '---\nname: planted\nenforced_by:\n  - "instruction-only: no resolver exists yet"\n---\n\nAudited against WCAG 2.2 AA.\n';
        expect(declaresResolver(withGap)).toBe(true);
        expect(baseline.count, 'a planted claim must never move the baseline').toBe(before);
    });

    it('does NOT fire on a citation — a reference is not a self-conformance claim', () => {
        for (const citation of [
            'error shape (RFC 9457), idempotency, async ops',
            '**NIST SP 800-53 AC family** — AC-3 Access Enforcement',
            'computes the WCAG 2.1 contrast ratio between two colours',
            'a WCAG 1.4.1 failure — see `accessibility-auditor`',
        ]) {
            expect(CONFORMANCE_CLAIM.test(citation), `over-matched a citation: ${citation}`).toBe(false);
        }
    });
});
