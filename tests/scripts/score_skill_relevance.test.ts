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

// The candidate signals (road-to-a-ranker-that-routes 2.2). Each is a flag, each
// is off by default, and the property that matters most is the one asserted
// first: with every flag off the ranking is the one the Python-parity suite
// above pins. A signal that silently changed the default would make every
// figure in this tree's ranker evidence a figure about something else.
describe('candidate ranking signals — off by default, measurable alone', () => {
    /** A SKILL.md with a real body — the shared helper only writes a heading. */
    function skillWithBody(dir: string, slug: string, desc: string, body: string): void {
        const f = path.join(dir, slug, 'SKILL.md');
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, `---\nname: ${slug}\ndescription: "${desc}"\n---\n\n# ${slug}\n\n${body}`, 'utf-8');
    }

    /**
     * `containers` is on three skills, `schemas` on one.
     *
     * That asymmetry is what makes the idf case decidable: a prompt naming both
     * matches exactly one term on `alpha` and exactly one on `beta`, so the
     * unweighted score ties and the alphabetical tiebreak decides it.
     */
    function catalogue(dir: string): void {
        skillWithBody(
            dir,
            'alpha',
            'Containers and images.',
            '## When to use\n\nWhen a kubernetes pod will not schedule.\n\n## Procedure\n\nunrelated prose\n',
        );
        skillWithBody(dir, 'beta', 'Schemas and indexes.', '## Gotchas\n\nnone\n');
        skillWithBody(dir, 'gamma', 'Containers at runtime.', '');
        skillWithBody(dir, 'delta', 'Containers in production.', '');
    }

    it('with no options the score is the name+description one, unchanged', () => {
        catalogue(tmp);
        expect(rank('containers and images', tmp)).toEqual(rank('containers and images', tmp, {}));
    });

    it('includeWhenToUse surfaces a skill its description never mentions', () => {
        // The failing direction is the point: without the flag the prompt scores
        // nothing against `alpha`, because `kubernetes` lives only in the body.
        catalogue(tmp);
        expect(rank('kubernetes pod will not schedule', tmp).map((r) => r[0])).not.toContain('alpha');
        expect(
            rank('kubernetes pod will not schedule', tmp, { includeWhenToUse: true }).map((r) => r[0]),
        ).toContain('alpha');
    });

    it('includeHeadings indexes a section title and not the prose under it', () => {
        catalogue(tmp);
        expect(rank('gotchas', tmp, { includeHeadings: true }).map((r) => r[0])).toContain('beta');
        // `unrelated prose` sits under a heading; it is not a heading.
        expect(rank('unrelated prose', tmp, { includeHeadings: true }).map((r) => r[0])).not.toContain(
            'alpha',
        );
    });

    it('idfWeighting lets a rare matched term outweigh a common one', () => {
        catalogue(tmp);
        const plain = rank('containers schemas', tmp);
        const byNamePlain = Object.fromEntries(plain.map((r) => [r[0], r[1]]));
        expect(byNamePlain['alpha'], 'unweighted: one matched term each').toBe(byNamePlain['beta']);
        expect(plain[0]?.[0], 'unweighted the alphabetical tiebreak decides').toBe('alpha');

        const weighted = rank('containers schemas', tmp, { idfWeighting: true });
        expect(weighted[0]?.[0], 'weighted the rare term wins').toBe('beta');
    });
});

// 3.2 — the promoted configuration has to fit the slot it would run in.
describe('latency — per-prompt ranking cost against the pre_tool_use budget', () => {
    const BUDGET_FILE = path.join(REPO_ROOT, 'src', 'config', 'hook-latency-budget.json');

    function p95(xs: readonly number[]): number {
        const s = [...xs].sort((a, b) => a - b);
        return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)] as number;
    }

    function measure(opts: Parameters<typeof rank>[2], runs: number): number {
        const prompts = [
            'add an index to the orders table and write the migration',
            'review this pull request for security problems',
            'build a component for the user dashboard with reactive state',
            'run the migration inside the app container',
            'write a roadmap for the next quarter of frontend work',
        ];
        const dir = path.join(REPO_ROOT, 'src', 'skills');
        for (let i = 0; i < 3; i += 1) rank(prompts[i] as string, dir, opts);
        const t: number[] = [];
        for (let i = 0; i < runs; i += 1) {
            const at = performance.now();
            rank(prompts[i % prompts.length] as string, dir, opts);
            t.push(performance.now() - at);
        }
        return p95(t);
    }

    it('the budget is read from the registered file, never from a constant here', () => {
        // A test carrying its own copy of the number would keep passing after the
        // budget moved, which is the one thing a budget check must not do.
        const budget = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf-8')) as {
            budgets_ms: { pre_tool_use: { p95_ci: number } };
        };
        expect(budget.budgets_ms.pre_tool_use.p95_ci).toBeGreaterThan(0);
    });

    it('the default ranker and the best candidate both fit inside it', () => {
        const budget = (
            JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf-8')) as {
                budgets_ms: { pre_tool_use: { p95_ci: number } };
            }
        ).budgets_ms.pre_tool_use.p95_ci;
        // Absolute, against the registered cap, and nothing tighter. Measured on
        // a developer machine the two sit near 12 ms against a 175 ms cap, so the
        // assertion has an order of magnitude of headroom — which is deliberate:
        // this tree's own hook-latency gate is the one check that fails on a
        // loaded runner rather than on a diff, and a tight self-imposed bar here
        // would reproduce that defect in a unit test.
        expect(measure({}, 12), 'keyword-v1 p95 ms').toBeLessThan(budget);
        expect(measure({ idfWeighting: true }, 12), 'idf p95 ms').toBeLessThan(budget);
    }, 60_000);
});
