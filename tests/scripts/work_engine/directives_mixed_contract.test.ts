
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    REQUIRED_CONTRACT_KEYS,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/mixed/contract.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'mixed', 'contract.py');

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message });
}

const longTitle = 'A'.repeat(120);

describe('directives/mixed/contract — TS-side unit checks', () => {
    it('required keys + ambiguities', () => {
        expect([...REQUIRED_CONTRACT_KEYS]).toEqual(['data_model', 'api_surface']);
        expect(AMBIGUITIES).toHaveLength(4);
    });
});
