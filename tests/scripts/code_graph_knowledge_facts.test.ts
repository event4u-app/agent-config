/**
 * I.2 — committed knowledge as facts: ADRs in both layouts, memory entries
 * with `about` edges, moved paths told apart from gone ones.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { collectKnowledge, namedPaths } from '../../src/scripts/code_graph/knowledge_facts.js';
import { Repo } from './_bugs/repo.js';

let repo: Repo;
beforeEach(() => {
    repo = new Repo();
    repo.write('docs/decisions/ADR-001-first.md', '# ADR-001\n');
    repo.write('docs/adrs/cost/0001-hard-stop.md', '# cost 1\n');
    repo.write('docs/adrs/cost/README.md', '# not a record\n');
    repo.write('src/old_name.ts', 'export {};\n');
    repo.write('src/kept.ts', 'export {};\n');
    repo.commit('feat: seed');
    repo.run('mv', 'src/old_name.ts', 'src/new_name.ts');
    repo.commit('refactor: rename');
    repo.write(
        'agents/memory/product-rules.yml',
        [
            'version: 1',
            'entries:',
            '  - id: rule-a',
            '    body: "see `src/kept.ts` and src/old_name.ts:12 and src/vanished.ts (PR #42)"',
            '  - id: rule-b',
            '    body: "no paths, https://example.com/a/b.html is a url"',
        ].join('\n'),
    );
    repo.write('agents/knowledge/how-we-test.md', '# page\n');
    repo.write('agents/decisions/ledger.jsonl', '{}\n');
    repo.write('agents/owner-questions.md', '# q\n');
    repo.write('agents/proposals/README.md', '# readme\n');
    repo.write('agents/proposals/retro-1.md', '# proposal\n');
    repo.write('agents/evidence/reviews/pr-77.findings.md', '# review\n');
    repo.commit('docs: knowledge');
});
afterEach(() => repo.cleanup());

describe('namedPaths', () => {
    it('finds paths with a directory and an extension, not urls', () => {
        expect(namedPaths('see `src/a.ts`, lib/b.js:3, https://x.io/c/d.html and plain.ts')).toEqual(['lib/b.js', 'src/a.ts']);
    });
});

describe('collectKnowledge', () => {
    const facts = () => collectKnowledge(repo.dir, { git: repo.git });

    it('ADRs in both layouts are decision nodes; a topic README is not', () => {
        const ids = facts().nodes.filter((n) => n.kind === 'decision').map((n) => n.label);
        expect(ids).toEqual(['ADR-001', 'cost/0001-hard-stop']);
    });

    it('memory entries link to the paths they name; moved and gone are told apart', () => {
        const f = facts();
        expect(f.edges).toEqual([
            { source: 'memory:rule-a', target: 'src/kept.ts', relation: 'about' },
            { source: 'memory:rule-a', target: 'src/new_name.ts', relation: 'about' },
        ]);
        expect(f.findings).toEqual([
            { memory: 'memory:rule-a', path: 'src/old_name.ts', state: 'moved', now: 'src/new_name.ts' },
            { memory: 'memory:rule-a', path: 'src/vanished.ts', state: 'gone', now: null },
        ]);
        expect(f.nodes.find((n) => n.id === 'memory:rule-a')?.pr).toBe('#42');
    });

    it('pages, ledgers, owner questions, proposals and reviews are nodes; a review links by PR number', () => {
        const kinds = facts().nodes.map((n) => `${n.kind}:${n.file}`);
        expect(kinds).toEqual(
            expect.arrayContaining([
                'page:agents/knowledge/how-we-test.md',
                'ledger:agents/decisions/ledger.jsonl',
                'owner-question:agents/owner-questions.md',
                'proposal:agents/proposals/retro-1.md',
                'review:agents/evidence/reviews/pr-77.findings.md',
            ]),
        );
        expect(kinds).not.toContain('proposal:agents/proposals/README.md');
        expect(facts().nodes.find((n) => n.kind === 'review')?.pr).toBe('#77');
    });
});
