// Phase 0.1 of `road-to-skill-delivery-over-mcp` — pin the host listing-budget
// model against the one first-party observation this repo has of the defect.
//
// The observation is `agents/evidence/analysis/skill-catalogue-description-delivery.md`
// (2026-08-08, Claude Code 2.1.226): eight catalogue entries sampled against
// disk, three arrived WITH their description and five arrived BARE. The model
// under test predicts, from the documented budget mechanism alone, which
// descriptions survive.
//
// WHAT THIS TEST IS FOR, AND WHAT IT IS NOT. It is not a green rubber stamp on
// the model. The roadmap's own verify line requires that "any disagreement is
// recorded in the test as a known gap, not suppressed", and there IS a
// disagreement — it is asserted below, by name, in `KNOWN_GAP`. Reading that
// block is the point of running this file.
//
// PROJECTION SUBSTITUTION, STATED. The 2026-08-08 projection is not archived
// anywhere in this tree (`.claude/skills/` is gitignored and no snapshot of it
// was committed), so the catalogue here is rebuilt from the CURRENT
// `src/skills/*/SKILL.md` corpus. All eight sampled names still exist, which is
// what the pin needs; the surrounding corpus has grown since. That substitution
// can move a boundary case, and is named here rather than papered over.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    CLAUDE_CODE_LISTING_DEFAULTS,
    modelListingBudget,
    type CatalogueEntry,
} from '../../src/scripts/_lib/host_listing_model.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'src', 'skills');

/** Sampled 2026-08-08 as arriving WITH a description. */
const SAMPLED_DESCRIBED = ['accessibility-auditor', 'context-document', 'mcp'] as const;
/** Sampled 2026-08-08 as arriving BARE, while having a description on disk. */
const SAMPLED_BARE = [
    'comp-banding',
    'composer-packages',
    'condense-memory',
    'contract-review',
    'dcf-modeling',
] as const;

