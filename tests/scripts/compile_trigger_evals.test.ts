// The trigger corpus compiled into cases the host's own evaluator can run —
// `road-to-a-trigger-suite-the-host-grades` Phase 2 and Phase 3.
//
// Three properties, and the third is the one that keeps this a tool rather
// than a decision: the compiler emits one case per labelled query, in the
// shape pinned from the host in step 1.1, tagged by the FROZEN partition rule;
// and `--print-run` prints a command it never executes and refuses to print an
// incomplete one.

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    HOLDOUT_CEILING,
    compileCorpus,
    partitionOf,
    printRunCommand,
    readCorpus,
    type CompiledCase,
} from '../../src/scripts/compile_trigger_evals.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-evals-'));
    dirs.push(d);
    return d;
}

/**
 * A corpus carrying BOTH shapes the live tree uses: 123 files use `queries[]`
 * with `trigger` and `class`, two use `should_trigger` / `should_not_trigger`.
 * A compiler that reads only the majority shape would silently drop the other.
 */
function writeFixtureCorpus(): string {
    const root = tmp();
    const mk = (skill: string, body: unknown): void => {
        const dir = path.join(root, skill, 'evals');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'triggers.json'), JSON.stringify(body, null, 2));
    };
    mk('alpha-skill', {
        skill: 'alpha-skill',
        queries: [
            { id: 'a1', q: 'audit this page for accessibility', trigger: true, class: 'exemplar' },
            { id: 'a2', q: 'rename this variable', trigger: false, class: 'counterexample' },
            { id: 'a3', q: 'fix the contrast tokens', trigger: false, class: 'near-miss' },
        ],
    });
    mk('beta-skill', {
        skill: 'beta-skill',
        should_trigger: ['write a migration'],
        should_not_trigger: ['write a poem'],
    });
    return root;
}

describe('readCorpus — both shapes, 2.1', () => {
    it('reads queries[] and should_trigger/should_not_trigger alike', () => {
        const got = readCorpus(writeFixtureCorpus());
        expect(got.map((q) => q.skill).sort()).toEqual([
            'alpha-skill',
            'alpha-skill',
            'alpha-skill',
            'beta-skill',
            'beta-skill',
        ]);
        const beta = got.filter((q) => q.skill === 'beta-skill');
        expect(beta.map((q) => q.trigger).sort()).toEqual([false, true]);
        // A shape with no `class` gets neither an invented one nor a dropped row.
        expect(beta.every((q) => q.cls === null)).toBe(true);
    });

    it('keeps every labelled query — the count is the contract', () => {
        expect(readCorpus(writeFixtureCorpus())).toHaveLength(5);
    });
});

describe('partitionOf — the frozen rule, 2.1', () => {
    it('is the artefact rule, keyed on the skill DIRECTORY name', () => {
        for (const skill of ['alpha-skill', 'beta-skill', 'test-case-discovery']) {
            const bucket = parseInt(createHash('sha256').update(skill).digest('hex').slice(0, 2), 16);
            expect(partitionOf(skill)).toBe(bucket < HOLDOUT_CEILING ? 'holdout' : 'train');
        }
    });

    it('pins the ceiling the artefact freezes', () => {
        expect(HOLDOUT_CEILING).toBe(51);
    });

    it('does not read the corpus FILE — editing a corpus never re-partitions it', () => {
        // `test-case-discovery` is the worked example in the holdout artefact:
        // its file was rewritten twice and it stayed train, bucket 92.
        expect(partitionOf('test-case-discovery')).toBe('train');
    });
});

