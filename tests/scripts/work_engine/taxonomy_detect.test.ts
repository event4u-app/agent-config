import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    GRANULARITY_LEXICON,
    MIN_TIERS,
    NO_TAXONOMY,
    TIER_MAJORITY,
    detect_component_taxonomy,
} from '../../../src/agent-src/templates/scripts/work_engine/taxonomy/detect.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const FIX = path.join(REPO_ROOT, 'tests', 'work_engine', 'fixtures', 'component-taxonomy');

function detect(fixture: string) {
    return detect_component_taxonomy(path.join(FIX, fixture));
}

describe('Phase 1.1 — the audit records the taxonomy the project evidences', () => {
    it('a tree whose components sit in named granularity folders records that taxonomy', () => {
        const r = detect('tiered');
        expect(r.taxonomy).toBe('atoms/molecules/organisms');
        expect(r.tiers).toEqual(['atoms', 'molecules', 'organisms']);
        expect(r.source).toBe('inferred');
        expect(r.component_root).toBe('src/components');
    });

    it('a flat tree records `none`', () => {
        const r = detect('flat');
        expect(r.taxonomy).toBe(NO_TAXONOMY);
        expect(r.tiers).toEqual([]);
        expect(r.source).toBe('none');
    });

    it('a root with no component directory at all records `none` and does not throw', () => {
        const r = detect('empty');
        expect(r.taxonomy).toBe(NO_TAXONOMY);
        expect(r.component_root).toBeNull();
    });

    it('a non-existent root degrades to `none` rather than raising', () => {
        const r = detect_component_taxonomy(path.join(FIX, 'no-such-fixture-dir'));
        expect(r.taxonomy).toBe(NO_TAXONOMY);
        expect(r.source).toBe('none');
    });

    it('a declared convention in the project docs outranks an inferred one', () => {
        // The `declared` fixture is built so inference alone FAILS: two of its
        // four buckets carry lexicon names, which is below TIER_MAJORITY. Only
        // the DESIGN.md declaration produces a taxonomy here, and it produces
        // the project's OWN names — `features` is in no lexicon.
        const r = detect('declared');
        expect(r.source).toBe('declared');
        expect(r.tiers).toEqual(['primitives', 'patterns', 'features']);
        expect(r.taxonomy).toBe('primitives/patterns/features');
        expect(GRANULARITY_LEXICON.has('feature')).toBe(false);
    });

    it('a declared tier that does not exist on disk is dropped, not trusted', () => {
        // `archetypes` is declared as a list item and exists nowhere in the
        // tree. A declaration cannot conjure a tier the project never created.
        expect(detect('declared').tiers).not.toContain('archetypes');
    });

    it('a backticked name in prose is a mention, not a declaration', () => {
        // The fixture says in prose that `legacy` is NOT a tier, and `legacy`
        // does exist on disk — so only the list-item rule keeps it out.
        expect(detect('declared').tiers).not.toContain('legacy');
    });

    it('every result carries evidence naming what was read', () => {
        expect(detect('tiered').evidence.length).toBeGreaterThan(0);
        expect(detect('declared').evidence.join(' ')).toContain('DESIGN.md');
    });
});

