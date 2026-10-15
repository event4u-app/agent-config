import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    classifyChanges,
    main,
    OWNER_TRIGGERS,
    verdictOf,
    type ChangeEntry,
} from '../../src/scripts/classify_merge_risk.js';

/**
 * `needs-owner` is the verdict the amended ADR-281 forces: a council clearance of
 * the gated surface or of the reviewer's trust chain is advisory, so those PRs
 * are never sent for clearance. Pinned in both directions — a gate that said
 * `needs-owner` for everything would put every flagged PR on the owner, which
 * is the first bound the owner set.
 */

const mod = (p: string): ChangeEntry => ({ status: 'M', path: p });
const verdict = (...paths: string[]): string =>
    classifyChanges(paths.map(mod), {
        dirExistsInHead: () => true,
        decisionPolicy: () => 'other',
        consequenceMembers: new Set(['tool-safety']),
    }).verdict;

describe('needs-owner — the gated surface goes to the owner, not the council', () => {
    it('a kernel rule (the governance-surface trigger) is needs-owner', () => {
        expect(verdict('src/rules/non-destructive-by-default.md')).toBe('needs-owner');
    });

    it('the ratification gate itself is needs-owner', () => {
        expect(verdict('src/scripts/check_kernel_edit_ratified.ts')).toBe('needs-owner');
    });

    it('an ADR whose reopening is reserved to the owner is needs-owner; another ADR is routine', () => {
        const byPolicy = (policy: 'owner' | 'other' | 'unreadable'): string =>
            classifyChanges([mod('docs/decisions/ADR-281-x.md')], {
                dirExistsInHead: () => true,
                decisionPolicy: () => policy,
                consequenceMembers: new Set(),
            }).verdict;
        expect(byPolicy('owner')).toBe('needs-owner');
        expect(byPolicy('unreadable')).toBe('needs-owner');
        expect(byPolicy('other')).toBe('routine');
    });
});

describe("needs-owner — every member class of the reviewer's trust chain", () => {
    it.each([
        ['the classifier', 'src/scripts/classify_merge_risk.ts'],
        ['the merge command', 'src/domains/git/pr/merge/command.md'],
        ['the process-full command', 'src/domains/product-basic/roadmap/process-full/command.md'],
        ['ADR-282', 'docs/decisions/ADR-282-auto-merge-authority-with-a-council-danger-gate.md'],
        ['the consequence-class module the classifier imports', 'src/scripts/_lib/rule_consequence_class.ts'],
        ['the consequence-class list the classifier reads', 'src/config/rule-consequence-class.json'],
        ['the subject binding', 'src/scripts/_lib/ratification_subject.ts'],
        ['the ratification contract', 'docs/contracts/ratification-artifact.md'],
        ['the predicate record', 'agents/evidence/council/authority-routing-20261007.md'],
        ['an ai_council module', 'src/scripts/ai_council/orchestrator.ts'],
        ['a council script', 'src/scripts/council_cli.ts'],
        ['a council library module', 'src/scripts/_lib/council_transport.ts'],
        ['the ai-council skill', 'src/skills/ai-council/SKILL.md'],
        ['the council-availability rule', 'src/rules/council-availability.md'],
        ['the evaluator-independence rule', 'src/rules/evaluator-independence.md'],
    ])('%s is needs-owner', (_name, p) => {
        expect(verdict(p)).toBe('needs-owner');
    });
});

describe('the near-misses stay where they were', () => {
    it('a CI workflow alone stays needs-council', () => {
        expect(verdict('.github/workflows/tests.yml')).toBe('needs-council');
    });

    it('a consequence-class rule alone is needs-council, not needs-owner', () => {
        expect(verdict('src/rules/tool-safety.md')).toBe('needs-council');
    });

    it('a merge-rule carrier alone is needs-council', () => {
        expect(verdict('src/agent-src/contexts/execution/roadmap-process-loop.md')).toBe('needs-council');
    });

    it('a docs edit stays routine', () => {
        expect(verdict('docs/guides/parallel-sessions.md')).toBe('routine');
    });

    it('a script that only shares a word with the council stays routine', () => {
        expect(verdict('src/scripts/check_councillor_names.ts')).toBe('routine');
    });
});

describe('precedence of the three verdicts', () => {
    it('owner beats council, council beats routine', () => {
        expect(verdictOf([])).toBe('routine');
        expect(verdictOf([{ id: 'ci-workflow', rule: 'r', paths: ['x'] }])).toBe('needs-council');
        expect(
            verdictOf([
                { id: 'ci-workflow', rule: 'r', paths: ['x'] },
                { id: 'governance-surface', rule: 'r', paths: ['y'] },
            ]),
        ).toBe('needs-owner');
    });

    it('a mixed diff is needs-owner and still lists the council trigger', () => {
        const r = classifyChanges([mod('.github/workflows/tests.yml'), mod('src/scripts/council_cli.ts')], {
            dirExistsInHead: () => true,
            decisionPolicy: () => 'other',
            consequenceMembers: new Set(),
        });
        expect(r.verdict).toBe('needs-owner');
        expect(r.triggers.map((t) => t.id)).toEqual(['ci-workflow', 'council-surface']);
    });

    it('every owner trigger fires on a path of its own and alone makes the verdict needs-owner', () => {
        const witness: Record<string, string> = {
            'governance-surface': 'src/rules/non-destructive-by-default.md',
            'merge-authority-surface': 'src/scripts/classify_merge_risk.ts',
            'reviewer-trust-chain': 'src/scripts/_lib/ratification_subject.ts',
            'council-surface': 'src/scripts/council_cli.ts',
            'ratification-contract': 'docs/contracts/ratification-artifact.md',
            'owner-reserved-decision': 'docs/decisions/ADR-281-x.md',
        };
        expect(Object.keys(witness).sort()).toEqual([...OWNER_TRIGGERS].sort());
        for (const [id, p] of Object.entries(witness)) {
            const r = classifyChanges([mod(p)], {
                dirExistsInHead: () => true,
                decisionPolicy: () => 'owner',
                consequenceMembers: new Set(),
            });
            expect(r.triggers.map((t) => t.id)).toEqual([id]);
            expect(r.verdict).toBe('needs-owner');
        }
    });
});

describe('main — exit 2 and the verdict on the last line', () => {
    it('a range touching the council exits 2 with verdict: needs-owner', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmr-owner-'));
        const g = (...args: string[]): void => {
            const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
            if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr ?? ''}`);
        };
        g('init', '-q', '-b', 'main');
        g('config', 'user.email', 't@example.com');
        g('config', 'user.name', 'T');
        fs.writeFileSync(path.join(dir, 'README.md'), 'base\n');
        g('add', '-A');
        g('commit', '-q', '-m', 'base');
        fs.mkdirSync(path.join(dir, 'src', 'scripts'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'src', 'scripts', 'council_cli.ts'), 'export {};\n');
        g('add', '-A');
        g('commit', '-q', '-m', 'council');
        const out: string[] = [];
        const code = main(['--range', 'HEAD~1...HEAD', '--root', dir], (l) => out.push(l));
        expect(out[out.length - 1]).toMatch(/^verdict: needs-owner \(1 trigger\(s\): council-surface\)$/u);
        expect(code).toBe(2);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
