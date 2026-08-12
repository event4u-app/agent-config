/**
 * `fe_design_triggers` — coherence between what fe-design SAYS it owns and
 * what its trigger evals ROUTE to it.
 *
 * This is a structural test over two artefacts, not a model evaluation: it
 * cannot say whether a live model would pick the skill (the live trigger eval
 * is human-gated and hard-aborts under automation). What it can catch is the
 * defect that produced the symptom — a SKILL.md declaring itself the owner of
 * ad-hoc UI implementation while its own eval set labels every implementation
 * prompt `trigger: false`, routing those prompts to nobody at all.
 *
 * The two halves must agree. If a future edit reverts the skill to
 * reference-only, this test fails and points at the eval set that still claims
 * otherwise — and vice versa.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SKILL_DIR = path.join(REPO_ROOT, 'src', 'skills', 'fe-design');
const SKILL_MD = path.join(SKILL_DIR, 'SKILL.md');
const EVALS = path.join(SKILL_DIR, 'evals', 'triggers.json');

interface TriggerQuery {
    q: string;
    trigger: boolean;
}
interface TriggerSet {
    skill: string;
    last_eval: string;
    description: string;
    queries: TriggerQuery[];
}

const evals = JSON.parse(fs.readFileSync(EVALS, 'utf-8')) as TriggerSet;
const skillBody = fs.readFileSync(SKILL_MD, 'utf-8');

/** Words that mark a prompt as asking for a UI to be built or changed. */
const IMPLEMENTATION_VERBS = ['implement', 'build', 'improve'];

function isImplementationPrompt(q: string): boolean {
    const lower = q.toLowerCase();
    return IMPLEMENTATION_VERBS.some((verb) => lower.startsWith(`${verb} `));
}

describe('eval set shape', () => {
    it('keeps at least five queries on each side', () => {
        expect(evals.queries.filter((q) => q.trigger).length).toBeGreaterThanOrEqual(5);
        expect(evals.queries.filter((q) => !q.trigger).length).toBeGreaterThanOrEqual(4);
    });

    it('has no duplicate queries', () => {
        const seen = evals.queries.map((q) => q.q.toLowerCase());
        expect(new Set(seen).size).toBe(seen.length);
    });
});

describe('ownership coherence', () => {
    const declaresAdHocExecutor = /outside the engine|ad-hoc mode/i.test(skillBody);

    it('the skill declares an ad-hoc executor mode', () => {
        expect(declaresAdHocExecutor).toBe(true);
    });

    it('routes implementation prompts to itself when it claims to own them', () => {
        const implementationQueries = evals.queries.filter((q) => isImplementationPrompt(q.q));

        expect(implementationQueries.length).toBeGreaterThan(0);
        for (const query of implementationQueries) {
            // The regression: a skill that says "outside the engine YOU run this
            // loop" while sending every implementation prompt to `false` leaves
            // the prompt ownerless, which is the measured symptom.
            expect(query.trigger, `"${query.q}" must route to fe-design`).toBe(
                declaresAdHocExecutor,
            );
        }
    });

    it('still refuses the genuine near-misses', () => {
        const negatives = evals.queries.filter((q) => !q.trigger).map((q) => q.q.toLowerCase());

        // Inventorying existing UI belongs to existing-ui-audit in BOTH modes.
        expect(negatives.some((q) => q.includes('already have'))).toBe(true);
        // A ui-trivial one-line change is the documented skip.
        expect(negatives.some((q) => q.includes('colour to green'))).toBe(true);
        // Non-UI work never routes here.
        expect(negatives.some((q) => q.includes('database index'))).toBe(true);
    });

    it('does not let a near-miss be an implementation prompt', () => {
        for (const query of evals.queries.filter((q) => !q.trigger)) {
            expect(
                isImplementationPrompt(query.q),
                `"${query.q}" is an implementation prompt on the should-not-trigger side`,
            ).toBe(false);
        }
    });
});

describe('the skill body carries the loop, not only a map to it', () => {
    it('names all five required brief keys inline', () => {
        for (const key of ['layout', 'components', 'states', 'microcopy', 'a11y']) {
            expect(skillBody).toContain(`\`${key}\``);
        }
    });

    it('names all five required states inline', () => {
        for (const state of ['empty', 'loading', 'error', 'success', 'disabled']) {
            expect(skillBody).toContain(`\`${state}\``);
        }
    });

    it('carries the ui-trivial skip conditions rather than only linking them', () => {
        expect(skillBody).toMatch(/ui-trivial/);
        expect(skillBody).toMatch(/no new dependency/);
    });
});
