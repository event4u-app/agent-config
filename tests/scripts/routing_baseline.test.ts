// The routing baseline's rules as code — `road-to-routing-assurance-live-floors`
// 0.2 (selection, ingestion), 0.4 (floors) and 5.3 (regression states).

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    classifyRow,
    classifyRun,
    deriveFloors,
    ingestCases,
    invokedFromTrace,
    selectBaseline,
    sha256,
    unitRows,
    type CaseRow,
} from '../../src/scripts/_lib/routing_baseline.js';
import { buildArtifact, buildBaselinePlugin, main, type LabelledQuery } from '../../src/scripts/compile_trigger_evals.js';

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'routing-baseline-'));
    dirs.push(d);
    return d;
}

function q(skill: string, id: string, trigger: boolean): LabelledQuery {
    return { skill, id, query: `${skill} ${id}`, trigger, cls: trigger ? 'exemplar' : 'near-miss' };
}

const corpus: LabelledQuery[] = [];
for (const s of ['alpha', 'beta', 'gamma', 'delta', 'epsilon']) {
    corpus.push(q(s, 'p1', true), q(s, 'p2', true), q(s, 'p3', true), q(s, 'n1', false));
}

describe('selectBaseline — 0.2 selection is a rule, not a choice', () => {
    it('is deterministic: the same corpus gives the same selection in any input order', () => {
        const a = selectBaseline(corpus, 3);
        const b = selectBaseline([...corpus].reverse(), 3);
        expect(a.map((x) => `${x.skill}/${x.id}`)).toEqual(b.map((x) => `${x.skill}/${x.id}`));
    });

    it('takes positives only, one per unit by default, for exactly `units` units', () => {
        const got = selectBaseline(corpus, 3);
        expect(got).toHaveLength(3);
        expect(got.every((x) => x.trigger)).toBe(true);
        expect(new Set(got.map((x) => x.skill)).size).toBe(3);
    });

    it('honours perUnit and never selects more units than exist', () => {
        const got = selectBaseline(corpus, 99, 2);
        expect(got).toHaveLength(10);
    });

    it('refuses a non-positive unit count', () => {
        expect(() => selectBaseline(corpus, 0)).toThrow(/units/);
    });
});

describe('ingestCases / unitRows — an instrument failure is UNKNOWN', () => {
    const aggregate = {
        cases: [
            { name: '1-alpha-p1', promptMarkdown: 'a', arms: { with: [{ passed: true, error: null, costUsd: 0.1 }] } },
            { name: '2-beta-p1', promptMarkdown: 'b', arms: { with: [{ passed: false, error: null, costUsd: 0.1 }] } },
            { name: '3-gamma-p1', promptMarkdown: 'c', arms: { with: [{ passed: false, error: 'EACCES', costUsd: 0 }] } },
        ],
    };
    const plan: Record<string, string> = { '1-alpha-p1': 'alpha', '2-beta-p1': 'beta', '3-gamma-p1': 'gamma' };

    it('reads fired, not-fired and unknown apart', () => {
        const rows = ingestCases(aggregate, (n) => plan[n]);
        expect(rows.map((r) => r.verdict)).toEqual(['fired', 'not-fired', 'unknown']);
    });

    it('never counts an errored run as a miss: its unit has no recall', () => {
        const units = unitRows(ingestCases(aggregate, (n) => plan[n]));
        const gamma = units.find((u) => u.unit === 'gamma');
        expect(gamma).toMatchObject({ n: 0, unknown: 1, recall: null });
        expect(units.find((u) => u.unit === 'beta')?.recall).toBe(0);
        expect(units.find((u) => u.unit === 'alpha')?.recall).toBe(1);
    });

    it('refuses a case the plan does not know', () => {
        expect(() => ingestCases(aggregate, () => undefined)).toThrow(/not in the plan/);
    });
});

describe('invokedFromTrace', () => {
    it('reads Skill tool calls and strips the plugin namespace', () => {
        const jsonl = [
            JSON.stringify({ type: 'system', subtype: 'init' }),
            JSON.stringify({
                type: 'assistant',
                message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'ac:code-review' } }] },
            }),
            JSON.stringify({
                type: 'assistant',
                message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/x' } }] },
            }),
            'not json',
        ].join('\n');
        expect(invokedFromTrace(jsonl)).toEqual(['code-review']);
    });
});

