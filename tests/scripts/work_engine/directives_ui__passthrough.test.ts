
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/_passthrough.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', '_passthrough.py');

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message });
}

describe('directives/ui/_passthrough — TS-side unit checks', () => {
    it('AMBIGUITIES is empty', () => {
        expect(AMBIGUITIES).toHaveLength(0);
    });
    it('run never mutates state', () => {
        const st = new DeliveryState({ ticket: { id: 'X' }, memory: [{ a: 1 }] });
        const before = JSON.stringify(st);
        run(st);
        expect(JSON.stringify(st)).toBe(before);
    });
});
