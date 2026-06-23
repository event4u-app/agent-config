
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    DEFAULT_DIRECTIVE,
    STACK_DIRECTIVES,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/apply.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const DESIGN_PY = path.join(WE, 'directives', 'ui', 'design.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'apply.py');

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({
        outcome: r.outcome,
        questions: r.questions,
        message: r.message,
        changes: st.changes,
    });
}

describe('directives/ui/apply — TS-side unit checks', () => {
    it('directives map + fallback + ambiguities', () => {
        expect(DEFAULT_DIRECTIVE).toBe('ui-apply-plain');
        expect(STACK_DIRECTIVES['react-shadcn']).toBe('ui-apply-react-shadcn');
        expect(AMBIGUITIES).toHaveLength(2);
    });
    it('imports PLACEHOLDER_PATTERNS from the design twin (not the .py)', () => {
        const st = new DeliveryState({
            ticket: { ui_apply: { rendered: { x: 'xxx' }, files: ['x.tsx'] } },
        } as never);
        expect(run(st).outcome).toBe('blocked');
    });
});