describe('deriveFloors — 0.4, the registered rule', () => {
    it('floor = baseline recall − tolerance, clamped at 0, only for measured units', () => {
        const floors = deriveFloors(
            [
                { unit: 'a', n: 1, fired: 1, unknown: 0, recall: 1 },
                { unit: 'b', n: 1, fired: 0, unknown: 0, recall: 0 },
                { unit: 'c', n: 0, fired: 0, unknown: 1, recall: null },
                { unit: 'd', n: 4, fired: 3, unknown: 0, recall: 0.75 },
            ],
            0.1,
        );
        expect(floors).toEqual([
            { unit: 'a', baseline_recall: 1, floor: 0.9 },
            { unit: 'b', baseline_recall: 0, floor: 0 },
            { unit: 'd', baseline_recall: 0.75, floor: 0.65 },
        ]);
    });
});

describe('classifyRow — 5.3, three states, only REGRESSION gates', () => {
    const base = { recall: 1, invoked: ['code-review'] };

    it('PASSED: at the baseline, same skills invoked', () => {
        expect(classifyRow(base, { recall: 1, invoked: ['code-review'] }, 0.9)).toBe('PASSED');
    });

    it('ROUTING_CHANGED: above the floor but the invoked set moved', () => {
        expect(classifyRow(base, { recall: 1, invoked: ['code-review', 'judge-bug-hunter'] }, 0.9)).toBe(
            'ROUTING_CHANGED',
        );
    });

    it('REGRESSION: below the floor', () => {
        expect(classifyRow(base, { recall: 0, invoked: [] }, 0.9)).toBe('REGRESSION');
    });

    it('UNKNOWN when nothing was measured — never green', () => {
        expect(classifyRow(base, { recall: null, invoked: [] }, 0.9)).toBe('UNKNOWN');
    });
});

describe('classifyRun — 5.3 wired: a whole run against the frozen baseline', () => {
    const caseRow = (skill: string, verdict: CaseRow['verdict'], invoked: string[] | null): CaseRow => ({
        case: `001-${skill}`,
        skill,
        query_sha256: 'x',
        verdict,
        cost_usd: 0,
        invoked,
    });
    const baseline = {
        cases: [caseRow('a', 'fired', ['a']), caseRow('b', 'fired', ['b']), caseRow('c', 'fired', ['c'])],
        units: [
            { unit: 'a', n: 1, fired: 1, unknown: 0, recall: 1 },
            { unit: 'b', n: 1, fired: 1, unknown: 0, recall: 1 },
            { unit: 'c', n: 1, fired: 1, unknown: 0, recall: 1 },
        ],
    };
    const floors = [
        { unit: 'a', baseline_recall: 1, floor: 0.9 },
        { unit: 'b', baseline_recall: 1, floor: 0.9 },
        { unit: 'c', baseline_recall: 1, floor: 0.9 },
    ];

    it('classifies every unit and gates only on REGRESSION', () => {
        const current = {
            cases: [caseRow('a', 'fired', ['a']), caseRow('b', 'not-fired', []), caseRow('c', 'fired', ['c', 'x'])],
            units: [
                { unit: 'a', n: 1, fired: 1, unknown: 0, recall: 1 },
                { unit: 'b', n: 1, fired: 0, unknown: 0, recall: 0 },
                { unit: 'c', n: 1, fired: 1, unknown: 0, recall: 1 },
            ],
        };
        const r = classifyRun(baseline, current, floors);
        expect(r.rows.map((x) => [x.unit, x.state])).toEqual([
            ['a', 'PASSED'],
            ['b', 'REGRESSION'],
            ['c', 'ROUTING_CHANGED'],
        ]);
        expect(r.counts).toEqual({ PASSED: 1, ROUTING_CHANGED: 1, REGRESSION: 1, UNKNOWN: 0 });
        expect(r.gate).toBe('red');
    });

    it('a run without a REGRESSION is green even when routing changed', () => {
        const current = {
            cases: [caseRow('a', 'fired', ['a', 'y'])],
            units: [{ unit: 'a', n: 1, fired: 1, unknown: 0, recall: 1 }],
        };
        const r = classifyRun(baseline, current, floors);
        expect(r.gate).toBe('green');
        expect(r.not_run).toEqual(['b', 'c']);
    });

    it('a unit with no floor is reported, never classified against an invented one', () => {
        const current = {
            cases: [caseRow('z', 'fired', ['z'])],
            units: [{ unit: 'z', n: 1, fired: 1, unknown: 0, recall: 1 }],
        };
        const r = classifyRun(baseline, current, floors);
        expect(r.rows).toEqual([]);
        expect(r.unfloored).toEqual(['z']);
    });

    it('--classify exits 1 on a REGRESSION, 0 without one, 2 on a floors/baseline mismatch', () => {
        const dir = tmp();
        const b = path.join(dir, 'b.json');
        const f = path.join(dir, 'f.json');
        fs.writeFileSync(b, JSON.stringify(baseline));
        const bSha = sha256(fs.readFileSync(b, 'utf8'));
        fs.writeFileSync(f, JSON.stringify({ baseline_sha256: bSha, floors }));
        const write = (name: string, recall: number): string => {
            const p = path.join(dir, name);
            const verdict = recall === 1 ? 'fired' : 'not-fired';
            fs.writeFileSync(p, JSON.stringify({ cases: [caseRow('a', verdict, recall === 1 ? ['a'] : [])], units: [{ unit: 'a', n: 1, fired: recall, unknown: 0, recall }] }));
            return p;
        };
        const out = path.join(dir, 'r.json');
        expect(main(['--classify', write('bad.json', 0), '--baseline', b, '--floors', f, '--out', out])).toBe(1);
        expect(JSON.parse(fs.readFileSync(out, 'utf8')).counts.REGRESSION).toBe(1);
        expect(main(['--classify', write('ok.json', 1), '--baseline', b, '--floors', f, '--out', out])).toBe(0);
        fs.writeFileSync(f, JSON.stringify({ baseline_sha256: 'other', floors }));
        expect(main(['--classify', write('ok.json', 1), '--baseline', b, '--floors', f, '--out', out])).toBe(2);
    });

    it('an all-UNKNOWN run is never green', () => {
        const current = {
            cases: [caseRow('a', 'unknown', null)],
            units: [{ unit: 'a', n: 0, fired: 0, unknown: 1, recall: null }],
        };
        const r = classifyRun(baseline, current, floors);
        expect(r.counts.UNKNOWN).toBe(1);
        expect(r.gate).toBe('unknown');
    });
});

