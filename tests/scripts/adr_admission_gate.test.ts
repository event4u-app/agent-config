import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { rank, ROOT } from '../../src/scripts/skill_tools/score_skill_relevance.js';

const SKILLS = path.join(ROOT, 'src', 'skills');

function top(task: string, n = 5): string[] {
    return rank(task, SKILLS)
        .slice(0, n)
        .map((r) => r[0]);
}

/**
 * The admission gate's routing half — "fewer ADRs".
 *
 * `road-to-evidence-based-adr-governance` 2.5 named this fixture in its own
 * `verify:` line ("golden test — a reversible threshold change does not route
 * to `adr-create`") and AC-5 restates it as the last of five clauses. The other
 * four are CI-enforced by `check_new_adr_evidence`, `check_adr_frontmatter` and
 * `lint_provenance_vocabulary`; this one had no fixture, so the clause rested on
 * prose alone — the same weakest-honest-reading shape 3.4 was un-ticked for.
 *
 * It is a ROUTING test, not a judgement test. It cannot tell whether a given
 * change is genuinely reversible; it pins that the ranker does not offer the
 * ADR machinery for prompts shaped like the non-ADR list in the skill body
 * (temporary numeric thresholds, benchmark values, reversible local detail).
 */
describe('ADR admission gate — a calibration change does not route to adr-create', () => {
    it('routes a genuine architectural decision TO adr-create', () => {
        // The positive control. Without it, a ranker that returned nothing at
        // all would pass every assertion below.
        expect(top('Capture the decision to switch from MySQL to PostgreSQL as an ADR')).toContain(
            'adr-create',
        );
    });

    it.each([
        ['a kernel budget number', 'raise the kernel budget from 25k to 26k characters'],
        ['a retry timeout', 'bump the retry timeout from 30s to 45s'],
        ['a rate-limit threshold', 'change the rate limit threshold from 100 to 120 requests'],
    ])('does not offer adr-create for %s', (_label, prompt) => {
        // ADR-002 is the reference case the roadmap cites: it encodes 25k->26k
        // and a 4.0k override ceiling as architecture law, and ADR-114 then
        // needed another override. The principle is the ADR; the numbers belong
        // in a versioned budget contract with a regression gate.
        expect(rank(prompt, SKILLS).map((r) => r[0])).not.toContain('adr-create');
    });

    it('the non-ADR list is stated in the skills that own the gate, not only in the roadmap', () => {
        // Cheap fence against the routing above passing for the wrong reason:
        // if the classification prose is deleted, the ranker may still miss
        // adr-create by accident while the gate itself is gone.
        for (const rel of ['adr-create/SKILL.md', 'decision-record/SKILL.md']) {
            const body = fs.readFileSync(path.join(SKILLS, rel), 'utf-8');
            expect(body.toLowerCase(), `${rel} should carry the admission classification`).toMatch(
                /architecturally significant|non-adr|reversible/,
            );
        }
    });
});
