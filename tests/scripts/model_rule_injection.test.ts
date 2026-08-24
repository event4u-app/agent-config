// Fixtures for the ONE matcher both the offline model and the runtime concern
// read (`road-to-trigger-delivered-rule-bodies` step 0.5).
//
// Why these five classes and not a happy path. Step 0.5's whole point is that
// offline pricing and runtime delivery must not diverge, and the divergences
// that actually happen are at the edges: a rule whose triggers overlap (does it
// get delivered once or twice?), a prompt matching nothing (is silence a value
// or a crash?), a prompt matching many (what order, and what gets dropped?), and
// the kernel (already standing — injecting it is paying twice). Each class below
// pins the ANSWER, not the absence of an exception.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    allTierRules,
    kernelIds,
    matchTierRules,
    selectForInjection,
    triggerlessRuleIds,
    type Router,
} from '../../src/scripts/_lib/rule_injection.js';
import {
    loadCorpus,
    quantile,
    runSelftest,
    scoreExact,
    scoreLexical,
} from '../../src/scripts/model_rule_injection.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const CORPUS = path.join(REPO_ROOT, 'tests', 'eval', 'routing-matrix');

/** A throwaway tree with a hand-written router + bodies, for the fixture classes. */
function fixtureRoot(router: Router, bodies: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-inject-fixture-'));
    fs.mkdirSync(path.join(root, 'dist', 'agent-src', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'router.json'), JSON.stringify(router), 'utf-8');
    for (const [id, text] of Object.entries(bodies)) {
        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', `${id}.md`), text, 'utf-8');
    }
    return root;
}

const FIXTURE_ROUTER: Router = {
    kernel: ['kernel-rule'],
    tier_1: [
        { id: 'kernel-rule', triggers: [{ keyword: 'always' }] },
        { id: 'exact-one', triggers: [{ keyword: 'migration' }] },
    ],
    tier_2: [
        // Two triggers that BOTH fire on the same prompt — the collision class.
        { id: 'overlap', triggers: [{ keyword: 'refactor' }, { phrase: 'refactor the exporter' }] },
        { id: 'also-refactor', triggers: [{ keyword: 'refactor' }] },
        { id: 'never', triggers: [{ keyword: 'zzzzz-unreachable' }] },
    ],
} as unknown as Router;

const FIXTURE_BODIES = {
    'kernel-rule': 'kernel body\n',
    'exact-one': 'exact-one body\n',
    overlap: 'overlap body\n',
    'also-refactor': 'also-refactor body\n',
    never: 'never body\n',
};

