/**
 * A default asset (a rule or a skill) leaves only through a removal record that
 * answers the five Phase-4 conditions: an interpretation record with no open
 * question, a real-use census, a margin committed before the deciding report, an
 * adversarial fixture for a safety asset, and a release in which the asset was
 * already hidden from the default.
 */
import { describe, expect, it } from 'vitest';

import { removalProblems, removedDefaultAssets, type RemovalGit } from '../../src/scripts/check_default_asset_removal.js';

const RULE = 'src/rules/old-rule.md';
const REC = 'agents/evidence/removals/old-rule.md';

const record = (over: Record<string, string> = {}): string => {
    const f: Record<string, string> = {
        asset: RULE,
        interpretation_record: 'agents/evidence/interp/old-rule.md',
        census: 'agents/evidence/metrics/census.md',
        margin: '3 pp',
        margin_commit: 'm1',
        deciding_report: 'internal/bench/reports/r.json',
        safety: 'false',
        hidden_in: 'h1',
        ...over,
    };
    return ['---', ...Object.entries(f).map(([k, v]) => `${k}: ${v}`), '---', '# Removal', ''].join('\n');
};

function git(files: Record<string, string>, over: Partial<RemovalGit> = {}): RemovalGit {
    return {
        head: (p) => files[p] ?? null,
        at: (ref, p) => (ref === 'h1' && p === RULE ? '---\ntype: "manual"\n---\n# Old\n' : null),
        commitTime: (ref) => (ref === 'm1' ? 100 : null),
        firstAdded: (p) => (p === 'internal/bench/reports/r.json' ? 200 : null),
        isAncestor: (a) => a === 'h1',
        ...over,
    };
}

const healthy = (): Record<string, string> => ({
    [REC]: record(),
    'agents/evidence/interp/old-rule.md': '# Interpretation\n\n- construct: answered\n- delivery: answered\n- cost: answered\n',
    'agents/evidence/metrics/census.md': '# Census\n',
});

describe('removedDefaultAssets', () => {
    it('picks deleted rules and SKILL.md files, and the source of a rename', () => {
        const status = ['D\tsrc/rules/a.md', 'D\tsrc/skills/b/SKILL.md', 'D\tsrc/skills/b/references/x.md', 'R100\tsrc/rules/c.md\tsrc/rules/d.md', 'M\tsrc/rules/e.md', 'D\tsrc/scripts/x.ts'];
        expect(removedDefaultAssets(status)).toEqual(['src/rules/a.md', 'src/rules/c.md', 'src/skills/b/SKILL.md']);
    });
});

describe('removalProblems', () => {
    it('passes a removal whose record answers all five conditions', () => {
        expect(removalProblems([RULE], 'base', git(healthy()))).toEqual([]);
    });
    it('refuses a removal with no record', () => {
        const p = removalProblems([RULE], 'base', git({}));
        expect(p.join('\n')).toContain('no removal record');
    });
    it('4.1 — an open interpretation question refuses', () => {
        const files = { ...healthy(), 'agents/evidence/interp/old-rule.md': '- construct: answered\n- delivery: open\n' };
        expect(removalProblems([RULE], 'base', git(files)).join('\n')).toContain('4.1');
    });
    it('4.2 — a census that does not exist refuses', () => {
        const files = healthy();
        delete files['agents/evidence/metrics/census.md'];
        expect(removalProblems([RULE], 'base', git(files)).join('\n')).toContain('4.2');
    });
    it('4.3 — a margin committed after the deciding report refuses', () => {
        const g = git(healthy(), { commitTime: () => 300 });
        expect(removalProblems([RULE], 'base', g).join('\n')).toContain('4.3');
    });
    it('4.4 — a safety asset without an existing adversarial fixture refuses', () => {
        const files = { ...healthy(), [REC]: record({ safety: 'true' }) };
        expect(removalProblems([RULE], 'base', git(files)).join('\n')).toContain('4.4');
        const withFixture = { ...files, [REC]: record({ safety: 'true', adversarial_fixture: 'tests/fixtures/x.json' }), 'tests/fixtures/x.json': '{}' };
        expect(removalProblems([RULE], 'base', git(withFixture))).toEqual([]);
    });
    it('4.5 — an asset not hidden in an earlier release refuses', () => {
        expect(removalProblems([RULE], 'base', git(healthy(), { isAncestor: () => false })).join('\n')).toContain('4.5');
        expect(removalProblems([RULE], 'base', git(healthy(), { at: () => '---\ntype: "auto"\n---\n' })).join('\n')).toContain('4.5');
    });
    it('a hidden skill is one with disable-model-invocation', () => {
        const skill = 'src/skills/old/SKILL.md';
        const rec = 'agents/evidence/removals/old.md';
        const files = { ...healthy(), [rec]: record({ asset: skill }) };
        const g = git(files, { at: (_r, p) => (p === skill ? '---\nname: old\ndisable-model-invocation: true\n---\n' : null) });
        expect(removalProblems([skill], 'base', g)).toEqual([]);
    });
});
