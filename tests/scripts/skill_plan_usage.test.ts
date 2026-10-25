import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appliedSkills, parsePlan, planUsage, renderUsage } from '../../src/scripts/skill_plan_usage.js';

const ROADMAP = `# Road to x

- [x] **1.1 Fix the login.** Text.
      uses: security-audit, test-driven-development
      verify: true
- [ ] **1.2 Write the doc.**
      uses: readme-writing
      waived: readme-writing — already-satisfied
- [ ] **1.3 Port it.**
      uses: laravel
      waived: laravel — because I felt like it
`;

function assistant(content: unknown[]): string {
    return JSON.stringify({ type: 'assistant', message: { content } });
}

let dir: string;
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-usage-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('parsePlan', () => {
    it('reads uses and waived lines per step, and flags a reason outside the closed set', () => {
        const plan = parsePlan(ROADMAP);
        expect(plan.steps).toBe(3);
        expect(plan.planned).toEqual([
            { skill: 'security-audit', step: '1.1' },
            { skill: 'test-driven-development', step: '1.1' },
            { skill: 'readme-writing', step: '1.2' },
            { skill: 'laravel', step: '1.3' },
        ]);
        expect(plan.waived).toEqual([{ skill: 'readme-writing', step: '1.2', reason: 'already-satisfied' }]);
        expect(plan.invalidWaivers).toEqual([{ skill: 'laravel', step: '1.3', reason: 'because I felt like it' }]);
    });

    it('accepts superseded-by with a skill name', () => {
        const plan = parsePlan('- [ ] **2.1 S.**\n      uses: a\n      waived: a — superseded-by:b\n');
        expect(plan.waived).toEqual([{ skill: 'a', step: '2.1', reason: 'superseded-by:b' }]);
    });
});

describe('appliedSkills', () => {
    it('counts a Skill call and a SKILL.md read, never a prose mention', () => {
        const file = path.join(dir, 's.jsonl');
        fs.writeFileSync(
            file,
            [
                assistant([{ type: 'tool_use', name: 'Skill', input: { skill: 'security-audit' } }]),
                assistant([{ type: 'tool_use', name: 'Read', input: { file_path: '/x/.claude/skills/systematic-debugging/SKILL.md' } }]),
                assistant([{ type: 'text', text: 'I applied test-driven-development thoroughly.' }]),
                assistant([{ type: 'tool_use', name: 'Read', input: { file_path: '/x/src/skills/notes.md' } }]),
                'not json',
            ].join('\n'),
        );
        expect([...appliedSkills([file])].sort()).toEqual(['security-audit', 'systematic-debugging']);
    });
});

describe('planUsage', () => {
    it('reads applied, waived and missing per planned skill, and unplanned applied skills', () => {
        const rep = planUsage(parsePlan(ROADMAP), new Set(['security-audit', 'systematic-debugging']));
        const by = Object.fromEntries(rep.rows.map((r) => [r.skill, r.state]));
        expect(by).toEqual({
            'security-audit': 'applied',
            'test-driven-development': 'missing',
            'readme-writing': 'waived',
            laravel: 'missing',
        });
        expect(rep.unplanned).toEqual(['systematic-debugging']);
        const text = renderUsage(rep);
        expect(text).toContain('missing   test-driven-development (1.1)');
        expect(text).toContain('rules: not-observable');
        expect(text).toContain('invalid waiver: laravel (1.3)');
    });
});
