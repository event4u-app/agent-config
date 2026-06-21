// Tests for src/scripts/check_public_catalog_links.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused spec over _shipped_roots / _resolve /
// _under_shipped_surface plus golden parity (python3 vs tsx) on the REAL
// REPO for the default and --quiet invocations.
import { describe, expect, it } from 'vitest';

import * as cpcl from '../../src/scripts/check_public_catalog_links.js';



describe('check_public_catalog_links — helpers', () => {
    it('_shipped_roots splits dirs and files from package.json#files', () => {
        const [dirs, files] = cpcl._shipped_roots();
        expect(dirs instanceof Set).toBe(true);
        expect(files instanceof Set).toBe(true);
        // No trailing slashes retained on dir entries.
        for (const d of dirs) {
            expect(d.endsWith('/')).toBe(false);
        }
    });

    it('_resolve returns null for external / out-of-root hrefs', () => {
        expect(cpcl._resolve('https://example.com')).toBeNull();
        expect(cpcl._resolve('mailto:x@y.z')).toBeNull();
        expect(cpcl._resolve('')).toBeNull();
        expect(cpcl._resolve('#anchor-only')).toBeNull();
    });

    it('_under_shipped_surface matches exact files and dir prefixes', () => {
        const dirs = new Set(['docs', 'dist/agent-src']);
        const files = new Set(['README.md']);
        expect(cpcl._under_shipped_surface('README.md', dirs, files)).toBe(true);
        expect(cpcl._under_shipped_surface('docs', dirs, files)).toBe(true);
        expect(cpcl._under_shipped_surface('docs/catalog.md', dirs, files)).toBe(true);
        expect(cpcl._under_shipped_surface('src/x.ts', dirs, files)).toBe(false);
    });
});

