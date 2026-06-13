// Tests for src/scripts/skill_tools/suggest_skill_for_task.ts (py2ts Phase 8 /
// Wave 8h). 1:1 port of tests/test_suggest_skill_for_task.py plus a golden
// parity layer (python3 vs tsx) over temp fixtures.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _justify,
    suggest,
} from '../../src/scripts/skill_tools/suggest_skill_for_task.js';
import {
    hasPython3,
    mkTmp,
    rmTmp,
    runBoth,
    writePersona,
    writeSkillFull,
} from './_skill_tools.js';

let tmp: string;
beforeEach(() => {
    tmp = mkTmp();
});
afterEach(() => {
    rmTmp(tmp);
});

describe('suggest_skill_for_task — pure helpers (1:1 pytest port)', () => {
    it('justify high score includes persona status', () => {
        const out = _justify('foo', 80, ['qa'], new Map([['qa', 'ok']]));
        expect(out).toContain('high keyword');
        expect(out).toContain('qa (ok)');
    });

    it('justify medium score says strong overlap', () => {
        const out = _justify('foo', 50, [], new Map());
        expect(out).toContain('strong keyword');
        expect(out).toContain('no persona');
    });

    it('justify low score warns reviewer', () => {
        const out = _justify('foo', 20, ['qa'], new Map([['qa', 'under-cited']]));
        expect(out).toContain('confirm with reviewer');
        expect(out).toContain('qa (under-cited)');
    });

    it('suggest returns at most top n', () => {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        writePersona(personas, 'frontend-engineer', 'specialist');
        for (const name of ['livewire-architect', 'form-handler', 'fe-design', 'ui-component-architect']) {
            writeSkillFull(skills, name, 'livewire reactive component dashboard', ['frontend-engineer']);
        }
        const out = suggest('livewire reactive component dashboard', skills, personas, 3);
        expect(out.length).toBe(3);
        expect(out.every((c) => 'score' in c && 'why' in c)).toBe(true);
    });

    it('suggest orders descending', () => {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        writePersona(personas, 'frontend-engineer', 'specialist');
        writeSkillFull(skills, 'exact-match', 'livewire reactive dashboard component state', ['frontend-engineer']);
        writeSkillFull(skills, 'partial-match', 'livewire only', []);
        const out = suggest('livewire reactive dashboard component state', skills, personas, 2);
        expect(out[0]!.score).toBeGreaterThanOrEqual(out[1]!.score);
        expect(out[0]!.skill).toBe('exact-match');
    });

    it('suggest empty when no matches', () => {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        fs.mkdirSync(skills, { recursive: true });
        fs.mkdirSync(personas, { recursive: true });
        const out = suggest('totally-unrelated-task', skills, personas);
        expect(out).toEqual([]);
    });

    it('suggest includes persona status for under-cited', () => {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        writePersona(personas, 'lonely', 'specialist');
        writeSkillFull(skills, 'match', 'rare specific keyword foo', ['lonely']);
        const out = suggest('rare specific keyword foo', skills, personas);
        expect(out[0]!.why).toContain('lonely (under-cited)');
    });

    it('eval three of five match target', () => {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        writePersona(personas, 'frontend-engineer', 'specialist');
        writePersona(personas, 'qa', 'specialist');
        writeSkillFull(skills, 'livewire-architect', 'shape livewire components', ['frontend-engineer']);
        writeSkillFull(skills, 'form-handler', 'design forms validation submission', ['frontend-engineer']);
        writeSkillFull(skills, 'playwright-architect', 'shape playwright e2e tests', ['qa']);
        writeSkillFull(skills, 'fe-design', 'frontend design heuristics', []);
        writeSkillFull(skills, 'tailwind-engineer', 'write tailwind utility classes', ['frontend-engineer']);
        const cases: Array<[string, string]> = [
            ['shape a livewire component', 'livewire-architect'],
            ['validation submission for forms', 'form-handler'],
            ['shape playwright e2e tests', 'playwright-architect'],
            ['frontend design heuristics', 'fe-design'],
            ['tailwind utility classes', 'tailwind-engineer'],
        ];
        let hits = 0;
        for (const [task, expected] of cases) {
            const out = suggest(task, skills, personas, 1);
            if (out.length > 0 && out[0]!.skill === expected) {
                hits += 1;
            }
        }
        expect(hits).toBeGreaterThanOrEqual(3);
    });
});

describe.runIf(hasPython3())('suggest_skill_for_task — golden parity (python3 vs tsx)', () => {
    function fixture(): { skills: string; personas: string } {
        const skills = path.join(tmp, 's');
        const personas = path.join(tmp, 'p');
        writePersona(personas, 'frontend-engineer', 'specialist');
        writePersona(personas, 'qa', 'specialist');
        writeSkillFull(skills, 'livewire-architect', 'shape livewire components reactive state', ['frontend-engineer']);
        writeSkillFull(skills, 'form-handler', 'design forms validation submission', ['frontend-engineer']);
        writeSkillFull(skills, 'playwright-architect', 'shape playwright e2e tests', ['qa']);
        return { skills, personas };
    }

    it('human output is byte-identical', () => {
        const { skills, personas } = fixture();
        const { py, ts } = runBoth('suggest_skill_for_task', [
            '--task',
            'shape a livewire component reactive state',
            '--skills-dir',
            skills,
            '--personas-dir',
            personas,
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('--json is byte-identical', () => {
        const { skills, personas } = fixture();
        const { py, ts } = runBoth('suggest_skill_for_task', [
            '--task',
            'shape a livewire component reactive state',
            '--skills-dir',
            skills,
            '--personas-dir',
            personas,
            '--json',
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('no-match human output is byte-identical', () => {
        const { skills, personas } = fixture();
        const { py, ts } = runBoth('suggest_skill_for_task', [
            '--task',
            'zzz totally unrelated nonsense',
            '--skills-dir',
            skills,
            '--personas-dir',
            personas,
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('--sample --json is byte-identical', () => {
        const { py, ts } = runBoth('suggest_skill_for_task', ['--sample', '--json']);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('missing --task exits 2 with the same error line', () => {
        const { py, ts } = runBoth('suggest_skill_for_task', []);
        expect(ts.status).toBe(2);
        expect(py.status).toBe(2);
        expect(ts.stderr.trimEnd().split('\n').pop()).toBe(py.stderr.trimEnd().split('\n').pop());
    });
});
