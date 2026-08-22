import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { GLOBAL_RULE_DIRS, hostLayerCarries } from '../../src/install/globalRuleLayers.js';

/**
 * Phase 2.1's verify clause: "sabotage in both directions — temporarily rename one
 * global layer, assert the predicate flips to false and the projection goes back
 * to full; restore, assert it flips back. A predicate never seen false proves
 * nothing."
 *
 * The rename is done inside a temp HOME rather than against the real one. Renaming
 * the operator's actual `~/.cursor/rules` would work and is what the roadmap step
 * describes, but a test that moves a live global layer is a test that can leave the
 * machine broken when it fails halfway — the same sabotage, made re-runnable.
 */
describe('hostLayerCarries — sabotage in both directions', () => {
    const homes: string[] = [];

    afterEach(() => {
        for (const h of homes.splice(0)) fs.rmSync(h, { recursive: true, force: true });
    });

    const seed = (toolId: string, names: readonly string[]): string => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hlc-'));
        homes.push(home);
        const dir = path.join(home, GLOBAL_RULE_DIRS[toolId]!);
        fs.mkdirSync(dir, { recursive: true });
        for (const n of names) fs.writeFileSync(path.join(dir, n), '# x\n');
        return home;
    };

    it.each(Object.keys(GLOBAL_RULE_DIRS))(
        '%s: carries → renamed away → false → restored → carries',
        (toolId) => {
            const want = ['direct-answers.md', 'scope-control.md'];
            const home = seed(toolId, want);
            const dir = path.join(home, GLOBAL_RULE_DIRS[toolId]!);
            const moved = `${dir}.sabotaged`;

            // Direction 1: the layer is there and carries what we would withhold.
            expect(hostLayerCarries(toolId, want, home).carries).toBe(true);

            // Direction 2: rename it away. The predicate must refuse, and it must
            // say WHY — 'layer-absent', not a bare false, so a caller can report
            // which host lost its evidence.
            fs.renameSync(dir, moved);
            const during = hostLayerCarries(toolId, want, home);
            expect(during.carries).toBe(false);
            expect(during.reason).toBe('layer-absent');
            expect(during.missing).toEqual(want);

            // Direction 3: restore. A predicate that stays false after the cause is
            // removed is a cache bug, and this is the assertion that would catch it.
            fs.renameSync(moved, dir);
            expect(hostLayerCarries(toolId, want, home).carries).toBe(true);
        },
    );

    it('a partially populated layer refuses, and names only what is missing', () => {
        const home = seed('cursor', ['direct-answers.mdc']);
        const v = hostLayerCarries('cursor', ['direct-answers.md', 'scope-control.md'], home);
        expect(v.carries).toBe(false);
        expect(v.missing).toEqual(['scope-control.md']);
    });

    it('is not memoised — two reads of a changing layer disagree', () => {
        // partitionActive memoises per process by design (the fingerprint costs
        // ~100ms). This predicate must NOT, because a generator run can create the
        // layer it is asking about. Pinned so an optimisation cannot silently add a
        // cache that makes the sabotage test above pass for the wrong reason.
        const home = seed('claude-code', []);
        const dir = path.join(home, GLOBAL_RULE_DIRS['claude-code']!);
        expect(hostLayerCarries('claude-code', ['a.md'], home).carries).toBe(false);
        fs.writeFileSync(path.join(dir, 'a.md'), '# x\n');
        expect(hostLayerCarries('claude-code', ['a.md'], home).carries).toBe(true);
    });
});
