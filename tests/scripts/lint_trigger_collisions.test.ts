// Tests for lint_trigger_collisions — per-trigger-value disposition coverage.
// Distinct from tests/scripts/rule_trigger_collisions.test.ts (pair-level
// Jaccard similarity ratchet): one shared value between otherwise-different
// rules never moves Jaccard, but still needs a written argument.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    load_rules,
    find_collisions,
    render_report,
    RULES_ROOT,
} from '../../src/scripts/lint_trigger_collisions.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

const tmpdirs: string[] = [];
function fixtureDir(files: Record<string, string>): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trig-col-'));
    tmpdirs.push(d);
    for (const [name, body] of Object.entries(files)) {
        fs.writeFileSync(path.join(d, name), body);
    }
    return d;
}
afterEach(() => {
    for (const d of tmpdirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const rule = (triggers: string[], extra = ''): string =>
    `---\ntype: "auto"\ntier: "2a"\ndescription: "x"\ntriggers:\n${triggers
        .map((t) => `  - keyword: "${t}"`)
        .join('\n')}\n${extra}---\n\n# R\n`;

describe('live tree', () => {
    it('every live collision is dispositioned (the gate is green on HEAD)', () => {
        const rules = load_rules(path.join(REPO_ROOT, RULES_ROOT));
        expect(rules.length).toBeGreaterThanOrEqual(90);
        const undisp = find_collisions(rules).filter((c) => c.undispositioned.length > 0);
        expect(
            undisp.map((c) => `${c.kind} ${c.value}: ${c.undispositioned.join(',')}`),
        ).toEqual([]);
    });

    it('the three 2026-08-04 disjoined duplicate pairs stay disjoined', () => {
        const rules = load_rules(path.join(REPO_ROOT, RULES_ROOT));
        const collisions = find_collisions(rules);
        const byValue = new Map(collisions.map((c) => [`${c.kind} ${c.value}`, c.sharers]));
        expect(byValue.get('keyword secret')).toBeUndefined();
        expect(byValue.get('keyword password')).toBeUndefined();
        expect(byValue.get('keyword valuation')).toBeUndefined();
        expect(byValue.get('keyword dcf')).toBeUndefined();
        expect(byValue.get('keyword brand tokens')).toBeUndefined();
        expect(byValue.get('keyword brand voice')).toBeUndefined();
    });
});

describe('fixtures', () => {
    it('an undispositioned shared trigger is a finding (red path)', () => {
        const d = fixtureDir({
            'a.md': rule(['deploy']),
            'b.md': rule(['deploy']),
        });
        const collisions = find_collisions(load_rules(d));
        expect(collisions).toHaveLength(1);
        expect(collisions[0]!.undispositioned).toEqual(['a', 'b']);
    });

    it('collision_ok on EVERY sharer clears it; on one sharer only it stays red', () => {
        const ok = 'collision_ok:\n  "deploy": "both floors legitimately own the deploy surface"\n';
        const half = fixtureDir({ 'a.md': rule(['deploy'], ok), 'b.md': rule(['deploy']) });
        expect(find_collisions(load_rules(half))[0]!.undispositioned).toEqual(['b']);
        const full = fixtureDir({ 'a.md': rule(['deploy'], ok), 'b.md': rule(['deploy'], ok) });
        expect(find_collisions(load_rules(full))[0]!.undispositioned).toEqual([]);
    });

    it('pairwise-distinct precedence clears; equal integers stay red', () => {
        const p1 = 'precedence:\n  "deploy": 1\n';
        const p2 = 'precedence:\n  "deploy": 2\n';
        const distinct = fixtureDir({ 'a.md': rule(['deploy'], p1), 'b.md': rule(['deploy'], p2) });
        expect(find_collisions(load_rules(distinct))[0]!.undispositioned).toEqual([]);
        const equal = fixtureDir({ 'a.md': rule(['deploy'], p1), 'b.md': rule(['deploy'], p1) });
        expect(find_collisions(load_rules(equal))[0]!.undispositioned).toEqual(['a', 'b']);
    });

    it('type: manual rules and same-value-different-kind never collide', () => {
        const manual = `---\ntype: "manual"\ntier: "2a"\ndescription: "x"\ntriggers:\n  - keyword: "deploy"\n---\n`;
        const pathRule = `---\ntype: "auto"\ntier: "2a"\ndescription: "x"\ntriggers:\n  - path_prefix: "deploy"\n---\n`;
        const d = fixtureDir({ 'a.md': rule(['deploy']), 'b.md': manual, 'c.md': pathRule });
        expect(find_collisions(load_rules(d))).toEqual([]);
    });

    it('dead scope: an empty rules dir loads zero rules (main() exits 2 via assertScanned)', () => {
        const d = fixtureDir({});
        expect(load_rules(d)).toEqual([]);
    });
});

describe('mutation self-test — the gate can actually fail', () => {
    it('removing one seeded disposition from the live tree turns the gate red', () => {
        // A gate nobody has seen fail is a gate nobody knows works: strip the
        // collision_ok map from one live sharer in-memory and assert a finding.
        const rules = load_rules(path.join(REPO_ROOT, RULES_ROOT));
        const collisions = find_collisions(rules);
        const seeded = collisions.find((c) => c.undispositioned.length === 0);
        expect(seeded, 'live tree must carry at least one dispositioned collision').toBeDefined();
        const victim = seeded!.sharers[0]!;
        const mutated = rules.map((r) =>
            r.id === victim ? { ...r, collision_ok: {}, precedence: {} } : r,
        );
        const after = find_collisions(mutated).find(
            (c) => c.kind === seeded!.kind && c.value === seeded!.value,
        );
        expect(after!.undispositioned).toContain(victim);
    });
});

describe('census report', () => {
    it('renders the provenance header and one row per collision', () => {
        const rules = load_rules(path.join(REPO_ROOT, RULES_ROOT));
        const collisions = find_collisions(rules);
        const report = render_report(rules, collisions, 'abc123def');
        expect(report).toContain('# Trigger-collision census');
        expect(report).toContain('Do not hand-edit');
        expect(report).toContain(`Colliding values (shared by ≥2 rules): ${collisions.length}`);
        const rows = report.split('\n').filter((l) => /^\| \d+ \|/.test(l));
        expect(rows).toHaveLength(collisions.length);
    });
});
