// The arms compared against the frozen routing baseline — pressure (3.1),
// twins (3.2) and the MCP path (4.1): built from the baseline's own cases and
// refused against any other catalogue.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { catalogueHash, type BaselineArtifact } from '../../src/scripts/compile_trigger_evals.js';
import {
    MCP_READ_TOOL,
    buildMcpArm,
    buildPressureArm,
    buildTwinArm,
    mcpGraderBody,
    armReport,
    mergeAggregates,
    pairedRecall,
    pressureNull,
    twinConfusion,
} from '../../src/scripts/routing_arms.js';

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'routing-arms-'));
    dirs.push(d);
    return d;
}

function fixture(): { skills: string; catalogue: string; art: BaselineArtifact } {
    const root = tmp();
    const skills = path.join(root, 'src-skills');
    const catalogue = path.join(root, 'catalogue');
    for (let i = 0; i < 30; i += 1) {
        const s = `skill-${String(i).padStart(2, '0')}`;
        fs.mkdirSync(path.join(catalogue, s), { recursive: true });
        fs.writeFileSync(path.join(catalogue, s, 'SKILL.md'), `---\nname: ${s}\ndescription: about ${s}\n---\n`);
    }
    for (const s of ['skill-03', 'skill-17']) {
        fs.mkdirSync(path.join(skills, s, 'evals'), { recursive: true });
        fs.writeFileSync(
            path.join(skills, s, 'evals', 'triggers.json'),
            JSON.stringify({ queries: [{ id: 'p1', q: `use ${s}`, trigger: true }, { id: 'p2', q: `again ${s}`, trigger: true }] }),
        );
    }
    const art = {
        catalogue_sha256: catalogueHash(catalogue),
        cases: [
            { case: '1-skill-03-p1', skill: 'skill-03', id: 'p1' },
            { case: '2-skill-17-p1', skill: 'skill-17', id: 'p1' },
        ],
    } as unknown as BaselineArtifact;
    return { skills, catalogue, art };
}

describe('buildPressureArm — 3.1', () => {
    it('one target per baseline case, N skills each, the unit always among them, same case name', () => {
        const { skills, catalogue, art } = fixture();
        const out = path.join(tmp(), 'arm');
        const plan = buildPressureArm({ art, skillsRoot: skills, catalogueRoot: catalogue, n: 12, seed: 's', outRoot: out });
        expect(plan.rows.map((r) => r.case)).toEqual(['1-skill-03-p1', '2-skill-17-p1']);
        for (const r of plan.rows) {
            const root = (plan.plugins as Record<string, string>)[r.case] as string;
            const listed = fs.readdirSync(path.join(root, 'skills'));
            expect(listed).toHaveLength(12);
            expect(listed).toContain(r.skill);
            expect(fs.existsSync(path.join(root, 'evals', r.case, 'prompt.md'))).toBe(true);
        }
    });

    it('is reproducible: the same seed gives the same subsets', () => {
        const { skills, catalogue, art } = fixture();
        const a = buildPressureArm({ art, skillsRoot: skills, catalogueRoot: catalogue, n: 12, seed: 's', outRoot: path.join(tmp(), 'a') });
        const b = buildPressureArm({ art, skillsRoot: skills, catalogueRoot: catalogue, n: 12, seed: 's', outRoot: path.join(tmp(), 'b') });
        expect(a.subsets).toEqual(b.subsets);
    });

    it('refuses a catalogue that is not the baseline catalogue', () => {
        const { skills, catalogue, art } = fixture();
        fs.writeFileSync(path.join(catalogue, 'skill-05', 'SKILL.md'), '---\nname: skill-05\ndescription: edited\n---\n');
        expect(() =>
            buildPressureArm({ art, skillsRoot: skills, catalogueRoot: catalogue, n: 12, seed: 's', outRoot: path.join(tmp(), 'x') }),
        ).toThrow(/not the baseline/);
    });
});

describe('buildTwinArm — 3.2', () => {
    it('injects one twin per pair, archives its text, and compiles up to perUnit positives', () => {
        const { skills, catalogue, art } = fixture();
        const out = path.join(tmp(), 'twins');
        const plan = buildTwinArm({ art, skillsRoot: skills, catalogueRoot: catalogue, twins: { 'skill-03': 'a paraphrase' }, perUnit: 2, outRoot: out });
        expect(fs.existsSync(path.join(out, 'skills', 'skill-03-twin', 'SKILL.md'))).toBe(true);
        expect(plan.twin_texts['skill-03']).toContain('a paraphrase');
        expect(plan.rows).toHaveLength(2);
        expect(plan.rows.every((r) => r.skill === 'skill-03')).toBe(true);
    });
});