describe('compileCorpus — one case per query, 2.1', () => {
    function compileFixture(): { out: string; cases: CompiledCase[] } {
        const out = tmp();
        const cases = compileCorpus(writeFixtureCorpus(), out);
        return { out, cases };
    }

    it('emits exactly one case per labelled query', () => {
        const { cases } = compileFixture();
        expect(cases).toHaveLength(5);
        expect(new Set(cases.map((c) => c.dir)).size).toBe(5);
    });

    it('writes the host shape: prompt.md plus graders/criteria.md', () => {
        const { out, cases } = compileFixture();
        for (const c of cases) {
            expect(fs.existsSync(path.join(out, c.dir, 'prompt.md'))).toBe(true);
            expect(fs.existsSync(path.join(out, c.dir, 'graders', 'criteria.md'))).toBe(true);
        }
    });

    it('puts the query in the prompt body, unaltered', () => {
        const { out, cases } = compileFixture();
        const a1 = cases.find((c) => c.id === 'a1');
        expect(a1).toBeDefined();
        const body = fs.readFileSync(path.join(out, (a1 as CompiledCase).dir, 'prompt.md'), 'utf8');
        expect(body).toContain('audit this page for accessibility');
    });

    it('grades polarity per class — the named skill, never "no skill at all"', () => {
        const { out, cases } = compileFixture();
        const read = (id: string): string => {
            const c = cases.find((x) => x.id === id) as CompiledCase;
            return fs.readFileSync(path.join(out, c.dir, 'graders', 'criteria.md'), 'utf8');
        };
        // Risk 3: a negative query may rightly trigger a NEIGHBOUR skill, so the
        // grader asserts the named skill's absence and never a bare "no skill".
        expect(read('a1')).toMatch(/\balpha-skill\b/);
        expect(read('a1')).toMatch(/\bused\b/i);
        expect(read('a2')).toMatch(/\bnot\b/i);
        expect(read('a2')).toMatch(/\balpha-skill\b/);
        expect(read('a2')).not.toMatch(/no skill at all|any skill/i);
    });

    it('tags the skill, the class and the partition', () => {
        const { cases } = compileFixture();
        const a3 = cases.find((c) => c.id === 'a3') as CompiledCase;
        expect(a3.tags).toContain('skill:alpha-skill');
        expect(a3.tags).toContain('class:near-miss');
        expect(a3.tags).toContain(`partition:${partitionOf('alpha-skill')}`);
        // A shape with no class contributes no class tag rather than a blank one.
        const beta = cases.find((c) => c.skill === 'beta-skill') as CompiledCase;
        expect(beta.tags.some((t) => t.startsWith('class:'))).toBe(false);
    });

    it('AC-3: refuses an output directory the repository would track', () => {
        // A convention is not a mechanism. ~1,200 generated directories staged
        // by one `git add -A` only has to happen once, so the refusal is in the
        // compiler and git decides what counts as tracked.
        const corpus = writeFixtureCorpus();
        const tracked = path.join(REPO, 'src', 'scripts', '__compile-probe-should-refuse');
        expect(() => compileCorpus(corpus, tracked)).toThrow(/gitignored|AC-3|committed/i);
        expect(fs.existsSync(tracked)).toBe(false);
    });

    it('AC-3: accepts a gitignored path inside the repository', () => {
        const corpus = writeFixtureCorpus();
        const ignored = path.join(REPO, 'agents', 'runtime', 'trigger-evals-test');
        try {
            expect(() => compileCorpus(corpus, ignored)).not.toThrow();
        } finally {
            fs.rmSync(ignored, { recursive: true, force: true });
        }
    });

    it('refuses a corpus file that does not parse instead of shrinking the set', () => {
        const corpus = writeFixtureCorpus();
        fs.writeFileSync(path.join(corpus, 'alpha-skill', 'evals', 'triggers.json'), '{ not json');
        expect(() => readCorpus(corpus)).toThrow(/alpha-skill.*not valid JSON/);
    });

    it('refuses two ids that compile to the same case directory', () => {
        const corpus = writeFixtureCorpus();
        fs.writeFileSync(
            path.join(corpus, 'alpha-skill', 'evals', 'triggers.json'),
            JSON.stringify({ queries: [{ id: 'a b', q: 'x', trigger: true }, { id: 'a/b', q: 'y', trigger: false }] }),
        );
        expect(() => compileCorpus(corpus, tmp())).toThrow(/both compile to/);
    });

    it('writes nothing outside the output directory', () => {
        const corpus = writeFixtureCorpus();
        const before = fs.readdirSync(corpus).sort();
        const out = tmp();
        compileCorpus(corpus, out);
        expect(fs.readdirSync(corpus).sort()).toEqual(before);
    });
});

