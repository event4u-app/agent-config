import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    GRANULARITY_LEXICON,
    MIN_TIERS,
    NO_TAXONOMY,
    SUPPORT_BUCKETS,
    TIER_MAJORITY,
    detect_component_taxonomy,
    main,
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
        // Was an assertion over MIN_TIERS and TIER_MAJORITY alone, which never
        // called the detector: gutting `_infer_tiers` entirely while leaving
        // the two constants at their values passed it. It asserts the floors
        // through the behaviour now, so deleting them from the comparison
        // fails it. The constants are still read, to state which floor is
        // being relied on, but they are no longer the whole assertion.
        expect(MIN_TIERS).toBeGreaterThanOrEqual(2);
        expect(TIER_MAJORITY).toBeGreaterThan(0.5);
        expect(detect('collision').taxonomy).toBe(NO_TAXONOMY);
        expect(detect('single-tier').taxonomy).toBe(NO_TAXONOMY);
        expect(detect('domain-heavy').taxonomy).toBe(NO_TAXONOMY);
    });

    it('an ordinary kind split is not a taxonomy, at 2 of 3', () => {
        // `components/{layout, pages, forms}` — every one of those is an
        // ordinary folder name and two of them are also granularity words. At
        // a 0.6 share floor this recorded `layout/pages` and made every
        // `forms` component a conformance gap, on a project that chose no
        // taxonomy at all. This is the risk register's rank-1 risk, and 2-of-3
        // is the ratio where it fires — none of the other refusal fixtures
        // sits there.
        const r = detect('kind-split');
        expect(r.taxonomy).toBe(NO_TAXONOMY);
        expect(r.tiers).toEqual([]);
    });

    it('support folders do not suppress a taxonomy that is really there', () => {
        // The mirror failure, and the reason the share floor could not simply
        // be raised: `hooks` / `utils` / `types` hold `.ts` files, so they
        // count as buckets and dragged `atoms/molecules/organisms` down to
        // 3 of 6. Three ordinary sibling folders were enough to hide a real
        // taxonomy. They are excluded from the denominator, never from the
        // matches.
        const r = detect('with-support');
        expect(r.taxonomy).toBe('atoms/molecules/organisms');
        expect(r.source).toBe('inferred');
    });

    it('a support folder is never itself recorded as a tier', () => {
        expect(detect('with-support').tiers).not.toContain('hooks');
        expect(SUPPORT_BUCKETS.has('hook')).toBe(true);
    });

    it('a bolded declaration list item is still a declaration', () => {
        // `- **`bits`** — ...` is an ordinary way to write the list, and a
        // regex demanding the backtick lead dropped it in silence. None of
        // these three names is a granularity word, so inference cannot reach
        // this answer — only the declaration can, which is what makes the
        // fixture discriminate.
        const r = detect('declared-bold');
        expect(r.source).toBe('declared');
        expect(r.tiers).toEqual(['shells', 'slices', 'bits']);
        expect(r.tiers).not.toContain('vendor');
    });

    it('the documented CLI actually prints the result', () => {
        // `existing-ui-audit` § 1b tells the agent to RUN this module. It had
        // no entry block, so the command exited 0 and printed nothing, and an
        // agent following it literally had to invent the two state keys.
        const chunks: string[] = [];
        const write = process.stdout.write.bind(process.stdout);
        (process.stdout as { write: unknown }).write = (c: string) => {
            chunks.push(String(c));
            return true;
        };
        let code: number;
        try {
            code = main(['--root', path.join(FIX, 'tiered')]);
        } finally {
            (process.stdout as { write: unknown }).write = write;
        }
        expect(code).toBe(0);
        const parsed = JSON.parse(chunks.join('')) as { taxonomy: string };
        expect(parsed.taxonomy).toBe('atoms/molecules/organisms');
    });

    it('the CLI exits 0 on `none` too — `none` is an answer, not a failure', () => {
        const write = process.stdout.write.bind(process.stdout);
        (process.stdout as { write: unknown }).write = () => true;
        try {
            expect(main(['--root', path.join(FIX, 'flat')])).toBe(0);
        } finally {
            (process.stdout as { write: unknown }).write = write;
        }
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

    it('the lexicon is held alphabetically, so it cannot encode a level sequence', () => {
        // This asserted `instanceof Set` under the comment "a Set has no
        // order". A JavaScript Set iterates in INSERTION order, and the
        // lexicon's first five entries were one vocabulary's five levels in
        // their own sequence — so the claim was false and the test could not
        // have caught it. Alphabetical order is checkable and is not a level
        // sequence in any vocabulary.
        const words = [...GRANULARITY_LEXICON];
        expect(words).toEqual([...words].sort());
        expect(words.length).toBeGreaterThan(5);
    });

    // Narrower than AC-4, which says "no file in `src/`". This walks the two
    // modules that would carry such a rule if one existed, which is where the
    // shortest implementation of Phase 2 would have put it — not the whole
    // tree. Stated rather than implied, so the check is not read as the
    // criterion.
    it('no module in taxonomy/ maps a tier name to a number', () => {
        const offenders: string[] = [];
        for (const file of fs.readdirSync(SRC)) {
            if (!file.endsWith('.ts')) continue;
            const body = fs.readFileSync(path.join(SRC, file), 'utf8');
            for (const tier of GRANULARITY_LEXICON) {
                // Three shapes a per-tier cap can take: an object entry
                // (`atom: 6`, `'molecule': 8`), an array-valued one
                // (`atoms: [6]`), and a named constant (`ATOM_CAP = 6`,
                // `MAX_MOLECULE_PROPS = 8`). The first was all this checked.
                for (const cap of [
                    new RegExp(`['"\`]?${tier}s?['"\`]?\\s*:\\s*\\[?\\s*\\d`, 'iu'),
                    new RegExp(`\\b\\w*${tier}s?\\w*\\s*=\\s*\\d`, 'iu'),
                ]) {
                    if (cap.test(body)) offenders.push(`${file}: ${tier}`);
                }
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