describe('buildBaselinePlugin / buildArtifact', () => {
    function fixture(): { skills: string; catalogue: string } {
        const root = tmp();
        const skills = path.join(root, 'src-skills');
        const catalogue = path.join(root, 'catalogue');
        for (const s of ['alpha', 'beta']) {
            fs.mkdirSync(path.join(skills, s, 'evals'), { recursive: true });
            fs.writeFileSync(
                path.join(skills, s, 'evals', 'triggers.json'),
                JSON.stringify({ queries: [{ id: 'p1', q: `use ${s}`, trigger: true }] }),
            );
            fs.mkdirSync(path.join(catalogue, s), { recursive: true });
            fs.writeFileSync(path.join(catalogue, s, 'SKILL.md'), `---\nname: ${s}\ndescription: ${s}\n---\n`);
        }
        return { skills, catalogue };
    }

    it('writes manifest, catalogue, ranked cases and a plan', () => {
        const { skills, catalogue } = fixture();
        const pluginRoot = path.join(tmp(), 'plugin');
        const plan = buildBaselinePlugin({ skillsRoot: skills, catalogueRoot: catalogue, pluginRoot, plugin: 'ac', units: 2, perUnit: 1 });
        expect(plan.rows).toHaveLength(2);
        expect(fs.existsSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'))).toBe(true);
        expect(fs.existsSync(path.join(pluginRoot, 'skills', 'alpha', 'SKILL.md'))).toBe(true);
        for (const r of plan.rows) {
            expect(r.case).toMatch(/^[12]-/);
            expect(fs.existsSync(path.join(pluginRoot, 'evals', r.case, 'prompt.md'))).toBe(true);
            expect(r.skill_sha256).toMatch(/^[0-9a-f]{64}$/);
        }
        expect(JSON.parse(fs.readFileSync(path.join(pluginRoot, 'plan.json'), 'utf8')).rows).toHaveLength(2);
    });

    it('produces an artefact naming its commit, model and protocol, with machine-readable unit rows', () => {
        const { skills, catalogue } = fixture();
        const pluginRoot = path.join(tmp(), 'plugin');
        const plan = buildBaselinePlugin({ skillsRoot: skills, catalogueRoot: catalogue, pluginRoot, plugin: 'ac', units: 2, perUnit: 1 });
        const aggregate = {
            startedAt: '2026-10-27T00:00:00Z',
            claudeVersion: '2.1.311',
            costUsd: 0.2,
            partial: false,
            cases: plan.rows.map((r, i) => ({
                name: r.case,
                promptMarkdown: 'x',
                arms: { with: [{ passed: i === 0, error: null, costUsd: 0.1 }] },
            })),
        };
        const art = buildArtifact({
            aggregate,
            plan,
            commit: 'abc123',
            model: 'claude-opus-5-5',
            protocolPath: 'p.md',
            protocolSha256: 'f'.repeat(64),
        });
        expect(art).toMatchObject({ commit: 'abc123', model: 'claude-opus-5-5', host_version: '2.1.311' });
        expect(art.protocol.path).toBe('p.md');
        expect(art.units.map((u) => u.recall).sort()).toEqual([0, 1]);
        const c: CaseRow = art.cases[0] as CaseRow;
        expect(c.query_sha256).toBe(plan.rows[0]?.query_sha256);
    });
});
