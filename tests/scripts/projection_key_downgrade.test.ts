import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { load as yamlLoad } from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { renderSparseSettings } from '../../src/server/io/yamlIO.js';
import { sparseSettingsValues } from '../../src/server/routes/wizard.js';
import {
    DEFAULT_LEAN_PROJECTION_MODE,
    normalizeLeanProjectionMode,
} from '../../src/scripts/_lib/lean_projection_mode.js';
import { projectionModeOf } from '../../src/scripts/_lib/mcp_bridge.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE = readFileSync(join(ROOT, 'src', 'config', 'agent-settings.template.yml'), 'utf8');

const parse = (body: string): Record<string, unknown> => (yamlLoad(body) ?? {}) as Record<string, unknown>;

/**
 * Step 4.8 — downgrade stays safe.
 *
 * The scenario is a machine that installed the REMOVAL release and is then put
 * back on the previous one, whose readers still look for the keys. There is no
 * second checkout to run here, and there does not need to be: the previous
 * release's readers are the two normalisers below, and ADR-292 left both
 * untouched precisely so this direction keeps working. So the fixture is the
 * settings file the removal release actually writes, fed to the readers the
 * older release used.
 *
 * The safe answer is the FULL form on both axes. A downgrade that landed on a
 * thinning value would thin a machine whose rule layer the newer release had
 * left full — the one direction that loses bodies without anyone asking.
 */
describe('a machine downgraded past the key removal lands on the full form', () => {
    const removalRelease = parse(renderSparseSettings(sparseSettingsValues(TEMPLATE, {})));

    it('the removal release writes no projection key for an older reader to find', () => {
        expect(removalRelease['lean_projection']).toBeUndefined();
        const projection = removalRelease['projection'];
        if (projection !== undefined) {
            expect((projection as Record<string, unknown>)['rule_workspaces']).toBeUndefined();
        }
    });

    it('the older release resolves the absent lean key to eager-all', () => {
        const lean = removalRelease['lean_projection'] as Record<string, unknown> | undefined;
        expect(normalizeLeanProjectionMode(lean?.['mode'] ?? '')).toBe('eager-all');
        expect(DEFAULT_LEAN_PROJECTION_MODE).toBe('eager-all');
    });

    it('the older release resolves the absent projection mode to legacy-all', () => {
        const projection = removalRelease['projection'] as Record<string, unknown> | undefined;
        // `projection.mode` is the ONE key Phase 4 has not removed yet (4.7),
        // so this reads what the removal release still writes. Either way the
        // older reader is safe: a written `scoped` is a mode it understands,
        // and an absent one is `legacy-all`.
        expect(['scoped', 'legacy-all']).toContain(projectionModeOf(projection?.['mode']));
        expect(projectionModeOf(undefined)).toBe('legacy-all');
    });

    it('every value a PRIOR release could have written still resolves, and only the full ones keep the layer full', () => {
        // The mixed-version matrix, both directions. A downgraded machine may
        // still carry a hand-written value from before the removal; the older
        // reader normalises it, and nothing here may map an unknown or empty
        // value onto a thinning form.
        for (const [written, expected] of [
            ['', 'eager-all'],
            ['eager-all', 'eager-all'],
            ['thin', 'thin'],
            ['delivery', 'delivery'],
            ['nonsense', 'eager-all'],
        ] as const) {
            expect(normalizeLeanProjectionMode(written)).toBe(expected);
        }
        for (const [written, expected] of [
            [undefined, 'legacy-all'],
            ['legacy-all', 'legacy-all'],
            ['scoped', 'scoped'],
            // The retired value (4.5): an older reader that still understands
            // `tiered` is not harmed, and THIS reader maps it onto the full
            // surface rather than pruning on a split it no longer computes.
            ['tiered', 'legacy-all'],
            ['nonsense', 'legacy-all'],
        ] as const) {
            expect(projectionModeOf(written)).toBe(expected);
        }
    });
});
