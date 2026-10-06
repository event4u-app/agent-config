/**
 * road-to-modules-that-something-calls.md step 2.2.
 *
 * verify: this file. After 2.1's reading is acted on — per module, one per
 * commit — the fourth group (named in no live roadmap) is empty on the real
 * tree.
 */
import { describe, expect, it } from 'vitest';

import { analyseModuleReach } from '../../src/scripts/_lib/module_reach.js';

describe('the fourth group is empty', () => {
    it('no module under src/scripts/_lib/ is named in no live roadmap', () => {
        const { modules } = analyseModuleReach(process.cwd());
        const fourthGroup = modules.filter((m) => m.group === 'named-in-none');
        expect(fourthGroup.map((m) => m.relPath)).toStrictEqual([]);
    });
});
