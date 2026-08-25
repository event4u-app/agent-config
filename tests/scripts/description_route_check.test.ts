import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    type Backend,
    type Case,
    CachedBackend,
    DryBackend,
    cacheKey,
    catalogueHash,
    describesAUnit,
    evaluate,
    render,
    scopeCases,
    scopeRun,
} from '../../src/scripts/description_route_check.js';
import { type SkillMeta } from '../../src/scripts/skill_trigger_eval.js';

const CAT: SkillMeta[] = [
    { name: 'alpha', description: 'handles alpha things' },
    { name: 'beta', description: 'handles beta things' },
];

let tmp = '';
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drc-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

/** Counts every call so a cache that quietly re-calls cannot pass as a cache. */
class CountingBackend implements Backend {
    name = 'counting';
    calls = 0;
    constructor(private readonly answer: string[]) {}
    route(): string[] {
        this.calls += 1;
        return this.answer;
    }
}

describe('the dry backend', () => {
    it('runs with no key, no network and no spend', () => {
        const r = evaluate([{ unit: 'alpha', prompt: 'do alpha now', expect: true }], CAT, new DryBackend());
        expect(r.blocked).toBe(0);
        expect(r.backend).toBe('dry');
    });
});

describe('the cache', () => {
    it('serves a repeated (catalogue-hash, prompt) pair with ZERO further calls', () => {
        const inner = new CountingBackend(['alpha']);
        const cached = new CachedBackend(inner, path.join(tmp, 'c'));
        const cases: Case[] = [{ unit: 'alpha', prompt: 'p', expect: true }];

        evaluate(cases, CAT, cached);
        expect(inner.calls).toBe(1);

        // The load-bearing assertion: a second identical run must not call at
        // all. A cache that re-called would still be green on the verdict.
        evaluate(cases, CAT, cached);
        expect(inner.calls).toBe(1);
        expect(cached.calls).toBe(1);
    });

    it('MISSES when any description changes — the routing condition moved', () => {
        const inner = new CountingBackend(['alpha']);
        const cached = new CachedBackend(inner, path.join(tmp, 'c'));
        const cases: Case[] = [{ unit: 'alpha', prompt: 'p', expect: true }];

        evaluate(cases, CAT, cached);
        expect(inner.calls).toBe(1);

        const edited: SkillMeta[] = [{ ...CAT[0]!, description: 'REWRITTEN' }, CAT[1]!];
        evaluate(cases, edited, cached);
        // A prompt-only key would have served the stale answer here — exactly
        // when the answer changed. That is the defect this key shape prevents.
        expect(inner.calls).toBe(2);
    });

    it('is insensitive to catalogue ORDER, which is not part of the routing condition', () => {
        expect(catalogueHash(CAT)).toBe(catalogueHash([CAT[1]!, CAT[0]!]));
        expect(cacheKey(CAT, 'p')).toBe(cacheKey([CAT[1]!, CAT[0]!], 'p'));
    });

    it('distinguishes two different prompts under one catalogue', () => {
        expect(cacheKey(CAT, 'a')).not.toBe(cacheKey(CAT, 'b'));
    });
});

