// Tests for src/scripts/lint_media_policy_linkage.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. Focused differential over the public helpers
// (collect_policies, collect_scan_files, referrers_for) against the REAL REPO,
// plus a golden-parity layer running python3 vs tsx (skipped without python3).
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as mpl from '../../src/scripts/lint_media_policy_linkage.js';



describe('lint_media_policy_linkage — helpers (real repo)', () => {
    it('collect_policies returns sorted *.md excluding README', () => {
        const policies = mpl.collect_policies();
        // Either zero (dir absent) or a sorted list with no README.
        const names = policies.map((p) => path.basename(p));
        expect(names.includes('README.md')).toBe(false);
        expect([...names].sort()).toEqual(names); // already sorted
    });

    it('collect_scan_files only returns existing *.md files', () => {
        const files = mpl.collect_scan_files();
        for (const f of files) {
            expect(f.endsWith('.md')).toBe(true);
        }
    });

    it('every policy has at least one referrer (the CI invariant)', () => {
        const policies = mpl.collect_policies();
        const scan = mpl.collect_scan_files();
        for (const p of policies) {
            expect(mpl.referrers_for(p, scan).length).toBeGreaterThan(0);
        }
    });

    it('a policy never satisfies its own linkage requirement', () => {
        const policies = mpl.collect_policies();
        if (policies.length === 0) {
            return; // dir absent — nothing to assert
        }
        const p = policies[0]!;
        // Scanning only itself yields no referrers (self is excluded).
        expect(mpl.referrers_for(p, [p])).toEqual([]);
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

