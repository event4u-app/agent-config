// Tests for src/scripts/skill_tools/score_skill_relevance.ts (py2ts Phase 8 /
// Wave 8h). 1:1 port of tests/test_score_skill_relevance.py plus a golden
// parity layer (python3 vs tsx) over temp fixtures.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _parse_frontmatter,
    _tokenize,
    rank,
} from '../../src/scripts/skill_tools/score_skill_relevance.js';
import { hasPython3, mkTmp, rmTmp, runBoth, writeSkill } from './_skill_tools.js';

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

describe.runIf(hasPython3())('score_skill_relevance — golden parity (python3 vs tsx)', () => {
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

    it('human table is byte-identical', () => {
        const sk = path.join(tmp, 'skills');
        fixture(sk);
        const { py, ts } = runBoth('score_skill_relevance', [
            '--task',
            'build a livewire component reactive state form',
            '--skills-dir',
            sk,
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('--json is byte-identical', () => {
        const sk = path.join(tmp, 'skills');
        fixture(sk);
        const { py, ts } = runBoth('score_skill_relevance', [
            '--task',
            'build a livewire component reactive state form',
            '--skills-dir',
            sk,
            '--json',
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('--sample --json is byte-identical', () => {
        const { py, ts } = runBoth('score_skill_relevance', ['--sample', '--json']);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('--top truncation is byte-identical', () => {
        const sk = path.join(tmp, 'skills');
        fixture(sk);
        const { py, ts } = runBoth('score_skill_relevance', [
            '--task',
            'livewire component form terraform',
            '--skills-dir',
            sk,
            '--top',
            '1',
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('missing --task exits 2 with the same error line', () => {
        const { py, ts } = runBoth('score_skill_relevance', []);
        expect(ts.status).toBe(2);
        expect(py.status).toBe(2);
        // argparse prints a usage preamble before the error line; compare only
        // the stable trailing `PROG: error: …` line (contract: prose excluded).
        expect(ts.stderr.trimEnd().split('\n').pop()).toBe(py.stderr.trimEnd().split('\n').pop());
    });

    it('invalid --top exits 2 with the same error line', () => {
        const { py, ts } = runBoth('score_skill_relevance', ['--task', 'x', '--top', 'zz']);
        expect(ts.status).toBe(2);
        expect(py.status).toBe(2);
        expect(ts.stderr.trimEnd().split('\n').pop()).toBe(py.stderr.trimEnd().split('\n').pop());
    });
});
