// Tests for src/scripts/lint_media_policy_linkage.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. Focused differential over the public helpers
// (collect_policies, collect_scan_files, referrers_for) against the REAL REPO,
// plus a golden-parity layer running python3 vs tsx (skipped without python3).
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
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

// --- Reverse direction: a render end is listed and finished ----------------
//
// The first pass only asks "is each policy linked from somewhere". The reverse
// asks "does each command that emits a deliverable medium appear in both
// policy trigger lists and call the finish step" — the gap that let four of
// five video commands and every image command ship without a carrier.

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'media_policy_linkage');
const policiesIn = (variant: string): string[] =>
    ['disclosure.md', 'transparency.md'].map((f) => path.join(FIXTURES, variant, 'policies', f));

describe('lint_media_policy_linkage — render ends (reverse direction)', () => {
    it('flags a render end missing from both trigger lists and from finish', () => {
        const findings = mpl.render_end_findings(path.join(FIXTURES, 'red', 'commands'), policiesIn('red'));
        const finalCut = findings.filter((f) => f.includes('/video:final-cut'));
        // two trigger lists + the finish call; a mention outside `## Triggers` does not count
        expect(finalCut).toHaveLength(3);
        expect(finalCut.some((f) => f.includes('disclosure.md'))).toBe(true);
        expect(finalCut.some((f) => f.includes('transparency.md'))).toBe(true);
        expect(finalCut.some((f) => f.includes('embed-provenance.sh finish'))).toBe(true);
        // listed in both, but never finished
        const make = findings.filter((f) => f.includes('/image:make'));
        expect(make).toHaveLength(1);
        expect(make[0]).toContain('embed-provenance.sh finish');
        // a command that emits no medium is not a render end
        expect(findings.some((f) => f.includes('/image:look'))).toBe(false);
    });

    it('is silent on the near-miss: listed in both and finished', () => {
        expect(mpl.render_end_findings(path.join(FIXTURES, 'green', 'commands'), policiesIn('green'))).toEqual([]);
    });

    it('classifies render ends by medium, not by name', () => {
        const ends = mpl.collect_render_end_commands(path.join(FIXTURES, 'green', 'commands'));
        expect(ends.map((e) => `${e.id}=${e.medium}`).sort()).toEqual(['/image:make=image', '/video:final-cut=video']);
    });

    it('holds on the real tree: every render end is listed and finished', () => {
        expect(mpl.collect_render_end_commands().length).toBeGreaterThan(0);
        expect(mpl.render_end_findings()).toEqual([]);
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

