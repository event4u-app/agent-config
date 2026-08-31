/**
 * Step 6.2 — one matcher, and a detector that fires if a second appears
 * (road-to-governed-harness-evolution, Phase 6).
 *
 * > *Preserve one matcher. The tree already enforces it:
 * > `src/scripts/_lib/rule_injection.ts:1-19` is "THE single module both the
 * > offline model and the runtime concern read", trigger semantics live in
 * > `_lib/router_match.ts` as "the single implementation for every surface",
 * > and `tests/scripts/router_match_parity.test.ts` pins it. An experiment
 * > whose offline pricing and runtime delivery use different matchers measures
 * > nothing.*
 * > verify: **the parity test stays green and no second matcher is introduced.**
 *
 * The verify clause has two conjuncts and only one of them was covered. The
 * parity test pins the matcher's BEHAVIOUR against the reference; nothing
 * asserted that a SECOND implementation had not appeared beside it, and the
 * parity test would stay green on the day it did — a rival matcher in another
 * file changes none of `router_match.ts`'s outputs. This file is the second
 * conjunct.
 *
 * ## What counts as a second matcher, and what deliberately does not
 *
 * The banned set is the three TRIGGER-SEMANTIC symbols `router_match` exports:
 * `trigger_matches`, `match_prompt`, `keyword_matches_anchored`. `_fnmatch` is
 * NOT in it, and that exclusion is load-bearing rather than lenient — it is a
 * generic glob helper declared privately in six unrelated files on this tree
 * (`memory_lookup`, `cross_repo_retrieve`, `bench_ab_clone`,
 * `check_release_pr_shape`, `check_no_external_sources`, and the templated
 * `memory_lookup`), none of which answers "which rules fire on this prompt?".
 * Banning it would make this gate red on arrival for six pre-existing files and
 * it would be deleted within the week.
 *
 * ## The detector is proved against a real declaration, not only a synthetic one
 *
 * A scanner tested only on hand-written strings can be silently wrong about the
 * real syntax it has to read. So the sensitivity case lifts the exclusion and
 * asserts the detector DOES find the declarations inside `router_match.ts`
 * itself — the one file that legitimately has them.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(REPO, 'src');
const CANONICAL = path.join(SRC, 'scripts', '_lib', 'router_match.ts');
const RULE_INJECTION = path.join(SRC, 'scripts', '_lib', 'rule_injection.ts');

/** The trigger-semantic surface. Deliberately excludes the generic `_fnmatch`. */
export const MATCHER_SYMBOLS = ['trigger_matches', 'match_prompt', 'keyword_matches_anchored'] as const;

export function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Symbols this source DECLARES (as opposed to imports). */
export function findMatcherDeclarations(source: string): string[] {
    const body = stripComments(source);
    const found: string[] = [];
    for (const sym of MATCHER_SYMBOLS) {
        const fn = new RegExp(`^\\s*(export\\s+)?(async\\s+)?function\\s+${sym}\\b`, 'm');
        const bound = new RegExp(`^\\s*(export\\s+)?(const|let|var)\\s+${sym}\\s*[:=]`, 'm');
        const method = new RegExp(`^\\s*${sym}\\s*\\([^)]*\\)\\s*[:{]`, 'm');
        if (fn.test(body) || bound.test(body) || method.test(body)) {
            found.push(sym);
        }
    }
    return found;
}

function allSources(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
            const full = path.join(dir, entry);
            if (statSync(full).isDirectory()) {
                walk(full);
            } else if (entry.endsWith('.ts')) {
                out.push(full);
            }
        }
    };
    walk(SRC);
    return out.sort();
}

describe('6.2 — the detector works before it is trusted', () => {
    it('FIRES on a declaration in any of the three shapes (negative polarity)', () => {
        expect(findMatcherDeclarations('export function trigger_matches(t, p) { return true; }')).toEqual([
            'trigger_matches',
        ]);
        expect(findMatcherDeclarations('const match_prompt = (p) => [];')).toEqual(['match_prompt']);
        expect(
            findMatcherDeclarations('class M {\n    keyword_matches_anchored(a: string): boolean {\n        return true;\n    }\n}'),
        ).toEqual(['keyword_matches_anchored']);
    });

    it('is silent on an IMPORT or a call of the same symbols (positive polarity)', () => {
        expect(findMatcherDeclarations("import { match_prompt } from './router_match.js';")).toEqual([]);
        expect(findMatcherDeclarations('const out = match_prompt(router, prompt);')).toEqual([]);
        expect(findMatcherDeclarations('export { trigger_matches };')).toEqual([]);
    });

    it('does NOT ban `_fnmatch` — a generic glob helper is not a trigger matcher', () => {
        expect(MATCHER_SYMBOLS as readonly string[]).not.toContain('_fnmatch');
        expect(findMatcherDeclarations('function _fnmatch(n: string, p: string) { return false; }')).toEqual(
            [],
        );
    });

    it('finds the declarations in the REAL canonical module (sensitivity on real syntax)', () => {
        const found = findMatcherDeclarations(readFileSync(CANONICAL, 'utf-8'));
        expect(found.sort()).toEqual([...MATCHER_SYMBOLS].sort());
    });
});

describe('6.2 — no second matcher exists', () => {
    const sources = allSources();

    it('scans a real population (a scan over nothing exits green)', () => {
        expect(sources.length).toBeGreaterThan(100);
        expect(sources).toContain(CANONICAL);
    });

    it('router_match.ts is the ONLY file declaring the trigger-semantic symbols', () => {
        const declaring: Record<string, string[]> = {};
        for (const f of sources) {
            if (f === CANONICAL) continue;
            const found = findMatcherDeclarations(readFileSync(f, 'utf-8'));
            if (found.length > 0) declaring[path.relative(REPO, f)] = found;
        }
        expect(declaring).toEqual({});
    });

    it('rule_injection.ts wraps the canonical matcher rather than owning one', () => {
        const body = readFileSync(RULE_INJECTION, 'utf-8');
        expect(body).toContain("from './router_match.js'");
        expect(findMatcherDeclarations(body)).toEqual([]);
    });

    it('the parity test that pins the matcher still exists', () => {
        const parity = path.join(REPO, 'tests', 'scripts', 'router_match_parity.test.ts');
        expect(() => statSync(parity)).not.toThrow();
        expect(readFileSync(parity, 'utf-8')).toContain('router_match');
    });
});
