
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/app_spec.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'app_spec.py');

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message });
}

const GF = { greenfield: true, greenfield_decision: 'scaffold' };
const longTitle = 'word '.repeat(40).trim();

describe('directives/ui/app_spec — TS-side unit checks', () => {
    it('ambiguities', () => {
        expect(AMBIGUITIES).toHaveLength(2);
        expect(AMBIGUITIES.map((a) => a.code)).toEqual(['app_spec_missing', 'app_spec_unconfirmed']);
    });
});
