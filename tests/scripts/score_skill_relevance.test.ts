// Tests for src/scripts/skill_tools/score_skill_relevance.ts (py2ts Phase 8 /
// Wave 8h). 1:1 port of the retired pytest suite plus a CLI intent layer
// (tsx only — the Python original is deleted) over temp fixtures.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _parse_frontmatter,
    _tokenize,
    rank,
} from '../../src/scripts/skill_tools/score_skill_relevance.js';
import { REPO_ROOT, TOOLS_DIR, TSX_BIN, mkTmp, rmTmp, writeSkill } from './_skill_tools.js';

function runTsx(module: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
    const r = spawnSync(TSX_BIN, [path.join(TOOLS_DIR, `${module}.ts`), ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

let tmp: string;
beforeEach(() => {
    tmp = mkTmp();
});
afterEach(() => {
    rmTmp(tmp);
});

describe('score_skill_relevance — pure helpers (1:1 pytest port)', () => {
    it('tokenize drops stopwords and short tokens', () => {
        const out = _tokenize('Use this skill to fix a bug in the code');
        expect(out.has('fix')).toBe(true);
        expect(out.has('bug')).toBe(true);
        expect(out.has('the')).toBe(false);
        expect(out.has('to')).toBe(false);
    });

    it('parse_frontmatter handles list', () => {
        const f = path.join(tmp, 'SKILL.md');
        fs.writeFileSync(
            f,
            '---\n' +
                'name: demo\n' +
                'description: "hello"\n' +
                'personas:\n' +
                '  - frontend-engineer\n' +
                '  - qa\n' +
                '---\nbody\n',
            'utf-8',
        );
        const fm = _parse_frontmatter(f);
        expect(fm['name']).toBe('demo');
        expect(fm['description']).toBe('hello');
        expect(fm['personas']).toEqual(['frontend-engineer', 'qa']);
    });

    it('rank keyword overlap', () => {
        writeSkill(
            tmp,
            'livewire-architect',
            'name: livewire-architect\n' +
                'description: "Use when shaping a livewire component reactive state"',
        );
        writeSkill(
            tmp,
            'terraform',
            'name: terraform\n' + 'description: "Use when writing terraform AWS modules"',
        );
        const rows = rank('build a livewire component', tmp);
        expect(rows[0]![0]).toBe('livewire-architect');
        expect(rows[0]![1]).toBeGreaterThan(0);
    });

    it('rank persona match bonus', () => {
        writeSkill(
            tmp,
            'form-handler',
            'name: form-handler\n' + 'description: "design a form"\n' + 'personas:\n  - frontend-engineer',
        );
        writeSkill(tmp, 'no-persona', 'name: no-persona\n' + 'description: "design a form"');
        const rows = rank('frontend-engineer review this form', tmp);
        const by = new Map(rows.map(([n, s]) => [n, s]));
        expect(by.get('form-handler')!).toBeGreaterThan(by.get('no-persona')!);
    });

    it('rank filters zero scores', () => {
        writeSkill(
            tmp,
            'irrelevant',
            'name: irrelevant\n' + 'description: "totally unrelated content"',
        );
        const rows = rank('python debugging asyncio', tmp);
        expect(rows.every(([, score]) => score > 0)).toBe(true);
    });

    it('rank descending with name tiebreak', () => {
        writeSkill(tmp, 'alpha', 'name: alpha\n' + 'description: "fix bug fast"');
        writeSkill(tmp, 'beta', 'name: beta\n' + 'description: "fix bug fast"');
        const rows = rank('fix bug fast', tmp);
        expect(rows[0]![1]).toBe(rows[1]![1]);
        expect(rows[0]![0]).toBe('alpha');
    });

    it('score capped at 100', () => {
        writeSkill(
            tmp,
            'match-all',
            'name: livewire dashboard reactive state\n' +
                'description: "livewire dashboard reactive state"\n' +
                'personas:\n  - frontend-engineer',
        );
        const rows = rank('livewire dashboard reactive state frontend-engineer', tmp);
        expect(rows[0]![1]).toBeLessThanOrEqual(100);
    });

    it('empty skills dir', () => {
        const rows = rank('anything', tmp);
        expect(rows).toEqual([]);
    });

    it('empty task returns empty', () => {
        writeSkill(tmp, 'demo', 'name: demo\ndescription: "anything"');
        const rows = rank('', tmp);
        expect(rows).toEqual([]);
    });
});

describe('score_skill_relevance — CLI (tsx)', () => {
    function fixture(dir: string): void {
        writeSkill(
            dir,
            'livewire-architect',
            'name: livewire-architect\n' +
                'description: "Use when shaping a livewire component reactive state dashboard"\n' +
                'personas:\n  - frontend-engineer',
        );
        writeSkill(dir, 'terraform', 'name: terraform\n' + 'description: "Use when writing terraform AWS modules"');
        writeSkill(
            dir,
            'form-handler',
            'name: form-handler\n' + 'description: "design a form validation submission"\n' + 'personas:\n  - frontend-engineer',
        );
    }

    interface RankedJson {
        task: string;
        ranked: Array<{ name: string; score: number; personas: string[] }>;
    }

    it('human table ranks matching skills, best first, zero-score dropped', () => {
        const sk = path.join(tmp, 'skills');
        fixture(sk);
        const r = runTsx('score_skill_relevance', [
            '--task',
            'build a livewire component reactive state form',
            '--skills-dir',
            sk,
        ]);
        expect(r.status, r.stderr).toBe(0);
        const lines = r.stdout.trimEnd().split('\n');
        expect(lines.length).toBe(2);
        expect(lines[0]).toContain('livewire-architect');
        expect(lines[0]).toContain('frontend-engineer');
        expect(lines[1]).toContain('form-handler');
        expect(r.stdout).not.toContain('terraform');
    });

    it('--json emits the ranked rows with scores + personas', () => {
        const sk = path.join(tmp, 'skills');
        fixture(sk);
        const r = runTsx('score_skill_relevance', [
            '--task',
            'build a livewire component reactive state form',
            '--skills-dir',
            sk,
            '--json',
        ]);
        expect(r.status, r.stderr).toBe(0);
        const out = JSON.parse(r.stdout) as RankedJson;
        expect(out.task).toBe('build a livewire component reactive state form');
        expect(out.ranked.map((row) => row.name)).toEqual(['livewire-architect', 'form-handler']);
        expect(out.ranked[0]!.score).toBeGreaterThan(out.ranked[1]!.score);
        expect(out.ranked[0]!.personas).toEqual(['frontend-engineer']);
    });

    it('--sample --json runs the built-in sample task and emits valid JSON', () => {
        const r = runTsx('score_skill_relevance', ['--sample', '--json']);
        expect(r.status, r.stderr).toBe(0);
        const out = JSON.parse(r.stdout) as RankedJson;
        expect(typeof out.task).toBe('string');
        expect(out.task.length).toBeGreaterThan(0);
        expect(Array.isArray(out.ranked)).toBe(true);
    });

    it('--top truncates the table to n rows', () => {
        const sk = path.join(tmp, 'skills');
        fixture(sk);
        const r = runTsx('score_skill_relevance', [
            '--task',
            'livewire component form terraform',
            '--skills-dir',
            sk,
            '--top',
            '1',
        ]);
        expect(r.status, r.stderr).toBe(0);
        const lines = r.stdout.trimEnd().split('\n');
        expect(lines.length).toBe(1);
        expect(lines[0]).toContain('livewire-architect');
    });

    it('missing --task exits 2 with the argparse-style error line', () => {
        const r = runTsx('score_skill_relevance', []);
        expect(r.status).toBe(2);
        expect(r.stderr.trimEnd().split('\n').pop()).toBe(
            'score_skill_relevance.py: error: --task is required (or pass --sample)',
        );
    });

    it('invalid --top exits 2 with the argparse-style error line', () => {
        const r = runTsx('score_skill_relevance', ['--task', 'x', '--top', 'zz']);
        expect(r.status).toBe(2);
        expect(r.stderr.trimEnd().split('\n').pop()).toBe(
            "score_skill_relevance.py: error: argument --top: invalid int value: 'zz'",
        );
    });
});