describe('the fail direction is recall-first', () => {
    it('BLOCKS when a positive stops loading', () => {
        const r = evaluate(
            [{ unit: 'alpha', prompt: 'p', expect: true }],
            CAT,
            new CountingBackend([]),
        );
        expect(r.blocked).toBe(1);
        expect(r.warned).toBe(0);
        expect(r.findings[0]?.direction).toBe('recall');
        let out = '';
        expect(render(r, (s) => (out += s))).toBe(1);
        expect(out).toContain('BLOCK');
    });

    it('WARNS, and does not block, when a near-miss starts loading', () => {
        const r = evaluate(
            [{ unit: 'alpha', prompt: 'p', expect: false }],
            CAT,
            new CountingBackend(['alpha']),
        );
        expect(r.warned).toBe(1);
        expect(r.blocked).toBe(0);
        expect(r.findings[0]?.direction).toBe('precision');
        let out = '';
        // Exit 0: an extra unit loading is a token cost, not a missing
        // obligation. Blocking on it would invert D2's measured direction.
        expect(render(r, (s) => (out += s))).toBe(0);
        expect(out).toContain('WARN');
    });

    it('reports both directions in one run without either masking the other', () => {
        const backend = new CountingBackend(['beta']);
        const r = evaluate(
            [
                { unit: 'alpha', prompt: 'p', expect: true },
                { unit: 'beta', prompt: 'p', expect: false },
            ],
            CAT,
            backend,
        );
        expect(r.blocked).toBe(1);
        expect(r.warned).toBe(1);
        expect(render(r, () => undefined)).toBe(1);
    });

    it('is green when every positive loads and every near-miss stays out', () => {
        const r = evaluate(
            [
                { unit: 'alpha', prompt: 'run alpha', expect: true },
                { unit: 'beta', prompt: 'run alpha', expect: false },
            ],
            CAT,
            new DryBackend(),
        );
        expect(r.findings).toEqual([]);
        expect(render(r, () => undefined)).toBe(0);
    });
});

describe('sensitivity', () => {
    it('a corpus with no cases proves nothing and says so rather than passing loudly', () => {
        const r = evaluate([], CAT, new DryBackend());
        expect(r.cases).toBe(0);
        let out = '';
        render(r, (s) => (out += s));
        // Zero cases is still exit 0 — an empty diff scope is the normal state
        // for a diff-scoped gate. What must not happen is a claim of coverage:
        // the count is printed, so a reader sees the corpus was empty.
        expect(out).toContain('0 case(s)');
    });
});

describe('diff scoping stays inside the existing key boundary', () => {
    it('a FORK PR leaves the advisory path untouched', () => {
        const d = scopeRun({
            isFork: true,
            changedFiles: ['src/skills/alpha/SKILL.md'],
        });
        expect(d.mode).toBe('advisory');
        expect(d.units).toEqual([]);
        // Refused before any spend, with a reason — not an error at the router.
        expect(d.reason).toContain('key file is unreachable');
    });

    it('a non-description diff leaves the advisory path untouched', () => {
        const d = scopeRun({
            isFork: false,
            changedFiles: ['src/scripts/foo.ts', 'README.md', 'src/skills/alpha/references/x.md'],
        });
        expect(d.mode).toBe('advisory');
        expect(d.units).toEqual([]);
    });

    it('a same-repo description edit triggers the scoped run', () => {
        const d = scopeRun({
            isFork: false,
            changedFiles: ['src/skills/alpha/SKILL.md', 'src/rules/beta.md'],
        });
        expect(d.mode).toBe('scoped-live');
        expect(d.units).toEqual(['alpha', 'beta']);
    });

    it('counts the PROJECTION too — a dist-only edit is what a host actually reads', () => {
        expect(describesAUnit('dist/agent-src/skills/alpha/SKILL.md')).toBe('alpha');
        expect(describesAUnit('dist/agent-src/rules/beta.md')).toBe('beta');
        // A source-only filter would miss exactly this case.
        const d = scopeRun({ isFork: false, changedFiles: ['dist/agent-src/rules/beta.md'] });
        expect(d.mode).toBe('scoped-live');
    });

    it('does not treat a non-SKILL.md file inside a skill as a description', () => {
        expect(describesAUnit('src/skills/alpha/evals/triggers.json')).toBeNull();
        expect(describesAUnit('src/skills/alpha/references/procedure.md')).toBeNull();
    });

    it('deduplicates a unit whose source AND projection both changed', () => {
        const d = scopeRun({
            isFork: false,
            changedFiles: ['src/rules/beta.md', 'dist/agent-src/rules/beta.md'],
        });
        expect(d.units).toEqual(['beta']);
    });

    it('narrows the corpus to the touched units, so an untouched unit costs nothing', () => {
        const cases: Case[] = [
            { unit: 'alpha', prompt: 'a', expect: true },
            { unit: 'gamma', prompt: 'g', expect: true },
        ];
        expect(scopeCases(cases, ['alpha'])).toHaveLength(1);
        expect(scopeCases(cases, [])).toEqual([]);
    });
});
