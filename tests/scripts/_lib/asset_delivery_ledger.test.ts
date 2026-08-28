import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    attributeGrowth,
    buildLedger,
    measureRules,
    measureSkillCatalogue,
    reconcile,
    RECONCILE_MARGIN,
    renderAttribution,
    unresolvedAgainst,
    type AssetRow,
} from '../../../src/scripts/_lib/asset_delivery_ledger.js';

const tmpDirs: string[] = [];
function mkTree(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'adl-'));
    tmpDirs.push(d);
    fs.mkdirSync(path.join(d, 'rules'), { recursive: true });
    fs.mkdirSync(path.join(d, 'skills'), { recursive: true });
    return d;
}
function writeRule(root: string, name: string, body: string): void {
    fs.writeFileSync(path.join(root, 'rules', `${name}.md`), body);
}
function writeSkill(root: string, dir: string, name: string, description: string): void {
    fs.mkdirSync(path.join(root, 'skills', dir), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'skills', dir, 'SKILL.md'),
        `---\nname: ${name}\ndescription: ${description}\n---\n\n# body that is deliberately much longer than the description line\n${'x'.repeat(4000)}\n`,
    );
}
afterEach(() => {
    while (tmpDirs.length > 0) fs.rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
});

describe('asset delivery ledger — what each bucket delivers', () => {
    it('a rule delivers its whole body', () => {
        const root = mkTree();
        writeRule(root, 'big', 'y'.repeat(4000));
        const rows = measureRules(path.join(root, 'rules'), root);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.kind).toBe('rule');
        expect(rows[0]?.tokens).toBeGreaterThan(100);
    });

    it('a skill delivers only its catalogue line, never its body', () => {
        const root = mkTree();
        writeSkill(root, 'a-skill', 'a-skill', 'short description');
        const rows = measureSkillCatalogue(path.join(root, 'skills'), root);
        expect(rows).toHaveLength(1);
        // The body is 4000 chars; the catalogue line is a fraction of that.
        // Counting the body would rank a never-activated skill above an
        // always-delivered rule, which is the failure this split prevents.
        expect(rows[0]?.tokens).toBeLessThan(30);
    });

    it('reads a folded multi-line description in full', () => {
        // The regression that the reconciliation caught: a `[^\n]+` capture
        // truncates a folded description and under-measures the catalogue by
        // double digits. The ledger uses the payload census's own YAML parser.
        const root = mkTree();
        fs.mkdirSync(path.join(root, 'skills', 'folded'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'skills', 'folded', 'SKILL.md'),
            `---\nname: folded\ndescription: >-\n  first line of a long description\n  second line that a naive regex would drop\n  third line likewise\n---\n\n# body\n`,
        );
        const rows = measureSkillCatalogue(path.join(root, 'skills'), root);
        expect(rows[0]?.tokens).toBeGreaterThan(15);
    });

    it('ranks descending and shares sum to one', () => {
        const root = mkTree();
        writeRule(root, 'small', 'y'.repeat(400));
        writeRule(root, 'large', 'y'.repeat(4000));
        const l = buildLedger(path.join(root, 'rules'), path.join(root, 'skills'), root);
        expect(l.rows.map((r) => r.name)).toEqual(['large', 'small']);
        expect(l.rows.reduce((n, r) => n + r.share, 0)).toBeCloseTo(1, 6);
    });

    it('every row names its measurement method', () => {
        const root = mkTree();
        writeRule(root, 'r', 'y'.repeat(100));
        for (const row of buildLedger(path.join(root, 'rules'), path.join(root, 'skills'), root).rows) {
            expect(['exact', 'proxy']).toContain(row.method);
        }
    });
});

