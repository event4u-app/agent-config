
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    INTEGRATION_TEST_DIRECTIVE,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/mixed/stitch.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'mixed', 'stitch.py');

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message });
}

describe('directives/mixed/stitch — TS-side unit checks', () => {
    it('directive name + ambiguities', () => {
        expect(INTEGRATION_TEST_DIRECTIVE).toBe('integration-test');
        expect(AMBIGUITIES).toHaveLength(4);
    });
});
