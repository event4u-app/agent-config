
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    BRAND_TOKEN_PATHS,
    DEFAULT_DIRECTIVE,
    PLAN_DIRECTIVE,
    STACK_DIRECTIVES,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/scaffold.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'scaffold.py');

function tsRun(payload: Record<string, unknown>, cwd: string): string {
    const prev = process.cwd();
    process.chdir(cwd);
    try {
        const st = new DeliveryState(payload as never);
        const r = run(st);
        return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message });
    } finally {
        process.chdir(prev);
    }
}

const GF = { greenfield: true, greenfield_decision: 'scaffold' };

// Two pinned cwds: one with no tokens.json (default token-seed line), one with
// a tokens.json present (brand-source token-seed line).
let dirNoTokens: string;
let dirWithTokens: string;

beforeAll(() => {
    dirNoTokens = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-notok-'));
    dirWithTokens = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-tok-'));
    fs.writeFileSync(path.join(dirWithTokens, 'tokens.json'), '{}', 'utf8');
});

afterAll(() => {
    fs.rmSync(dirNoTokens, { recursive: true, force: true });
    fs.rmSync(dirWithTokens, { recursive: true, force: true });
});

describe('directives/ui/scaffold — TS-side unit checks', () => {
    it('constants + ambiguities', () => {
        expect(PLAN_DIRECTIVE).toBe('ui-scaffold-plan');
        expect(DEFAULT_DIRECTIVE).toBe('ui-scaffold-plain');
        expect(STACK_DIRECTIVES).toEqual({
            'blade-livewire-flux': 'ui-scaffold-blade-livewire-flux',
            'react-shadcn': 'ui-scaffold-react-shadcn',
            vue: 'ui-scaffold-vue',
            plain: 'ui-scaffold-plain',
        });
        expect([...BRAND_TOKEN_PATHS]).toEqual([
            'tokens.json',
            'assets/tokens.json',
            'resources/tokens.json',
            'agents/settings/brand/tokens.json',
        ]);
        expect(AMBIGUITIES).toHaveLength(2);
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'scaffold_plan_missing',
            'scaffold_build_pending',
        ]);
    });
});
