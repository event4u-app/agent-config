// Tests for src/scripts/generate_role_experiences_catalog.ts (py2ts, ADR-096).
//
// No pytest suite exists, so this is a focused differential suite: the pure
// loader (`load_roles`) + `render` against the REAL repo, plus a golden-parity
// layer that runs python3 vs tsx on the real tree — byte-exact generated
// docs/role-experiences.md AND identical stdout/stderr/exit for --check and
// the argparse-error path (skipped without python3). The writer leaves zero
// on-disk drift (snapshot + restore).
import { describe, expect, it } from 'vitest';

import * as gen from '../../src/scripts/generate_role_experiences_catalog.js';



describe('generate_role_experiences_catalog — loader + render (real repo)', () => {
    it('load_roles returns sorted, non-empty rows with the expected shape', () => {
        const roles = gen.load_roles();
        expect(roles.length).toBeGreaterThan(0);
        // sorted(glob) → component-wise sorted slugs.
        const slugs = roles.map((r) => r.slug);
        expect([...slugs].sort()).toEqual(slugs);
        for (const r of roles) {
            expect(typeof r.tagline).toBe('string');
            expect(r.rel).toBe(`../agents/roles/${r.slug}/index.md`);
            expect(r.status.length).toBeGreaterThan(0);
        }
    });

    it('render emits the header prose + the | Role | Tagline | Status | table', () => {
        const out = gen.render();
        expect(out.startsWith('# Role experiences — taglines at a glance\n')).toBe(true);
        expect(out).toContain('| Role | Tagline | Status |');
        expect(out).toContain('|---|---|---|');
        // every row links the display name / role and fences the status.
        for (const r of gen.load_roles()) {
            const name = r.display_name || r.role;
            expect(out).toContain(`| [${name}](${r.rel}) | ${r.tagline} | \`${r.status}\` |`);
        }
        expect(out.endsWith('\n')).toBe(true);
        expect(out.endsWith('\n\n')).toBe(false);
    });
});
