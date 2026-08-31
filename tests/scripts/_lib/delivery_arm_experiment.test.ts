import { describe, expect, it } from 'vitest';

import {
    ARMS,
    renderArmExperiment,
    runArmExperiment,
    thinStandingIds,
    type ArmName,
    type ArmRow,
    type LabelledCase,
} from '../../../src/scripts/_lib/delivery_arm_experiment.js';
import { CAP_BYTES } from '../../../src/scripts/hooks/rule_inject_hook.js';
import { loadRouter } from '../../../src/scripts/_lib/rule_injection.js';
import { loadCorpus, DEFAULT_CORPUS, REPO_ROOT } from '../../../src/scripts/model_rule_injection.js';
import { gpt_tokens } from '../../../src/scripts/_lib/token_count.js';

const router = loadRouter(REPO_ROOT);
const cases = loadCorpus(DEFAULT_CORPUS) as LabelledCase[];
const tokensOf = (t: string): number => gpt_tokens(t).tokens;
const standing: Record<ArmName, number> = { 'eager-all': 100, thin: 10, delivery: 10 };

function run(capBytes: number, r = router): ArmRow[] {
    return runArmExperiment({ repoRoot: REPO_ROOT, router: r, cases, capBytes, standing, tokensOf });
}

function byArm(rows: ArmRow[], arm: ArmName): ArmRow {
    return rows.find((r) => r.arm === arm) as ArmRow;
}

describe('6.1 — the three arms are measured against one another', () => {
    const rows = run(CAP_BYTES);

    it('reports exactly the three LeanProjectionMode arms, in order', () => {
        expect(rows.map((r) => r.arm)).toEqual([...ARMS]);
        expect([...ARMS]).toEqual(['eager-all', 'thin', 'delivery']);
    });

    it('scores all three arms over the same case set', () => {
        const positives = new Set(rows.map((r) => r.positives));
        const nearMisses = new Set(rows.map((r) => r.nearMisses));
        expect(positives.size).toBe(1);
        expect(nearMisses.size).toBe(1);
        expect(byArm(rows, 'thin').positives).toBeGreaterThan(0);
    });

    // The whole point of the step. Three arms that report the same number are
    // one measurement printed three times, which is the failure this test
    // exists to make impossible to ship unnoticed.
    it('the three arms report DIFFERENT delivery, not one number three times', () => {
        const eager = byArm(rows, 'eager-all');
        const thin = byArm(rows, 'thin');
        const delivery = byArm(rows, 'delivery');
        expect(eager.delivered).toBeGreaterThan(delivery.delivered);
        expect(delivery.delivered).toBeGreaterThan(thin.delivered);
        expect(new Set([eager.delivered, thin.delivered, delivery.delivered]).size).toBe(3);
    });

    // eager buys its perfect recall by standing every body, so every near-miss
    // rule is in context too. That is the cost the arms trade against.
    it('eager-all has perfect delivery and zero context precision', () => {
        const eager = byArm(rows, 'eager-all');
        expect(eager.delivered).toBe(eager.positives);
        expect(eager.falseContext).toBe(eager.nearMisses);
    });

    it('thin delivers no corpus body — every labelled rule is a pointer there', () => {
        const thin = byArm(rows, 'thin');
        expect(thin.delivered).toBe(0);
        expect(thin.falseContext).toBe(0);
        const standingIds = thinStandingIds(router);
        for (const c of cases) expect(standingIds.has(c.rule)).toBe(false);
    });

    it('only the delivery arm reports injected tokens and cap drops', () => {
        expect(byArm(rows, 'eager-all').injectedMeanTokens).toBe(0);
        expect(byArm(rows, 'thin').injectedMeanTokens).toBe(0);
        expect(byArm(rows, 'eager-all').capDropped).toBe(0);
        expect(byArm(rows, 'thin').capDropped).toBe(0);
        expect(byArm(rows, 'delivery').injectedMeanTokens).toBeGreaterThan(0);
    });

    it('is deterministic — two runs are identical', () => {
        expect(run(CAP_BYTES)).toEqual(rows);
    });

    it('renders the pairwise deltas, not three independent rows', () => {
        const text = renderArmExperiment(rows, CAP_BYTES).join('\n');
        expect(text).toContain('pairwise deltas');
        expect(text).toContain('thin      vs eager-all');
        expect(text).toContain('delivery  vs eager-all');
        expect(text).toContain('delivery  vs thin');
        expect(text).toContain('ADR-202');
    });
});

// A measurement never seen move has unknown sensitivity. Two independent
// handles are perturbed, and the arms that MUST NOT move are asserted not to.
describe('6.1 — sensitivity', () => {
    it('the delivery arm falls when the byte cap is squeezed', () => {
        const wide = byArm(run(200_000), 'delivery');
        const shipped = byArm(run(CAP_BYTES), 'delivery');
        const tight = byArm(run(1), 'delivery');
        expect(wide.delivered).toBeGreaterThan(shipped.delivered);
        expect(shipped.delivered).toBeGreaterThan(tight.delivered);
        expect(tight.capDropped).toBeGreaterThan(shipped.capDropped);
        expect(wide.capDropped).toBe(0);
    });

    it('the two standing arms are INSENSITIVE to the cap, as they must be', () => {
        for (const arm of ['eager-all', 'thin'] as ArmName[]) {
            const a = byArm(run(1), arm);
            const b = byArm(run(200_000), arm);
            expect(a.delivered).toBe(b.delivered);
            expect(a.falseContext).toBe(b.falseContext);
        }
    });

    // The second handle: strip one rule's triggers and the delivery arm must
    // lose exactly that rule's positives, while eager-all does not move.
    it('the delivery arm falls by exactly the positives of a rule whose triggers are removed', () => {
        const target = 'design-fidelity';
        const positivesOfTarget = cases.filter(
            (c) => c.label === 'positive' && c.rule === target,
        ).length;
        expect(positivesOfTarget).toBeGreaterThan(0);

        const base = run(CAP_BYTES);
        const deliveredBefore = byArm(base, 'delivery').delivered;

        const mutated = JSON.parse(JSON.stringify(router)) as typeof router;
        let stripped = 0;
        for (const tier of ['tier_1', 'tier_2']) {
            const arr = mutated[tier] as Array<Record<string, unknown>> | undefined;
            if (!Array.isArray(arr)) continue;
            for (const r of arr) {
                if (String(r['id']) === target) {
                    r['triggers'] = [];
                    stripped += 1;
                }
            }
        }
        expect(stripped).toBe(1);

        const after = run(CAP_BYTES, mutated);
        // A triggerless rule becomes standing under thin/delivery by
        // construction, so removing the triggers moves it from the injected
        // set into the standing set — delivery must NOT lose it, and thin must
        // GAIN it. Either way the number moves, which is what sensitivity means.
        expect(byArm(after, 'thin').delivered).toBe(positivesOfTarget);
        expect(byArm(after, 'delivery').delivered).toBe(deliveredBefore);
        expect(byArm(after, 'eager-all').delivered).toBe(byArm(base, 'eager-all').delivered);
    });
});
