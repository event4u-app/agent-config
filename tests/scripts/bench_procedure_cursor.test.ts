import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    buildArms,
    CaseError,
    CURSOR_ENTRY_LINE,
    PRE_SPLIT_ROOT,
    SKILLS_ROOT,
    holds,
    parseCase,
    resolvePath,
    scoreExits,
    scoreRun,
    validatePool,
    type Case,
} from '../../src/scripts/bench_procedure_cursor.js';

const tmp: string[] = [];
function dir(files: Record<string, string> = {}): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-score-'));
    tmp.push(d);
    for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
        fs.writeFileSync(path.join(d, rel), text);
    }
    return d;
}
afterEach(() => {
    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const uiCase = (success: unknown[]): unknown => ({ id: 'cand-ui-01', pilot: 'existing-ui-audit', input: 'audit', success });

describe('parseCase', () => {
    it('accepts a well-formed case', () => {
        const c = parseCase(uiCase([{ kind: 'json', file: '.work-state.json', path: 'ui_audit.greenfield', op: 'equals', values: [true] }]));
        expect(c.success).toHaveLength(1);
    });
    it.each([
        ['an unknown top-level key', { ...(uiCase([{ kind: 'file', path: 'a', op: 'exists' }]) as object), extra: 1 }],
        ['an id with the other pilot prefix', { id: 'cand-pa-01', pilot: 'existing-ui-audit', input: 'x', success: [{ kind: 'file', path: 'a', op: 'exists' }] }],
        ['no predicates', uiCase([])],
        ['an escaping path', uiCase([{ kind: 'file', path: '../x', op: 'exists' }])],
        ['an absolute path', uiCase([{ kind: 'file', path: '/etc/passwd', op: 'exists' }])],
        ['an unknown op', uiCase([{ kind: 'json', file: 's.json', path: 'a', op: 'run', values: [] }])],
        ['mentions without values', uiCase([{ kind: 'file', path: 'a', op: 'mentions_all' }])],
        ['a dir without a positive min', uiCase([{ kind: 'dir', path: 'a', op: 'min_files', min: 0 }])],
    ])('rejects %s', (_label, raw) => {
        expect(() => parseCase(raw)).toThrow(CaseError);
    });
});

describe('resolvePath', () => {
    it('flattens arrays marked []', () => {
        expect(resolvePath({ a: { b: [{ n: 'x' }, { n: 'y' }] } }, 'a.b[].n')).toEqual(['x', 'y']);
    });
    it('returns undefined for an absent key', () => {
        expect(resolvePath({ a: 1 }, 'b')).toBeUndefined();
    });
});

describe('holds — each op fails on an empty run and holds on a matching one', () => {
    const state = JSON.stringify({ ui_audit: { components: [{ name: 'Button' }, { name: 'Card' }], shadcn_inventory: null, greenfield: false } });
    const cases: Array<[string, Parameters<typeof holds>[1], Record<string, string>]> = [
        ['json mentions_all', { kind: 'json', file: '.work-state.json', path: 'ui_audit.components', op: 'mentions_all', values: ['button', 'CARD'] }, { '.work-state.json': state }],
        ['json mentions_none', { kind: 'json', file: '.work-state.json', path: 'ui_audit.components', op: 'mentions_none', values: ['Dialog'] }, { '.work-state.json': state }],
        ['json equals', { kind: 'json', file: '.work-state.json', path: 'ui_audit.greenfield', op: 'equals', values: [false] }, { '.work-state.json': state }],
        ['json is_null', { kind: 'json', file: '.work-state.json', path: 'ui_audit.shadcn_inventory', op: 'is_null' }, { '.work-state.json': state }],
        ['json not_empty', { kind: 'json', file: '.work-state.json', path: 'ui_audit.components', op: 'not_empty' }, { '.work-state.json': state }],
        ['file exists', { kind: 'file', path: 'out.md', op: 'exists' }, { 'out.md': 'x' }],
        ['file mentions_all', { kind: 'file', path: 'out.md', op: 'mentions_all', values: ['Redis'] }, { 'out.md': 'uses redis' }],
        ['file mentions_none', { kind: 'file', path: 'out.md', op: 'mentions_none', values: ['Django'] }, { 'out.md': 'uses redis' }],
        ['dir min_files', { kind: 'dir', path: 'd', op: 'min_files', min: 2 }, { 'd/a.md': 'a', 'd/b/c.md': 'c' }],
    ];
    it.each(cases)('%s', (_label, p, files) => {
        expect(holds(dir(), p)).toBe(false);
        expect(holds(dir(files), p)).toBe(true);
    });
    it('every_has holds only when every element carries a non-empty value for each key', () => {
        const p: Parameters<typeof holds>[1] = { kind: 'json', file: 's.json', path: 'c', op: 'every_has', values: ['kind'] };
        expect(holds(dir({ 's.json': JSON.stringify({ c: [{ kind: 'sfc' }, { kind: 'sfc' }] }) }), p)).toBe(true);
        expect(holds(dir({ 's.json': JSON.stringify({ c: [{ kind: 'sfc' }, { name: 'x' }] }) }), p)).toBe(false);
        expect(holds(dir({ 's.json': JSON.stringify({ c: [] }) }), p)).toBe(false);
    });
    it('dir mentions_all reads every file under the directory and fails when it is absent', () => {
        const p: Parameters<typeof holds>[1] = { kind: 'dir', path: 'm', op: 'mentions_all', values: ['Alpha', 'beta'] };
        expect(holds(dir(), p)).toBe(false);
        expect(holds(dir({ 'm/a.md': 'Alpha', 'm/x/b.md': 'BETA' }), p)).toBe(true);
        expect(holds(dir({ 'm/a.md': 'Alpha' }), p)).toBe(false);
    });
    it('dir mentions_none holds on an absent directory and not on one that names a value', () => {
        const p: Parameters<typeof holds>[1] = { kind: 'dir', path: 'api', op: 'mentions_none', values: ['GET /'] };
        expect(holds(dir(), p)).toBe(true);
        expect(holds(dir({ 'api/e.md': 'GET /users' }), p)).toBe(false);
    });
    it('is_null does not hold for an absent key', () => {
        expect(holds(dir({ '.work-state.json': '{}' }), { kind: 'json', file: '.work-state.json', path: 'x', op: 'is_null' })).toBe(false);
    });
    it('mentions_all does not hold when one value is missing', () => {
        const p: Parameters<typeof holds>[1] = { kind: 'file', path: 'o.md', op: 'mentions_all', values: ['a1', 'b2'] };
        expect(holds(dir({ 'o.md': 'a1 only' }), p)).toBe(false);
    });
});

describe('scoreExits — counts the pilot sidecar by class', () => {
    it('meets nothing on an empty run', () => {
        const s = scoreExits(dir(), 'project-analyzer');
        expect(s.verified).toEqual({ met: 0, total: 1 });
        expect(s.sequenced).toEqual({ met: 0, total: 6 });
    });
    it('meets the verified overview check and the written exists paths', () => {
        const run = dir({
            'package.json': JSON.stringify({ dependencies: { fastify: '^4' } }),
            'agents/evidence/analysis/overview.md': 'A Fastify service.',
            'agents/evidence/analysis/architecture/index.md': 'x',
            'agents/evidence/analysis/models/index.md': 'x',
        });
        const s = scoreExits(run, 'project-analyzer');
        expect(s.verified.met).toBe(1);
        expect(s.sequenced.met).toBe(2);
    });
    it('counts six verified exits for existing-ui-audit', () => {
        expect(scoreExits(dir(), 'existing-ui-audit').verified.total).toBe(6);
    });
});

describe('scoreRun', () => {
    it('reports task success only when every predicate holds, and names the unmet ones', () => {
        const c: Case = parseCase({
            id: 'cand-pa-05',
            pilot: 'project-analyzer',
            input: 'analyse',
            success: [
                { kind: 'file', path: 'agents/evidence/analysis/overview.md', op: 'mentions_all', values: ['guzzle'] },
                { kind: 'dir', path: 'agents/evidence/analysis/api', op: 'min_files', min: 1 },
            ],
        });
        const run = dir({ 'agents/evidence/analysis/overview.md': 'Uses Guzzle.' });
        const s = scoreRun(run, c);
        expect(s.task_success).toBe(false);
        expect(s.unmet).toEqual(['success[1]']);
    });
});

describe('validatePool', () => {
    it('flags a criterion that already holds on the untouched fixture', () => {
        const root = dir({
            'cand-ui-01/case.json': JSON.stringify(uiCase([{ kind: 'file', path: 'src/App.tsx', op: 'exists' }])),
            'cand-ui-01/repo/src/App.tsx': 'export {}',
        });
        expect(validatePool(root).some((p) => p.includes('already holds'))).toBe(true);
    });
    it('the committed pool has fifteen valid candidates per pilot', () => {
        expect(validatePool()).toEqual([]);
    });
});

describe('buildArms — one difference per arm pair', () => {
    function pool(): string {
        return dir({
            'cand-ui-01/case.json': JSON.stringify(uiCase([{ kind: 'json', file: '.work-state.json', path: 'ui_audit.greenfield', op: 'equals', values: [true] }])),
            'cand-ui-01/repo/index.html': '<html></html>',
            'cand-pa-01/case.json': JSON.stringify({ id: 'cand-pa-01', pilot: 'project-analyzer', input: 'analyse', success: [{ kind: 'file', path: 'x.md', op: 'exists' }] }),
            'cand-pa-01/repo/README.md': 'x',
        });
    }
    it('arm A carries the pre-split body alone; B and C carry the split skill byte for byte', () => {
        const out = dir();
        buildArms(out, pool());
        const ui = (arm: string, rel: string): string => fs.readFileSync(path.join(out, 'existing-ui-audit', arm, 'skills/existing-ui-audit', rel), 'utf-8');
        expect(ui('A', 'SKILL.md')).toBe(fs.readFileSync(path.join(PRE_SPLIT_ROOT, 'existing-ui-audit.pre-split.txt'), 'utf-8'));
        expect(fs.existsSync(path.join(out, 'existing-ui-audit/A/skills/existing-ui-audit/procedure.yaml'))).toBe(false);
        for (const arm of ['B', 'C']) {
            expect(ui(arm, 'SKILL.md')).toBe(fs.readFileSync(path.join(SKILLS_ROOT, 'existing-ui-audit/SKILL.md'), 'utf-8'));
            expect(ui(arm, 'procedure.yaml')).toBe(fs.readFileSync(path.join(SKILLS_ROOT, 'existing-ui-audit/procedure.yaml'), 'utf-8'));
        }
    });
    it('B and C prompts differ only by the appended cursor-entry line; A and B prompts are identical', () => {
        const out = dir();
        buildArms(out, pool());
        const prompt = (arm: string): string => fs.readFileSync(path.join(out, 'project-analyzer', arm, 'evals/cand-pa-01/prompt.md'), 'utf-8');
        expect(prompt('A')).toBe(prompt('B'));
        const extra = `append_system_prompt: ${JSON.stringify(CURSOR_ENTRY_LINE('project-analyzer'))}\n`;
        expect(prompt('C')).toBe(prompt('B').replace('\n---\nUse', `\n${extra}---\nUse`));
        expect(prompt('C')).not.toBe(prompt('B'));
        expect(prompt('B')).not.toContain('agent-config work');
    });
    it('each case scaffolds its own fixture repository and nothing else', () => {
        const out = dir();
        const p = pool();
        buildArms(out, p);
        const yaml = fs.readFileSync(path.join(out, 'existing-ui-audit/B/evals/cand-ui-01/case.yaml'), 'utf-8');
        expect(yaml).toContain(path.join(p, 'cand-ui-01', 'repo'));
        expect(fs.existsSync(path.join(out, 'existing-ui-audit/B/evals/cand-pa-01'))).toBe(false);
    });
});
