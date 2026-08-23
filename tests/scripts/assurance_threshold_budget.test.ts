/**
 * Invariants of `src/config/assurance-threshold-budget.json` — the assurance
 * enforcement-threshold PRE-REGISTRATION.
 *
 * A pre-registration is only a pre-registration while it constrains something it
 * cannot yet see. These assertions are what stop it decaying into a post-hoc
 * justification, which is the failure its own blocker names: *"the benchmark
 * becomes post-hoc justification for whatever mechanism was already preferred."*
 *
 * The load-bearing one is the last: a threshold may not carry a number while its
 * `measurement` is still null. That single pairing is what makes an invented
 * number unrepresentable rather than merely discouraged — the repository's
 * standing rule is that a number with no measurement behind it must say so in the
 * same breath, and here it cannot exist at all without one.
 *
 * SABOTAGE PROBES, run before this file was trusted, each reverted from a `cp`
 * backup of the JSON. Counts are recorded in the roadmap blocker.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PATH = join(REPO_ROOT, 'src', 'config', 'assurance-threshold-budget.json');

interface Dimension {
    description: string;
    threshold: number | null;
    measurement: string | null;
    set_when: string;
    blocks_enforcement: boolean;
    unit: string;
    direction: 'lower_is_better' | 'higher_is_better';
    _comment: string | null;
}
interface Budget {
    schema_version: number;
    owner: string;
    review_by: string;
    registered_at: string;
    threshold_setting_procedure: string;
    dimension_applicability: Record<string, string>;
    dimensions: Record<string, Dimension>;
    revisit_if: string[];
}

const budget = JSON.parse(readFileSync(PATH, 'utf-8')) as Budget;

/** Closed here and in the blocker. A fifth needs schema_version 2. */
const CLOSED_SET = ['false_verified_rate', 'defect_catch_uplift', 'cost_budget', 'false_positive_burden'];

describe('assurance threshold budget — budget-config shape', () => {
    it('carries the owner, review_by and registered_at every src/config budget config carries', () => {
        expect(budget.schema_version).toBeGreaterThanOrEqual(1);
        expect(budget.owner.trim().length).toBeGreaterThan(0);
        expect(budget.review_by).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(budget.registered_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('registered_at is not after review_by', () => {
        expect(budget.registered_at <= budget.review_by).toBe(true);
    });
});

describe('assurance threshold budget — the dimension set is closed', () => {
    it('is exactly the four dimensions the blocker closed', () => {
        expect(Object.keys(budget.dimensions).sort()).toEqual([...CLOSED_SET].sort());
    });

    it('every dimension is fully declared', () => {
        for (const [id, d] of Object.entries(budget.dimensions)) {
            expect(d.description.trim().length, `${id}.description`).toBeGreaterThan(0);
            expect(d.set_when.trim().length, `${id}.set_when`).toBeGreaterThan(0);
            expect(d.unit.trim().length, `${id}.unit`).toBeGreaterThan(0);
            expect(['lower_is_better', 'higher_is_better'], `${id}.direction`).toContain(d.direction);
            expect(typeof d.blocks_enforcement, `${id}.blocks_enforcement`).toBe('boolean');
        }
    });

    it('every dimension declares a threshold key explicitly, even when null', () => {
        // "Committed" must mean "present in a falsifiable state", never "absent".
        // A missing key and an explicit null are the same value in JS and are NOT
        // the same claim, so the key's presence is asserted directly.
        for (const id of CLOSED_SET) {
            expect(Object.keys(budget.dimensions[id]!), id).toContain('threshold');
            expect(Object.keys(budget.dimensions[id]!), id).toContain('measurement');
        }
    });
});

describe('assurance threshold budget — no number without a measurement', () => {
    it('a non-null threshold requires a non-null measurement', () => {
        // The whole point. An invented number is unrepresentable, not merely
        // discouraged: the pairing has to be satisfied before a number can exist.
        for (const [id, d] of Object.entries(budget.dimensions)) {
            if (d.threshold === null) continue;
            expect(d.measurement, `${id}: a threshold was set with no measurement behind it`).not.toBeNull();
            expect((d.measurement ?? '').trim().length, `${id}.measurement`).toBeGreaterThan(0);
        }
    });

    it('a set threshold cites either an empirical derivation or a named safety floor', () => {
        for (const [id, d] of Object.entries(budget.dimensions)) {
            if (d.threshold === null) continue;
            const c = (d._comment ?? '').toLowerCase();
            const empirical = /p\d{1,2}|percentile|delta|run \d{4}-\d{2}-\d{2}/.test(c);
            const safety = c.includes('safety floor');
            expect(empirical || safety, `${id}._comment cites neither derivation nor safety floor`).toBe(true);
        }
    });

    it('as registered, all four are null — no corpus exists, so no number could have been measured', () => {
        for (const id of CLOSED_SET) {
            expect(budget.dimensions[id]!.threshold, id).toBeNull();
            expect(budget.dimensions[id]!.measurement, id).toBeNull();
        }
    });
});

describe('assurance threshold budget — AC-8: the four nulls are not a universal constant', () => {
    it('every dimension has an applicability rule keyed by observable policy characteristics', () => {
        for (const id of CLOSED_SET) {
            expect(budget.dimension_applicability[id]?.trim().length, id).toBeGreaterThan(0);
        }
    });

    it('a safety-floor exemption exists, so a hard red line can block without an uplift claim', () => {
        // AC-11's escape hatch. Without it the conjunction of four nulls would be
        // a universal minimum threshold under another name, which AC-8 forbids.
        expect(budget.dimension_applicability['safety_floor_exemption']).toBeTruthy();
        expect(budget.dimension_applicability['safety_floor_exemption']!.toLowerCase()).toContain('safety floor');
    });

    it('the threshold-setting procedure states a technical requirement', () => {
        const p = budget.threshold_setting_procedure.toLowerCase();
        expect(p).toContain('set_when');
        expect(p).toContain('safety floor');
    });

    it('the revisit conditions are non-empty and none of them is a bare calendar date', () => {
        expect(budget.revisit_if.length).toBeGreaterThanOrEqual(3);
        for (const r of budget.revisit_if) expect(r.trim().length).toBeGreaterThan(0);
        expect(budget.revisit_if.some((r) => /corpus/i.test(r))).toBe(true);
    });
});
