/**
 * Contract tests for the demand gate's addressee (§ 8-pre of
 * docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md).
 *
 * The source defect: the L0–L4 ladder defines its two build levels
 * exclusively over third-party users ("a real segment", "users are
 * churning"), so a project with no intended user population cannot reach
 * either. Its ceiling was L0, whose recommendation is *defer* — a
 * single-user tool would be deferred forever.
 *
 * WHAT THESE TESTS ARE, HONESTLY. The fix's real check is behavioural:
 * "a prompt saying I am the only user must not produce a demand
 * measurement" and its counter-test. Live trigger evaluation in this
 * repository is a human gate that hard-aborts under automation, so neither
 * can run here. These tests assert the **artefact the behaviour reads
 * from** — strictly weaker, and named as such rather than dressed up as
 * the behavioural check.
 *
 * The counter-test is the load-bearing half: a fix that switched the
 * demand gate off everywhere would only have inverted the defect.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const GUIDELINE = path.join(
    __dirname,
    '../../docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md',
);

/** The § 8-pre section body, up to the next same-level heading. */
function demandGateSection(): string {
    const text = fs.readFileSync(GUIDELINE, 'utf-8');
    const start = text.indexOf('### 8-pre.');
    expect(start, '§ 8-pre heading must exist').toBeGreaterThan(-1);
    const rest = text.slice(start + 1);
    const end = rest.indexOf('\n### ');
    return end === -1 ? rest : rest.slice(0, end);
}

describe('demand gate — the addressee', () => {
    it('the self-path exists: an L-self build level and the artefact consequence', () => {
        const section = demandGateSection();

        // The build level a project with no intended market can actually reach.
        expect(section).toMatch(/\|\s*L-self\s*\|/);
        expect(section).toMatch(/\*\*Build\*\*/);

        // The measured damage was a roadmap gate, not a conversation — so the
        // consequence for artefacts has to be stated, not implied.
        expect(section).toMatch(/roadmap gate/i);
        expect(section).toMatch(/external user population/i);

        // The absolute form that made L-self unreachable must be gone.
        expect(section).not.toMatch(/Build only at \*\*L3–L4\*\*/);
    });

    it('COUNTER-TEST: the market path survives untouched', () => {
        const section = demandGateSection();

        // A fix that disabled the check everywhere would pass the test above
        // and fail here. These two rows are the whole point of the gate for a
        // project that does have users.
        expect(section).toMatch(/Blocks activation\/retention for a real segment/);
        expect(section).toMatch(/Users are churning \/ deals lost without it/);
        expect(section).toMatch(/\*\*Build now\*\*/);

        // L0–L2 still defer/validate — the ladder was extended, not flattened.
        expect(section).toMatch(/L0–L2 get a defer\/validate\s+recommendation/);

        // The market path is asserted against the `audience: public` BRANCH,
        // never against the shipped default. What "the market path survives"
        // means is that the `public` row still grants the whole gate — all
        // three questions and the full ladder.
        //
        // Re-pointed (road-to-demand-gate-audience-followup, Item 1): this
        // assertion used to match /`public`.{0,120}unchanged/, which coupled
        // the market-path check to `public` being the default. "Unchanged" is
        // a claim relative to the pre-key baseline, so a maintainer flipping
        // the default to `internal` would legitimately reword that row and
        // redden this test for a reason that has nothing to do with the market
        // path. The branch semantics hold under either default; the default
        // itself is pinned by its own test below, against the template.
        expect(section).toMatch(/\|\s*`public`\s*\|[^|]*all three questions[^|]*full ladder/i);
    });

    it('documents whichever default the template actually ships', () => {
        // The pair this test completes: the counter-test above no longer
        // notices a default flip, so the flip needs a check of its own —
        // otherwise flipping the template and forgetting the prose would be
        // silent in both directions. Read from the template rather than
        // hard-coded, so this stays green on a deliberate flip and red on a
        // half-done one.
        const template = fs.readFileSync(
            path.join(__dirname, '../../src/config/agent-settings.template.yml'),
            'utf-8',
        );
        const hits = [...template.matchAll(/^[ \t]*audience:[ \t]*(\w+)[ \t]*$/gm)];
        expect(hits.length, 'project.audience must be a unique anchor in the template').toBe(1);
        const shipped = hits[0][1];

        const section = demandGateSection();
        expect(
            section,
            `§ 8-pre must name \`${shipped}\` as what an absent value resolves to`,
        ).toMatch(new RegExp(`absent value resolves to\\s+\`${shipped}\``, 'i'));
    });

    it('every audience value the schema accepts has documented behaviour', () => {
        const section = demandGateSection();
        // A value that validates but has no described branch is a silent
        // no-op — the reader would have no way to know what it does.
        for (const value of ['self', 'internal', 'client', 'public']) {
            expect(section, `audience: ${value} must be documented in § 8-pre`).toContain(
                `\`${value}\``,
            );
        }
        expect(section).toContain('project.audience');
    });

    it('states its own enforcement honestly (the branch table is model-carried)', () => {
        const section = demandGateSection();
        // Nothing reads project.audience to change this section's behaviour.
        // Claiming otherwise would be the coverage inflation this repo's gate
        // discipline refuses.
        expect(section).toMatch(/model-carried/i);
        expect(section).toMatch(/lint_roadmap_complexity/);
    });
});
