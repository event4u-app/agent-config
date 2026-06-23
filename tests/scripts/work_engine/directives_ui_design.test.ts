
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    PLACEHOLDER_PATTERNS,
    REQUIRED_BRIEF_KEYS,
    REQUIRED_STATE_KEYS,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/design.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'design.py');

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message });
}

const fullStates = { empty: 'No items', loading: 'Loading…', error: 'Failed', success: 'Done', disabled: 'Off' };
const fullBrief = {
    layout: 'grid',
    components: [{ name: 'Card' }],
    states: fullStates,
    microcopy: { buttons: { submit: 'Save', cancel: 'Cancel' }, empty: 'Nothing here' },
    a11y: { contrast: 'AA' },
};

describe('directives/ui/design — TS-side unit checks', () => {
    it('constants + ambiguities', () => {
        expect([...REQUIRED_BRIEF_KEYS]).toEqual(['layout', 'components', 'states', 'microcopy', 'a11y']);
        expect([...REQUIRED_STATE_KEYS]).toEqual(['empty', 'loading', 'error', 'success', 'disabled']);
        expect([...PLACEHOLDER_PATTERNS]).toEqual(['<placeholder>', 'lorem', 'todo:', 'tbd', 'xxx']);
        expect(AMBIGUITIES).toHaveLength(3);
    });
});
