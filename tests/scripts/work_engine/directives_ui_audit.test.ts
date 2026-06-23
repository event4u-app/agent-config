
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    STRONG_SIMILARITY,
    TESTED_AGAINST_SHADCN_MAJOR,
    TIE_GAP,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/audit.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'audit.py');

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({
        outcome: r.outcome,
        questions: r.questions,
        message: r.message,
        ui_audit: st.ui_audit,
    });
}

describe('directives/ui/audit — TS-side unit checks', () => {
    it('constants + ambiguities', () => {
        expect(STRONG_SIMILARITY).toBe(0.7);
        expect(TIE_GAP).toBe(0.05);
        expect(TESTED_AGAINST_SHADCN_MAJOR).toBe(2);
        expect(AMBIGUITIES).toHaveLength(4);
    });
});