describe('reconciliation — like-for-like, never method-against-method', () => {
    it('compares the proxy total against the proxy bucket', () => {
        const root = mkTree();
        writeRule(root, 'r', 'y'.repeat(4000));
        const l = buildLedger(path.join(root, 'rules'), path.join(root, 'skills'), root);
        const rec = reconcile(l, [{ name: 'project-scope rules', tokens: l.by_kind.rule.proxy_tokens }]);
        expect(rec[0]?.drift).toBe(0);
        expect(rec[0]?.within_margin).toBe(true);
        // The BPE figure is reported for contrast, never reconciled against.
        expect(rec[0]?.ledger_exact_tokens).toBe(l.by_kind.rule.tokens);
    });

    it('a real disagreement is not absorbed by the margin', () => {
        const root = mkTree();
        writeRule(root, 'r', 'y'.repeat(4000));
        const l = buildLedger(path.join(root, 'rules'), path.join(root, 'skills'), root);
        const inflated = Math.round(l.by_kind.rule.proxy_tokens * 1.5);
        expect(reconcile(l, [{ name: 'project-scope rules', tokens: inflated }])[0]?.within_margin).toBe(false);
    });

    it('the margin is tight because both sides are one arithmetic', () => {
        expect(RECONCILE_MARGIN).toBeLessThanOrEqual(0.02);
    });
});

describe('proxy resolution', () => {
    it('an exact reading is never unresolved', () => {
        expect(unresolvedAgainst(1000, 'exact', 1000)).toBe(false);
    });
    it('a proxy reading straddling a threshold is unresolved', () => {
        expect(unresolvedAgainst(1000, 'proxy', 1010)).toBe(true);
    });
    it('a proxy reading clear of a threshold is resolved', () => {
        expect(unresolvedAgainst(1000, 'proxy', 5000)).toBe(false);
    });
});

describe('2.2 — a gate names its own "no"', () => {
    const row = (name: string, tokens: number): AssetRow => ({
        file: `dist/agent-src/rules/${name}.md`,
        name,
        kind: 'rule',
        tokens,
        proxy_tokens: tokens,
        method: 'exact',
        share: 0,
    });

    it('names the asset and its token delta for a growth', () => {
        const g = attributeGrowth([row('a', 100), row('b', 100)], [row('a', 100), row('b', 340)]);
        expect(g.increases).toHaveLength(1);
        expect(g.increases[0]).toMatchObject({ name: 'b', delta: 240, status: 'grew' });
        expect(g.net_delta).toBe(240);

        const lines = renderAttribution(g).join('\n');
        expect(lines).toContain('b (rule, grew)');
        expect(lines).toContain('+240 tok');
    });

    it('distinguishes an arrival from a growth, and a removal from a shrink', () => {
        const g = attributeGrowth([row('gone', 50), row('shrinks', 200)], [row('new', 70), row('shrinks', 120)]);
        expect(g.increases.map((e) => [e.name, e.status])).toEqual([['new', 'added']]);
        expect(g.decreases.map((e) => [e.name, e.status])).toEqual([
            ['shrinks', 'shrank'],
            ['gone', 'removed'],
        ]);
        expect(g.net_delta).toBe(70 - 50 - 80);
    });

    it('renders a saving as a saving, so a refusal reads as a quantified gain', () => {
        const lines = renderAttribution(attributeGrowth([row('a', 500)], [row('a', 100)])).join('\n');
        expect(lines).toContain('-400 tok');
        expect(lines).toContain('shrank or left');
    });

    it('an unchanged tree produces no attribution at all', () => {
        // Load-bearing: the gate distinguishes this from "the base was
        // unreadable", and conflating them sends a reader to the wrong place.
        expect(renderAttribution(attributeGrowth([row('a', 100)], [row('a', 100)]))).toEqual([]);
    });

    it('caps the list and says the cap is a cap', () => {
        const before = Array.from({ length: 12 }, (_, i) => row(`r${String(i)}`, 100));
        const after = before.map((r, i) => ({ ...r, tokens: 100 + i * 10 }));
        const lines = renderAttribution(attributeGrowth(before, after), 5);
        expect(lines.join('\n')).toContain('top 5 of 11');
    });

    it('is order-independent', () => {
        const b = [row('a', 100), row('b', 200)];
        const a = [row('b', 250), row('a', 100)];
        expect(attributeGrowth(b, a)).toEqual(attributeGrowth([...b].reverse(), [...a].reverse()));
    });
});
