
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    EXPECTED_INTENT,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui_trivial/refine.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui_trivial', 'refine.py');

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message });
}

describe('directives/ui_trivial/refine — TS-side unit checks', () => {
    it('EXPECTED_INTENT + one declared ambiguity', () => {
        expect(EXPECTED_INTENT).toBe('ui-trivial');
        expect(AMBIGUITIES).toHaveLength(1);
        expect(AMBIGUITIES[0]?.code).toBe('wrong_intent_for_trivial');
    });
});
