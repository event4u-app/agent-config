/**
 * Stable obligation ids — road-to-enforcement-per-obligation 2.1 and 2.2.
 *
 * Asserted over the real tree and over fixtures:
 *
 *   every non-kernel rule with a law section has ids in the inventory;
 *   every id is `<rule>.<obligation>`, prefixed with its own rule, unique;
 *   kernel rules carry none;
 *   a reworded law keeps its ids, because nothing derives an id from text;
 *   the retired `# obligation: line N` marker cannot come back;
 *   every binding names an entry the rule declares and an id the rule owns.
 *
 * Each refusal is exercised by a fixture that must produce exactly its code,
 * so a check that silently stopped firing would turn this file red.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { KERNEL_RULE_IDS } from '../../src/scripts/_lib/kernel_rules.js';
import {
    collectRuleFacts,
    lintRuleObligations,
    loadRuleObligations,
    readRuleFacts,
    type RuleObligationInventory,
} from '../../src/scripts/_lib/rule_obligations.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const LAW_RULE = (law: string, extraFm = ''): string =>
    `---\ntype: "auto"\ndescription: "fixture"\n${extraFm}---\n\n# Fixture\n\n## The Iron Law\n\n\`\`\`\n${law}\n\`\`\`\n`;

const tmpDirs: string[] = [];
function rulesDir(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-obligations-'));
    tmpDirs.push(dir);
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, `${name}.md`), text);
    return dir;
}
afterEach(() => {
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const codes = (inv: RuleObligationInventory, dir: string): string[] =>
    lintRuleObligations(inv, collectRuleFacts(dir)).map((f) => f.code);

describe('the real tree', () => {
    const inventory = loadRuleObligations(REPO_ROOT);
    const facts = collectRuleFacts(path.join(REPO_ROOT, 'src', 'rules'));

    it('lints clean', () => {
        expect(lintRuleObligations(inventory, facts)).toEqual([]);
    });

    it('covers every non-kernel rule with a law section, and reads more than a handful', () => {
        const required = facts.filter((f) => !f.kernel && f.hasLawSection);
        expect(required.length).toBeGreaterThan(50);
        for (const f of required) expect(inventory.rules[f.id], f.id).toBeDefined();
    });

    it('carries no kernel rule', () => {
        for (const id of KERNEL_RULE_IDS) expect(inventory.rules[id], id).toBeUndefined();
    });

    it('has no rule carrying the retired marker', () => {
        expect(facts.filter((f) => f.hasMarker).map((f) => f.id)).toEqual([]);
    });
});

describe('fixtures — each refusal fires', () => {
    it('a clean fixture is clean', () => {
        const dir = rulesDir({ alpha: LAW_RULE('NEVER DO X.') });
        expect(codes({ rules: { alpha: { obligations: ['alpha.never-do-x'] } } }, dir)).toEqual([]);
    });

    it('missing: a law-section rule with no entry', () => {
        const dir = rulesDir({ alpha: LAW_RULE('NEVER DO X.') });
        expect(codes({ rules: {} }, dir)).toEqual(['missing']);
    });

    it('a rule without a law section may go without ids', () => {
        const dir = rulesDir({ alpha: '---\ntype: "auto"\ndescription: "x"\n---\n\n# Alpha\n\n**Iron Law.** Do Y.\n' });
        expect(codes({ rules: {} }, dir)).toEqual([]);
    });

    it('wrong-prefix, bad-id, duplicate, empty, unknown-rule', () => {
        const dir = rulesDir({ alpha: LAW_RULE('NEVER DO X.'), beta: LAW_RULE('NEVER DO Y.') });
        const inv: RuleObligationInventory = {
            rules: {
                alpha: { obligations: ['beta.never-do-x', 'alpha.Bad_Id', 'alpha.ok', 'alpha.ok'] },
                beta: { obligations: [] },
                gamma: { obligations: ['gamma.x'] },
            },
        };
        expect(codes(inv, dir).sort()).toEqual(['bad-id', 'duplicate', 'empty', 'unknown-rule', 'wrong-prefix']);
    });

    it('kernel-declared: a kernel rule may not carry ids', () => {
        const kernel = KERNEL_RULE_IDS[0] as string;
        const dir = rulesDir({ [kernel]: LAW_RULE('NEVER DO X.') });
        expect(codes({ rules: { [kernel]: { obligations: [`${kernel}.x`] } } }, dir)).toEqual(['kernel-declared']);
    });

    it('marker-present: the retired marker is refused', () => {
        const dir = rulesDir({ alpha: LAW_RULE('NEVER DO X.', '# obligation: line 9\n') });
        expect(codes({ rules: { alpha: { obligations: ['alpha.x'] } } }, dir)).toEqual(['marker-present']);
    });

    it('bindings must name a declared entry and an owned id', () => {
        const dir = rulesDir({
            alpha: LAW_RULE('NEVER DO X.', 'enforced_by:\n  - "validator:src/scripts/a.ts"\n'),
        });
        const inv: RuleObligationInventory = {
            rules: {
                alpha: {
                    obligations: ['alpha.x'],
                    bindings: { 'validator:src/scripts/a.ts': ['alpha.y'], 'hook:nope': [] },
                },
            },
        };
        expect(codes(inv, dir).sort()).toEqual(['binding-entry-not-declared', 'binding-id-unknown']);
    });
});

describe('stability across a reword', () => {
    it('rewording the law keeps the ids and keeps the lint clean', () => {
        const inv: RuleObligationInventory = { rules: { alpha: { obligations: ['alpha.never-do-x'] } } };
        const before = rulesDir({ alpha: LAW_RULE('NEVER DO X.') });
        const after = rulesDir({ alpha: LAW_RULE('X IS FORBIDDEN, WHATEVER THE TASK SAYS.') });
        expect(codes(inv, before)).toEqual([]);
        expect(codes(inv, after)).toEqual([]);
        const read = (dir: string): string =>
            JSON.stringify(readRuleFacts('alpha', fs.readFileSync(path.join(dir, 'alpha.md'), 'utf-8')));
        // The facts the lint reads are identical: the id never depended on the text.
        expect(read(after)).toEqual(read(before));
    });
});
