import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BUDGET_TOKENS, DIGEST, MAX_WORDS, collect, describe as describeRoadmap, main, overBudget, render } from '../../src/scripts/generate_owned_digest.js';
import { REGISTRY } from '../../src/scripts/check_generator_sync.js';

const ROOT = path.resolve(__dirname, '..', '..');

function roadmap(goal: string | null, opts: { status?: string; title?: string; body?: string } = {}): string {
    const fm = opts.status === undefined ? '' : `---\nstatus: ${opts.status}\n---\n\n`;
    const g = goal === null ? '' : `## Goal\n\n${goal}\n\n`;
    return `${fm}# ${opts.title ?? 'Road to a fixture'}\n\n${g}## Phase 1 — work\n\n${opts.body ?? '- [ ] **1.1 a step**'}\n`;
}

describe('describe — what a roadmap owns', () => {
    it('takes the first sentence of a goal paragraph that wraps over several lines', () => {
        const text = roadmap('A finding with an owner lands on that owner\ninstead of as a new file. The second sentence is not read.');
        expect(describeRoadmap(text)).toBe('A finding with an owner lands on that owner instead of as a new file.');
    });

    it('falls back to the title, without a Roadmap: or Stub: prefix, when there is no goal', () => {
        expect(describeRoadmap(roadmap(null, { title: 'Roadmap: Contract integrity' }))).toBe('Contract integrity');
        expect(describeRoadmap(roadmap(null, { title: 'Stub: road to a census' }))).toBe('road to a census');
    });

    it(`caps at ${String(MAX_WORDS)} words and marks the cut`, () => {
        const words = Array.from({ length: MAX_WORDS + 7 }, (_, i) => `w${String(i)}`);
        const out = describeRoadmap(roadmap(`${words.join(' ')}.`));
        expect(out.split(' ')).toHaveLength(MAX_WORDS + 1);
        expect(out.endsWith(' …')).toBe(true);
        expect(out.startsWith(words.slice(0, MAX_WORDS).join(' '))).toBe(true);
    });

    it('escapes a pipe and drops emphasis and link targets, so a row stays one table row', () => {
        const out = describeRoadmap(roadmap('**Every** `a|b` reaches [the gate](docs/x.md).'));
        expect(out).toBe('Every `a\\|b` reaches the gate.');
    });

    it('reads past a list marker that opens the goal', () => {
        expect(describeRoadmap(roadmap('1. One resolver answers the question. More.'))).toBe('One resolver answers the question.');
    });
});

describe('generate_owned_digest over a fixture tree', () => {
    let root: string;
    const write = (rel: string, text: string): void => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), text);
    };

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'owned-digest-'));
        write('agents/roadmaps/road-to-b.md', roadmap('B owns the second thing.', { status: 'ready' }));
        write('agents/roadmaps/road-to-a.md', roadmap('A owns the first thing.', { status: 'draft' }));
        write('agents/roadmaps/README.md', '# not a roadmap\n');
        write('agents/roadmaps/later/road-to-c.md', roadmap('C waits.', { status: 'later' }));
        write('agents/roadmaps/later/README.md', '# not a roadmap\n');
        write('agents/roadmaps/stubs/road-to-d.md', roadmap(null, { title: 'Stub: road to d' }));
        write('agents/roadmaps/archive/road-to-e.md', roadmap('E is finished.'));
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('rows every active, later and stub roadmap, and nothing archived or named README', () => {
        const rows = collect(root).map((e) => `${e.dir}/${e.slug}/${e.status}`);
        expect(rows).toEqual(['/road-to-a/draft', '/road-to-b/ready', 'later/road-to-c/later', 'stubs/road-to-d/—']);
    });

    it('check is red when the digest is missing, green once written', () => {
        expect(main(['--check'], root)).toBe(1);
        expect(main([], root)).toBe(0);
        expect(main(['--check'], root)).toBe(0);
    });

    it('a-checkbox-flip-leaves-the-digest-unchanged, a goal rewrite does not', () => {
        expect(main([], root)).toBe(0);
        write('agents/roadmaps/road-to-a.md', roadmap('A owns the first thing.', { status: 'draft', body: '- [x] **1.1 a step**\n- [ ] **1.2 a new note**' }));
        expect(main(['--check'], root)).toBe(0);
        write('agents/roadmaps/road-to-a.md', roadmap('A owns something else now.', { status: 'draft' }));
        expect(main(['--check'], root)).toBe(1);
    });

    it('parking a roadmap changes its row', () => {
        expect(main([], root)).toBe(0);
        fs.renameSync(path.join(root, 'agents/roadmaps/road-to-b.md'), path.join(root, 'agents/roadmaps/later/road-to-b.md'));
        expect(main(['--check'], root)).toBe(1);
    });

    it('carries no aggregate line two branches would both rewrite', () => {
        expect(render(collect(root))).not.toMatch(/\b\d+ active\b/);
    });
});

describe('the budget', () => {
    it('reports over budget instead of truncating', () => {
        const text = render([{ slug: 'road-to-x', dir: '', status: 'ready', owns: 'x '.repeat(50).trim() }]);
        expect(overBudget(text, 10)).toMatch(/over its 10-token budget/);
        expect(overBudget(text)).toBeNull();
    });
});

describe('the committed digest', () => {
    it('is current and inside its budget', () => {
        const committed = fs.readFileSync(path.join(ROOT, DIGEST), 'utf8');
        expect(committed).toBe(render(collect(ROOT)));
        expect(overBudget(committed, BUDGET_TOKENS)).toBeNull();
    });

    it('is registered in check_generator_sync over the roadmap tree and the generator', () => {
        const triple = REGISTRY.find((t) => t.output === DIGEST);
        expect(triple).toBeDefined();
        const s = triple?.sourcesOf(ROOT);
        expect(s?.ok ? s.sources.map((m) => m.value) : []).toEqual(expect.arrayContaining(['agents/roadmaps/', 'src/scripts/generate_owned_digest.ts', DIGEST]));
    });
});
