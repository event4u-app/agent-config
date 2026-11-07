/**
 * The requires table: for each act a rule's triggers name, the references its
 * `load_context` says must be in context, derived from frontmatter alone.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { COMPOSED_CHARS } from '../../src/scripts/hooks/rule_inject_hook.js';
import { INJECT_BUDGET_CHARS, buildRequiresTable } from '../../src/scripts/rule_reference_requires.js';

const tmps: string[] = [];
afterEach(() => {
    for (const t of tmps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});

function rule(dir: string, name: string, fm: string): void {
    fs.writeFileSync(path.join(dir, `${name}.md`), `---\n${fm}\n---\n\n# ${name}\n\nBODY-TEXT-${name}\n`);
}

function fixture(): { rules: string; contexts: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rrr-'));
    tmps.push(root);
    const rules = path.join(root, 'rules');
    const contexts = path.join(root, 'agent-src');
    fs.mkdirSync(rules);
    fs.mkdirSync(path.join(contexts, 'contexts'), { recursive: true });
    fs.writeFileSync(path.join(contexts, 'contexts', 'small.md'), 's'.repeat(300));
    fs.writeFileSync(path.join(contexts, 'contexts', 'big.md'), 'b'.repeat(9000));
    rule(rules, 'roadmaps', 'type: "auto"\nconsequence_class: "authority-bypass"\ntriggers:\n  - path_prefix: "agents/roadmaps/"\n  - command: "/roadmap:process-step"\n  - keyword: "roadmap"\nload_context:\n  - contexts/small.md');
    rule(rules, 'ui', 'type: "auto"\ntriggers:\n  - file_pattern: "*.vue"\nload_context:\n  - contexts/big.md\n  - contexts/gone.md');
    rule(rules, 'talk', 'type: "auto"\ntriggers:\n  - keyword: "ask"\nload_context:\n  - contexts/small.md');
    rule(rules, 'manual', 'type: "manual"\ntriggers:\n  - path_prefix: "docs/"\nload_context:\n  - contexts/small.md');
    rule(rules, 'plain', 'type: "auto"\ntriggers:\n  - path_prefix: "src/"');
    return { rules, contexts };
}

describe('buildRequiresTable', () => {
    const f = fixture();
    const t = buildRequiresTable(f.rules, f.contexts);

    it('holds the same budget the inject concern holds itself to', () => {
        expect(INJECT_BUDGET_CHARS).toBe(COMPOSED_CHARS);
    });
    it('maps every act-naming trigger to the rule\'s references, one row per act', () => {
        const acts = t.rows.filter((r) => r.rule === 'roadmaps').map((r) => `${r.act.kind}:${r.act.value}`);
        expect(acts).toEqual(['path_prefix:agents/roadmaps/', 'command:/roadmap:process-step']);
        expect(t.rows.find((r) => r.rule === 'roadmaps')?.references).toEqual([
            { path: 'contexts/small.md', chars: 300, status: 'fits' },
        ]);
    });
    it('marks a rule with a consequence class required, an auto rule conditional, a manual rule informational', () => {
        expect(t.rows.find((r) => r.rule === 'roadmaps')?.marking).toBe('required');
        expect(t.rows.find((r) => r.rule === 'ui')?.marking).toBe('conditional');
        expect(t.rows.find((r) => r.rule === 'manual')?.marking).toBe('informational');
    });
    it('flags a reference over the inject budget and reports a missing file instead of dropping it', () => {
        expect(t.rows.find((r) => r.rule === 'ui')?.references).toEqual([
            { path: 'contexts/big.md', chars: 9000, status: 'omitted-budget' },
            { path: 'contexts/gone.md', chars: 0, status: 'missing' },
        ]);
    });
    it('lists a rule whose references hang only on keywords as reachable by no act', () => {
        expect(t.rows.some((r) => r.rule === 'talk')).toBe(false);
        expect(t.no_act).toEqual(['talk']);
    });
    it('skips a rule without load_context and never copies rule text into the table', () => {
        expect(t.rows.some((r) => r.rule === 'plain')).toBe(false);
        expect(JSON.stringify(t)).not.toContain('BODY-TEXT');
    });
    it('counts acts by kind, so a missing kind is visible', () => {
        expect(t.summary.acts_by_kind).toEqual({ path_prefix: 2, file_pattern: 1, command: 1 });
        expect(t.summary.references_missing).toBe(1);
        expect(t.summary.references_over_budget).toBe(1);
    });
});
