
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    A11Y_VIOLATION_KIND,
    AMBIGUITIES,
    POLISH_CEILING,
    TOKEN_REPEAT_THRESHOLD,
    TOKEN_VIOLATION_KIND,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/polish.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'polish.py');

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message });
}

const tokenFinding = (value: string) => ({ kind: 'token_violation', category: 'colors', value });
const a11yFinding = (rule: string) => ({ kind: 'a11y_violation', rule, selector: `.${rule}`, severity: 'serious' });

describe('directives/ui/polish — TS-side unit checks', () => {
    it('constants + ambiguities', () => {
        expect(POLISH_CEILING).toBe(2);
        expect(TOKEN_REPEAT_THRESHOLD).toBe(2);
        expect(A11Y_VIOLATION_KIND).toBe('a11y_violation');
        expect(TOKEN_VIOLATION_KIND).toBe('token_violation');
        expect(AMBIGUITIES).toHaveLength(4);
    });
});
