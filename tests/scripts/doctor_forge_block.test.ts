/**
 * The `forge_protection` block as `doctor --json` emits it —
 * `road-to-adversarial-verification-and-long-runs` AC-5.
 *
 * The layer the two review rounds kept finding defects in, and the one that had
 * no test at all: the slug substitution and the `repository` field happen HERE,
 * while the only assertions covering them sat one layer down on
 * `forgeReadingFor`'s return value.
 *
 * The load-bearing case is the OFFLINE-WITH-A-REMOTE one. A git remote resolves
 * with no network, so an ordinary offline run reaches this function with a
 * non-null slug and an all-unread reading. The first implementation reported
 * that slug and substituted it into every source — which made the claim this
 * whole change rests on, that offline output is what Phase 3.2 shipped, false
 * on exactly the path it was supposed to cover. The earlier verification only
 * ever exercised the opt-out switch and read it as offline; they are different
 * paths and only one of them was checked.
 */

// provenance: level=L1 | critical=yes | evidence=drain-adversarial-verification-close-round2

import { describe, expect, it } from 'vitest';

import { forgeProtectionJson } from '../../src/scripts/_cli/doctor_execution.js';
import { UNREAD_FORGE, type ForgeReading } from '../../src/scripts/_lib/forge_protection.js';
import type { RulesetDetail } from '../../src/scripts/_lib/platform_anchor.js';

const RULESET: RulesetDetail = {
    id: 1,
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'] } },
    rules: [{ type: 'non_fast_forward' }],
};

const LIVE: ForgeReading = {
    rulesets: [RULESET],
    defaultBranch: 'main',
    allowAutoMerge: true,
    deployRestricted: true,
};

type Block = {
    repository: string | null;
    read_from_forge: boolean;
    rows: { id: string; state: string; source: string }[];
    actions: string[];
};

const block = (r: ForgeReading, repo: string | null): Block =>
    forgeProtectionJson(r, repo) as unknown as Block;

describe('the repository field', () => {
    it('names the repository when something was actually read', () => {
        const b = block(LIVE, 'o/r');
        expect(b.repository).toBe('o/r');
        expect(b.read_from_forge).toBe(true);
        expect(b.rows[0]?.source).toContain('repos/o/r/');
        expect(b.rows.every((row) => !row.source.includes('{owner}'))).toBe(true);
    });

    it('reports NO repository offline, even when a slug resolved from the local remote', () => {
        // The high finding. `git` answers offline, so the slug is present while
        // every row is unread — and reporting it made the output differ from
        // the offline output Phase 3.2 shipped, which is the property the whole
        // change rests on.
        const b = block(UNREAD_FORGE, 'o/r');
        expect(b.repository).toBeNull();
        expect(b.read_from_forge).toBe(false);
        expect(b.rows.every((row) => row.state === 'unread')).toBe(true);
        expect(b.rows[0]?.source).toContain('{owner}/{repo}');
    });

    it('is byte-identical offline whether or not a slug resolved', () => {
        // The claim, asserted rather than described: the opt-out path and the
        // failed-live path produce the same document.
        expect(JSON.stringify(block(UNREAD_FORGE, 'o/r'))).toBe(
            JSON.stringify(block(UNREAD_FORGE, null)),
        );
    });

    it('substitutes into the action lines too, not only the rows', () => {
        const partial: ForgeReading = { ...LIVE, allowAutoMerge: false };
        const b = block(partial, 'o/r');
        expect(b.actions.some((a) => a.includes('repos/o/r'))).toBe(true);
        expect(b.actions.every((a) => !a.includes('{owner}'))).toBe(true);
    });

    it('treats a dollar sequence in the slug as literal text', () => {
        // `String.replace` reads `$&` in the REPLACEMENT as a control sequence.
        // `resolveForgeRepo` refuses such a slug, so this is the second line of
        // defence rather than the only one — which is why it is asserted here
        // instead of being argued from the validator.
        const b = block(LIVE, 'o/$&');
        expect(b.rows[0]?.source).toContain('repos/o/$&/');
    });
});