describe('rule_injection — fixture classes (step 0.5)', () => {
    it('exact trigger: one keyword fires exactly its rule', () => {
        const m = matchTierRules(FIXTURE_ROUTER, 'fix the failing migration');
        expect(m.map((x) => x.id)).toEqual(['exact-one']);
        expect(m[0]?.score).toBe(1);
    });

    it('overlapping triggers: the rule is delivered ONCE, and the score counts both', () => {
        const m = matchTierRules(FIXTURE_ROUTER, 'refactor the exporter please');
        // `overlap` matched two of its triggers; it appears once, scored 2.
        expect(m.filter((x) => x.id === 'overlap')).toHaveLength(1);
        expect(m.find((x) => x.id === 'overlap')?.score).toBe(2);
    });

    it('overlapping triggers: order is ROUTER declaration order, not match order', () => {
        const m = matchTierRules(FIXTURE_ROUTER, 'refactor the exporter please');
        // `overlap` is declared before `also-refactor` and must stay first even
        // though its second trigger matched later in the trigger walk.
        expect(m.map((x) => x.id)).toEqual(['overlap', 'also-refactor']);
        // And the ordering is stable across repeated calls.
        expect(matchTierRules(FIXTURE_ROUTER, 'refactor the exporter please').map((x) => x.id)).toEqual(
            m.map((x) => x.id),
        );
    });

    it('no match: silence is a value, never an error', () => {
        expect(matchTierRules(FIXTURE_ROUTER, 'a prompt about nothing in particular')).toEqual([]);
    });

    it('many matches: the cap drops the lowest-scoring rules and keeps router order', () => {
        const root = fixtureRoot(FIXTURE_ROUTER, FIXTURE_BODIES);
        const m = matchTierRules(FIXTURE_ROUTER, 'refactor the exporter please');
        // A cap of 1 token admits the first body and drops the rest, never zero:
        // one oversized body must not starve the whole injection.
        const sel = selectForInjection(root, m, 1);
        expect(sel.selected).toHaveLength(1);
        expect(sel.dropped.map((x) => x.id)).toEqual(['also-refactor']);
        // Highest score wins the single slot — `overlap` scored 2.
        expect(sel.selected[0]?.id).toBe('overlap');
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('kernel exclusion: a kernel rule never appears in a match set', () => {
        const m = matchTierRules(FIXTURE_ROUTER, 'this prompt says always');
        expect(m.map((x) => x.id)).not.toContain('kernel-rule');
        expect(kernelIds(FIXTURE_ROUTER).has('kernel-rule')).toBe(true);
    });
});

describe('model_rule_injection — over the shipped tree', () => {
    it('the labelled corpus loads positives and near-misses', () => {
        const cases = loadCorpus(CORPUS);
        expect(cases.filter((c) => c.label === 'positive').length).toBeGreaterThan(100);
        expect(cases.filter((c) => c.label === 'near_miss').length).toBeGreaterThan(50);
    });

    it('is deterministic: two loads of the corpus are identical', () => {
        expect(JSON.stringify(loadCorpus(CORPUS))).toBe(JSON.stringify(loadCorpus(CORPUS)));
    });

    it('the exact matcher beats the shipping BM25 core on recall AND false fires (0.3)', () => {
        const cases = loadCorpus(CORPUS);
        const exact = scoreExact(
            JSON.parse(
                fs.readFileSync(path.join(REPO_ROOT, 'dist', 'router.json'), 'utf-8'),
            ) as Router,
            cases,
            true,
        );
        const bm25 = scoreLexical(
            JSON.parse(
                fs.readFileSync(path.join(REPO_ROOT, 'dist', 'router.json'), 'utf-8'),
            ) as Router,
            cases,
            8,
        );
        expect(exact.hits / exact.positives).toBeGreaterThan(bm25.hits / bm25.positives);
        expect(exact.falseFires).toBeLessThan(bm25.falseFires);
    });

    it('the router keeps exactly the four trigger-less rules the residue names (1.3)', () => {
        const router = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'dist', 'router.json'), 'utf-8'),
        ) as Router;
        expect(triggerlessRuleIds(router).sort()).toEqual([
            'no-roadmap-references',
            'rule-type-governance',
            'skill-quality',
            'source-confidentiality',
        ]);
        expect(allTierRules(router).length).toBeGreaterThan(80);
    });

    it('quantiles are nearest-rank and stable', () => {
        expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
        expect(quantile([1, 2, 3, 4, 5], 0.9)).toBe(5);
        expect(quantile([], 0.5)).toBe(0);
    });

    it('every selftest endpoint has a rejecting case and all of them are green (2.2)', () => {
        const results = runSelftest(CORPUS);
        const endpoints = new Set(results.map((r) => r.endpoint));
        expect(endpoints).toEqual(
            new Set(['a-delivery', 'b-recall', 'c-false-fire', 'matcher-mutation']),
        );
        expect(results.filter((r) => !r.passed)).toEqual([]);
    });
});

describe('one matcher, offline and at runtime (step 0.5, AC-4)', () => {
    it('the concern and the model import the SAME module', () => {
        const hook = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'rule_inject_hook.ts'),
            'utf-8',
        );
        const model = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'model_rule_injection.ts'),
            'utf-8',
        );
        // The literal prefixes differ by directory depth; the MODULE is one.
        expect(hook).toContain("_lib/rule_injection.js");
        expect(model).toContain("_lib/rule_injection.js");
        // And neither re-implements the trigger semantics.
        expect(hook).not.toContain('function trigger_matches');
        expect(model).not.toContain('function trigger_matches');
    });
});