describe('buildMcpArm — 4.1', () => {
    it('carries no native skills, registers the server, and grades read_skill for the unit', () => {
        const { skills, catalogue, art } = fixture();
        const out = path.join(tmp(), 'mcp');
        const plan = buildMcpArm({ art, skillsRoot: skills, catalogueRoot: catalogue, serverCommand: 'node', serverArgs: ['srv.mjs'], outRoot: out });
        expect(fs.existsSync(path.join(out, 'skills'))).toBe(false);
        expect(JSON.parse(fs.readFileSync(path.join(out, '.mcp.json'), 'utf8')).mcpServers['agent-config'].args).toEqual(['srv.mjs']);
        const grader = fs.readFileSync(path.join(out, 'evals', plan.rows[0]?.case as string, 'graders', 'criteria.md'), 'utf8');
        expect(grader).toContain(`tool: ${MCP_READ_TOOL}`);
        const prompt = fs.readFileSync(path.join(out, 'evals', plan.rows[0]?.case as string, 'prompt.md'), 'utf8');
        expect(prompt).toContain(MCP_READ_TOOL);
    });

    it('the input pattern matches the whole name only', () => {
        const m = /input_match: '(.*)'/.exec(mcpGraderBody('code-review'))?.[1] as string;
        const re = new RegExp(m);
        expect(re.test('{"name":"code-review"}')).toBe(true);
        expect(re.test('{"name":"requesting-code-review"}')).toBe(false);
        expect(re.test('{"name":"code-review-twin"}')).toBe(false);
    });
});

describe('mergeAggregates', () => {
    it('adds costs, keeps case order and reports a missing result as partial', () => {
        const dir = tmp();
        fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify({ costUsd: 0.1, claudeVersion: '2.1.311', startedAt: 't1', cases: [{ name: 'a' }] }));
        const plan = { rows: [{ case: 'a' }, { case: 'b' }] } as never;
        const { aggregate, missing } = mergeAggregates(plan, dir);
        expect(missing).toEqual(['b']);
        expect(aggregate['partial']).toBe(true);
        expect(aggregate['costUsd']).toBe(0.1);
    });
});

describe('armReport — 3.1, 3.3, 3.2 and 4.2/4.3', () => {
    const u = (unit: string, recall: number | null) => ({ unit, n: recall === null ? 0 : 1, fired: recall === 1 ? 1 : 0, unknown: recall === null ? 1 : 0, recall });
    it('pairs recall over units measured in both, dropping an UNKNOWN unit from that comparison only', () => {
        const p = pairedRecall([u('a', 1), u('b', 0), u('c', 1)], [u('a', 1), u('b', 1), u('c', null)]);
        expect(p).toEqual({ units: 2, baseline: 0.5, arm: 1 });
    });
    it('the null holds iff acc(full) >= acc(20) - 0.10, at the boundary and either side of it', () => {
        expect(pressureNull(0.7, 0.8).holds).toBe(true);
        expect(pressureNull(0.69, 0.8).holds).toBe(false);
        expect(pressureNull(0.9, 0.8).holds).toBe(true);
    });
    it('parity is breached when the MCP path undercuts native by more than epsilon, and only then', () => {
        const r = armReport({ baseline: [u('a', 1), u('b', 1)], arms: { mcp: [u('a', 1), u('b', 0)] } });
        expect(r.parity?.verdict.breached).toBe(true);
        const ok = armReport({ baseline: [u('a', 1), u('b', 1)], arms: { mcp: [u('a', 1), u('b', 1)] } });
        expect(ok.parity?.verdict.breached).toBe(false);
    });
    it('counts twin confusion per pair from the invoked names, an unread trace being UNKNOWN', () => {
        const rows = [
            { skill: 'x', verdict: 'fired' as const, invoked: ['x'] },
            { skill: 'x', verdict: 'not-fired' as const, invoked: ['x-twin'] },
            { skill: 'x', verdict: 'fired' as const, invoked: ['x', 'x-twin'] },
            { skill: 'x', verdict: 'not-fired' as const, invoked: [] },
            { skill: 'x', verdict: 'fired' as const, invoked: null },
        ];
        expect(twinConfusion(rows)).toEqual([
            { pair: 'x', runs: 4, original_only: 1, twin_only: 1, both: 1, neither: 1, unknown: 1, confusion: 0.5 },
        ]);
    });
});
