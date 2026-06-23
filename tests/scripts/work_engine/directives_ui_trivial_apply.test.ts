
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    MAX_FILES,
    MAX_LINES_CHANGED,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui_trivial/apply.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui_trivial', 'apply.py');

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({
        outcome: r.outcome,
        questions: r.questions,
        message: r.message,
        ticket: st.ticket,
        changes: st.changes,
    });
}

describe('directives/ui_trivial/apply — TS-side unit checks', () => {
    it('ceilings + ambiguities', () => {
        expect(MAX_FILES).toBe(1);
        expect(MAX_LINES_CHANGED).toBe(5);
        expect(AMBIGUITIES).toHaveLength(2);
    });
});