function descriptionCharsOf(slug: string): number {
    const file = path.join(SKILLS_DIR, slug, 'SKILL.md');
    const raw = fs.readFileSync(file, 'utf8');
    const fm = /^---\n([\s\S]*?)\n---/.exec(raw);
    if (!fm) return 0;
    const line = /^description:[ \t]*(.*)$/m.exec(fm[1]!);
    if (!line) return 0;
    return line[1]!.replace(/^["']|["']$/g, '').length;
}

function projectedCatalogue(): CatalogueEntry[] {
    return fs
        .readdirSync(SKILLS_DIR)
        .filter((slug) => fs.existsSync(path.join(SKILLS_DIR, slug, 'SKILL.md')))
        .map((slug) => ({ name: slug, descriptionChars: descriptionCharsOf(slug) }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

describe('host_listing_model — mechanics', () => {
    it('spends a budget of fraction x window x chars-per-token', () => {
        const r = modelListingBudget([], { contextWindowTokens: 200_000 });
        expect(r.budgetChars).toBe(8_000);
        expect(CLAUDE_CODE_LISTING_DEFAULTS.fraction).toBe(0.01);
        expect(CLAUDE_CODE_LISTING_DEFAULTS.perEntryCapChars).toBe(1536);
    });

    it('caps a single entry at the per-entry cap', () => {
        const r = modelListingBudget([{ name: 'a', descriptionChars: 5_000 }], {
            contextWindowTokens: 200_000,
        });
        expect(r.surviving).toEqual(['a']);
        expect(r.spentChars).toBe(1536);
    });

    it('marks everything past the budget bare, and never drops a name', () => {
        const catalogue: CatalogueEntry[] = Array.from({ length: 20 }, (_, i) => ({
            name: `s${String(i).padStart(2, '0')}`,
            descriptionChars: 1_000,
        }));
        const r = modelListingBudget(catalogue, { contextWindowTokens: 200_000 });
        expect(r.surviving).toHaveLength(8);
        expect(r.bare).toHaveLength(12);
        expect([...r.surviving, ...r.bare].sort()).toEqual(catalogue.map((e) => e.name).sort());
    });

    it('honours the usage order first, then falls back alphabetically', () => {
        // Sized so exactly one of the two fits: 7,950 + 100 overflows 8,000.
        // The per-entry cap is lifted here so the ORDER is what decides, not
        // the cap.
        const catalogue: CatalogueEntry[] = [
            { name: 'aaa', descriptionChars: 7_950 },
            { name: 'zzz', descriptionChars: 100 },
        ];
        const opts = { contextWindowTokens: 200_000, perEntryCapChars: 100_000 };
        const withUsage = modelListingBudget(catalogue, { ...opts, usageOrder: ['zzz'] });
        expect(withUsage.fillOrder).toBe('usage');
        expect(withUsage.surviving).toEqual(['zzz']);
        expect(withUsage.bare).toEqual(['aaa']);

        const empty = modelListingBudget(catalogue, opts);
        expect(empty.fillOrder).toBe('alphabetical-fallback');
        expect(empty.surviving).toEqual(['aaa']);
        expect(empty.bare).toEqual(['zzz']);
    });

    it('names every assumption that is upstream prose rather than repo measurement', () => {
        const r = modelListingBudget([], { contextWindowTokens: 200_000 });
        const ids = r.assumptions.map((a) => a.id).sort();
        expect(ids).toEqual([
            'budget-unit-is-chars',
            'fill-order-is-invocation-frequency',
            'names-are-never-dropped',
            'stop-at-first-overflow',
            'wrapper-overhead-unmodelled',
        ]);
        for (const a of r.assumptions) {
            expect(a.provenance).toBe('upstream-prose');
            expect(a.why.length).toBeGreaterThan(20);
        }
    });
});

describe('host_listing_model — pinned against the 2026-08-08 observation', () => {
    const catalogue = projectedCatalogue();
    const result = modelListingBudget(catalogue, {
        contextWindowTokens: 200_000,
        usageOrder: [], // the observation carries no usage order
    });
    const survived = new Set(result.surviving);

    it('has all eight sampled entries in the projected catalogue', () => {
        for (const name of [...SAMPLED_DESCRIBED, ...SAMPLED_BARE]) {
            expect(catalogue.some((e) => e.name === name)).toBe(true);
        }
    });

    it('reproduces the observation\u2019s qualitative claim: a substantial majority arrive bare', () => {
        // The observation refuses to state a rate ("no total N of 414 arrived
        // bare is claimed here"), so the only thing to pin is the direction.
        // Measured on the current corpus: 44 of 292 descriptions survive an
        // 8,000-char budget, spending 7,822 of it. The exact pair is left out
        // of the assertion on purpose \u2014 it moves whenever a skill is added,
        // and the direction is the claim the observation actually supports.
        expect(result.surviving.length).toBeLessThan(catalogue.length / 4);
        expect(result.bare.length).toBeGreaterThan(catalogue.length / 2);
        expect(result.spentChars).toBeLessThanOrEqual(result.budgetChars);
    });

    // ------------------------------------------------------------------
    // KNOWN GAP \u2014 recorded, not suppressed.
    //
    // The roadmap\u2019s verify line asked for the model to mark the five
    // sampled-bare entries as not surviving and the three sampled-described
    // ones as surviving. Run with an EMPTY usage order it does not: it agrees
    // on four of the eight and disagrees on four.
    //
    //   accessibility-auditor  described  \u2192 survives   AGREE
    //   condense-memory        bare       \u2192 bare       AGREE
    //   contract-review        bare       \u2192 bare       AGREE
    //   dcf-modeling           bare       \u2192 bare       AGREE
    //   context-document       described  \u2192 bare       DISAGREE
    //   mcp                    described  \u2192 bare       DISAGREE
    //   comp-banding           bare       \u2192 survives   DISAGREE
    //   composer-packages      bare       \u2192 survives   DISAGREE
    //
    // This is not a coding error and it is not tunable. It is the
    // `fill-order-is-invocation-frequency` assumption showing through, and the
    // observation REFUTES the alphabetical fallback outright: `context-document`
    // sorts strictly between two sampled-bare neighbours (`condense-memory`,
    // `contract-review`) and `mcp` sorts far past the budget, so NO
    // position-ordered fill over an alphabetical catalogue can reproduce that
    // session. The roadmap says the same thing about D4 in prose; this is the
    // executable version of it.
    //
    // What the model IS therefore good for: the budget arithmetic, the per-entry
    // cap, the direction, and the count of survivors GIVEN an order. What it is
    // not good for: predicting a specific skill\u2019s fate without that order.
    // Every Phase 2 tier decision inherits that limit, which is why
    // `skill-tiers.json` records the fallback it used.
    //
    // Closing the gap needs a usage-ordered observation \u2014 Phase 4.2\u2019s live arm.
    // It is not closable from the file system.
    // ------------------------------------------------------------------
    // MOVED ONCE, 2026-08-24, and recorded rather than re-pinned silently —
    // which is the whole point of the test below. `composer-packages` crossed
    // from the model's SURVIVES set to its bare set as the projected catalogue
    // reached 299 skills with 44 surviving: the fill boundary tightened past it.
    // The direction matters and is the reason this is not a regression — the
    // observation says bare, so the model CONVERGED on the observation. The
    // sample therefore agrees on five of eight, not four, and three known
    // disagreements remain. Nothing about the model or the observation changed;
    // only the corpus did, which is exactly the movement the block above says
    // per-skill fate is subject to without a usage order.
    const AGREE_SURVIVES = ['accessibility-auditor'] as const;
    const AGREE_BARE = ['condense-memory', 'contract-review', 'dcf-modeling', 'composer-packages'] as const;
    const DISAGREE_MODEL_SAYS_BARE = ['context-document', 'mcp'] as const;
    const DISAGREE_MODEL_SAYS_SURVIVES = ['comp-banding'] as const;

    it('agrees with the observation on exactly five of the eight sampled entries', () => {
        for (const name of AGREE_SURVIVES) expect(survived.has(name), name).toBe(true);
        for (const name of AGREE_BARE) expect(survived.has(name), name).toBe(false);
    });

    it('records the three known disagreements so they cannot silently move', () => {
        for (const name of DISAGREE_MODEL_SAYS_BARE) {
            expect(survived.has(name), `${name} is a KNOWN GAP \u2014 see the block above`).toBe(false);
        }
        for (const name of DISAGREE_MODEL_SAYS_SURVIVES) {
            expect(survived.has(name), `${name} is a KNOWN GAP \u2014 see the block above`).toBe(true);
        }
        expect(result.fillOrder).toBe('alphabetical-fallback');
    });

    it('states why the fallback is refuted, structurally, not by opinion', () => {
        // `context-document` sits alphabetically between two observed-bare
        // entries. Any fill that walks a sorted catalogue and stops once must
        // therefore put it on the same side as at least one of them.
        const sorted = catalogue.map((e) => e.name);
        const before = sorted.indexOf('condense-memory');
        const mid = sorted.indexOf('context-document');
        const after = sorted.indexOf('contract-review');
        expect(before).toBeLessThan(mid);
        expect(mid).toBeLessThan(after);
        expect(survived.has('context-document')).toBe(survived.has('condense-memory'));
    });
});