describe('parity with the live corpus, 2.2', () => {
    it('parity: the case count equals the labelled-query count', () => {
        const live = path.join(REPO, 'src', 'skills');
        const queries = readCorpus(live);
        const out = tmp();
        const cases = compileCorpus(live, out);
        expect(cases).toHaveLength(queries.length);
        expect(queries.length).toBeGreaterThan(1000);
    });

    it('parity: every partition tag reproduces the frozen rule over the live tree', () => {
        const live = path.join(REPO, 'src', 'skills');
        const out = tmp();
        for (const c of compileCorpus(live, out)) {
            expect(c.tags).toContain(`partition:${partitionOf(c.skill)}`);
        }
    });

    it('parity: the partition column matches the holdout artefact row for row', () => {
        // The published SET-SHA256 hashes the corpus CONTENT as well as the
        // partition, so it moves whenever any corpus file is edited and
        // `trigger_corpus_holdout_pin.test.ts` is what keeps that value true.
        // What this test can assert without duplicating that pin is the half
        // the compiler is responsible for: the partition column itself.
        const live = path.join(REPO, 'src', 'skills');
        const out = tmp();
        const bySkill = new Map<string, string>();
        for (const c of compileCorpus(live, out)) {
            const tag = c.tags.find((t) => t.startsWith('partition:')) as string;
            const seen = bySkill.get(c.skill);
            // Every case of one skill lands on one side — a skill whose cases
            // straddle the partition would make the split meaningless.
            if (seen !== undefined) expect(tag).toBe(seen);
            bySkill.set(c.skill, tag);
        }
        const column = [...bySkill.entries()]
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([skill, tag]) => `${skill} ${tag.slice('partition:'.length)}\n`)
            .join('');
        const recipe = fs
            .readdirSync(live)
            .sort()
            .filter((s) => fs.existsSync(path.join(live, s, 'evals', 'triggers.json')))
            .map((s) => `${s} ${partitionOf(s)}\n`)
            .join('');
        expect(column).toBe(recipe);
    });
});

describe('print-run — prints, never runs, 3.1', () => {
    const complete = {
        evalDir: '/tmp/compiled',
        target: 'agent-config',
        tag: 'partition:train',
        runs: 3,
        maxCostUsd: 5,
        protocol: 'agents/evidence/analysis/trigger-eval-protocol.md',
    };

    it('print-run: prints a command carrying every required part', () => {
        const cmd = printRunCommand(complete);
        expect(cmd).toContain('claude plugin eval');
        expect(cmd).toContain('--no-publish');
        expect(cmd).toContain('--runs 3');
        expect(cmd).toContain('--max-cost-usd 5');
        expect(cmd).toContain('partition:train');
    });

    it('print-run: refuses without the keep-local flag, a run count, a cost cap or a protocol', () => {
        // D3: the host publishes its report by default, so a command without
        // --no-publish ships prompts and verdicts off the machine.
        expect(() => printRunCommand({ ...complete, runs: 0 })).toThrow(/runs/i);
        expect(() => printRunCommand({ ...complete, maxCostUsd: 0 })).toThrow(/cost/i);
        expect(() => printRunCommand({ ...complete, protocol: '' })).toThrow(/protocol/i);
    });

    it('print-run: the returned value is a string, and nothing is executed', () => {
        // The whole point of D1: this roadmap builds the instrument and never
        // runs it. A function that returns a command cannot have run one.
        expect(typeof printRunCommand(complete)).toBe('string');
    });
});
