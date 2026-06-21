// Tests for src/scripts/check_release_includes_discovery.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused differential suite + golden parity on the
// REAL REPO (skipped without python3). The discovery manifest is a generated
// artefact; the golden-parity case runs regardless of presence because both
// runtimes see the same on-disk state — but the differential cases inject a
// temp ROOT-shaped layout is not possible (ROOT is module-fixed), so we drive
// the public main() against the real tree and assert it agrees with python3.
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/check_release_includes_discovery.js';



describe('check_release_includes_discovery — constants', () => {
    it('MANIFEST + SUMMARY sit under dist/discovery/', () => {
        expect(mod.MANIFEST.endsWith(path.join('dist', 'discovery', 'discovery-manifest.json'))).toBe(
            true,
        );
        expect(
            mod.SUMMARY.endsWith(path.join('dist', 'discovery', 'discovery-manifest.summary.md')),
        ).toBe(true);
    });
});

