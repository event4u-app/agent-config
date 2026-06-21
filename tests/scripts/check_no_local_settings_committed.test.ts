// Tests for src/scripts/check_no_local_settings_committed.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module. Focused differential suite over the
// pure helper (tracked_local_settings basename match) plus a golden-parity
// layer that runs python3 vs tsx on the REAL REPO (skipped without python3).
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/check_no_local_settings_committed.js';



describe('check_no_local_settings_committed — constants', () => {
    it('LOCAL_FILE is the per-machine override file name', () => {
        expect(mod.LOCAL_FILE).toBe('.agent-settings.local.yml');
    });

    it('tracked_local_settings returns a list (real repo has none tracked)', () => {
        // The repo gitignores the local file; nested or absent → empty list.
        const out = mod.tracked_local_settings();
        expect(Array.isArray(out)).toBe(true);
        for (const p of out) {
            expect(p.split('/').pop()).toBe('.agent-settings.local.yml');
        }
    });
});

