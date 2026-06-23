
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    DEFAULT_SEVERITY_FLOOR,
    SEVERITY_ORDER,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/review.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'review.py');

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({
        outcome: r.outcome,
        questions: r.questions,
        message: r.message,
        ui_review: st.ui_review,
    });
}

describe('directives/ui/review — TS-side unit checks', () => {
    it('constants + ambiguities', () => {
        expect(DEFAULT_SEVERITY_FLOOR).toBe('moderate');
        expect(SEVERITY_ORDER).toEqual({ minor: 0, moderate: 1, serious: 2, critical: 3 });
        expect(AMBIGUITIES).toHaveLength(6);
    });
});