describe('Phase 1.2 — the false-positive direction is pinned', () => {
    it('a tree whose folder names collide with taxonomy words records `none`', () => {
        // `checkout` / `billing` / `molecules`: one lexicon hit out of three
        // buckets. A detector that returns a taxonomy here fails this test.
        const r = detect('collision');
        expect(r.taxonomy).toBe(NO_TAXONOMY);
        expect(r.tiers).toEqual([]);
    });

    it('the collision fixture really does contain a colliding folder name', () => {
        // Guards the fixture itself: if `molecules/` were renamed away the test
        // above would pass for the wrong reason.
        const buckets = fs
            .readdirSync(path.join(FIX, 'collision', 'src', 'components'), {
                withFileTypes: true,
            })
            .filter((e) => e.isDirectory())
            .map((e) => e.name);
        expect(buckets).toContain('molecules');
        expect(buckets.length).toBeGreaterThan(1);
    });

    it('one lexicon hit is never enough, whatever the bucket count', () => {
        expect(MIN_TIERS).toBeGreaterThanOrEqual(2);
        expect(TIER_MAJORITY).toBeGreaterThan(0.5);
    });

    // The `collision` fixture above pins the two floors TOGETHER and neither
    // one alone: at 1 hit in 3 buckets, relaxing MIN_TIERS still leaves the
    // majority test refusing, and relaxing TIER_MAJORITY still leaves the
    // tier-count floor refusing. Each floor therefore gets a fixture built so
    // that it, and only it, stands between the tree and a wrong taxonomy.

    it('a lone tier-shaped bucket records `none` — the MIN_TIERS floor alone', () => {
        // One bucket, one lexicon hit: the majority share is 1.0, so the
        // majority rule clears this tree completely. Only the two-tier floor
        // refuses it. Drop MIN_TIERS to 1 and this fixture reports `atoms`.
        const r = detect('single-tier');
        expect(r.taxonomy).toBe(NO_TAXONOMY);
        expect(r.tiers).toEqual([]);
    });

    it('a tier-shaped minority among domain folders records `none` — the majority floor alone', () => {
        // Two lexicon hits in five buckets clears MIN_TIERS outright, so the
        // 0.4 share is the only thing refusing. Relax TIER_MAJORITY below 0.4
        // and this fixture reports `atoms/molecules` for a project whose
        // components are organised by domain.
        const r = detect('domain-heavy');
        expect(r.taxonomy).toBe(NO_TAXONOMY);
        expect(r.tiers).toEqual([]);
    });

    it('each floor fixture really has the shape its name claims', () => {
        // Guards the fixtures themselves: renaming a folder away would make
        // both tests above pass for the wrong reason.
        const buckets = (f: string) =>
            fs
                .readdirSync(path.join(FIX, f, 'src', 'components'), { withFileTypes: true })
                .filter((e) => e.isDirectory())
                .map((e) => e.name)
                .sort();
        expect(buckets('single-tier')).toEqual(['atoms']);
        expect(buckets('domain-heavy')).toEqual([
            'atoms',
            'billing',
            'checkout',
            'molecules',
            'shipping',
        ]);
    });
});

describe('AC-4 — nothing here hard-codes a five-level taxonomy or a per-tier cap', () => {
    const SRC = path.join(
        REPO_ROOT,
        'src',
        'agent-src',
        'templates',
        'scripts',
        'work_engine',
        'taxonomy',
    );

    it('the lexicon is an unordered set spanning families, not one levelled list', () => {
        // A Set has no order, so it cannot encode a level sequence. The size
        // bound keeps it from silently becoming exactly one family's tiers.
        expect(GRANULARITY_LEXICON).toBeInstanceOf(Set);
        expect(GRANULARITY_LEXICON.size).toBeGreaterThan(5);
    });

    it('no module in taxonomy/ maps a tier name to a number', () => {
        const offenders: string[] = [];
        for (const file of fs.readdirSync(SRC)) {
            if (!file.endsWith('.ts')) continue;
            const body = fs.readFileSync(path.join(SRC, file), 'utf8');
            for (const tier of GRANULARITY_LEXICON) {
                // `atom: 6`, `'molecule': 8`, `"organism" : 4` — a per-tier cap.
                const cap = new RegExp(`['"\`]?${tier}s?['"\`]?\\s*:\\s*\\d`, 'iu');
                if (cap.test(body)) offenders.push(`${file}: ${tier}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('the detected taxonomy is the project’s own tier list, never a canonical one', () => {
        // Three tiers in, three tiers out. A detector that normalised the
        // project onto a five-level canon would widen this.
        expect(detect('tiered').tiers).toHaveLength(3);
        expect(detect('declared').tiers).toHaveLength(3);
    });
});
