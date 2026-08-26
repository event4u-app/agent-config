// Tests for src/scripts/lint_canonical_terms.ts (road-to-canonical-terms 2.2).
//
// The roadmap's verify clause names FOUR states and asks for all four to be
// demonstrated: the gate reds on a planted wrong-dialect occurrence in prose,
// and stays green on the same word inside a fence, inside a frontmatter value,
// and inside a quoted licence name. Each has its own `it()` below, using the
// SAME word in all four so that a pass cannot come from the word differing.
//
// Sensitivity: `scanContent` is exercised with the protected-span blanking
// deliberately defeated (`defeats the licence carve-out`) so the licence test
// is known to be able to fail — a test never seen red has unknown sensitivity.
import { describe, expect, it } from 'vitest';

import {
    canonicalizeToken,
    loadPairs,
    scanContent,
    type TermPair,
} from '../../src/scripts/lint_canonical_terms.js';

const BEHAVIOUR: TermPair = { canonical: 'behavior', variant: 'behaviour', confidence: 'test' };
const LICENCE: TermPair = { canonical: 'license', variant: 'licence', confidence: 'test' };

describe('lint_canonical_terms — the four states of the verify clause', () => {
    it('1. reds on a planted wrong-dialect occurrence in prose', () => {
        const f = scanContent('src/rules/x.md', 'The observed behaviour is wrong.\n', [BEHAVIOUR]);
        expect(f).toHaveLength(1);
        expect(f[0]!.category).toBe('authored-prose');
        expect(f[0]!.variant).toBe('behaviour');
        expect(f[0]!.canonical).toBe('behavior');
        expect(f[0]!.line).toBe(1);
    });

    it('2. stays green on the same word inside a fence', () => {
        const doc = ['Prose above.', '```ts', '// the observed behaviour is wrong', '```', 'Prose below.'].join('\n');
        expect(scanContent('src/rules/x.md', doc, [BEHAVIOUR])).toEqual([]);
    });

    it('3. stays green on the same word inside a frontmatter value', () => {
        const doc = ['---', 'description: the observed behaviour', '---', 'Prose.'].join('\n');
        expect(scanContent('src/rules/x.md', doc, [BEHAVIOUR])).toEqual([]);
    });

    it('4. classifies the same word inside a quoted licence name as protected text', () => {
        const f = scanContent('docs/x.md', 'Shipped under the Mozilla Public Licence.\n', [LICENCE]);
        expect(f).toHaveLength(1);
        expect(f[0]!.category).toBe('protected-text');
    });
});

describe('lint_canonical_terms — the limits of the licence carve-out', () => {
    // The council's exact limit: proximity to a protected name does NOT exempt
    // the surrounding prose. This is the test that would fail if the carve-out
    // were widened from a span to a line.
    it('still flags ordinary prose sharing a line with a protected licence title', () => {
        const f = scanContent(
            'docs/x.md',
            'The Mozilla Public Licence is quoted here, but this licence choice is ours.\n',
            [LICENCE],
        );
        const categories = f.map((x) => x.category).sort();
        expect(f).toHaveLength(2);
        expect(categories).toEqual(['authored-prose', 'protected-text']);
    });

    it('treats an inline code span as named, not used', () => {
        expect(scanContent('src/x.md', 'The `licence` key is spelled that way upstream.\n', [LICENCE])).toEqual([]);
    });

    it('honours the per-line opt-out marker', () => {
        const doc = 'A deliberate behaviour reference. <!-- canonical-terms: ignore -->\n';
        expect(scanContent('src/x.md', doc, [BEHAVIOUR])).toEqual([]);
    });
});

describe('lint_canonical_terms — file-level categories', () => {
    it('classifies a generated tree as `generated`', () => {
        const f = scanContent('dist/agent-src/rules/x.md', 'The behaviour here.\n', [BEHAVIOUR]);
        expect(f[0]!.category).toBe('generated');
    });

    it('classifies an immutable record as `ambiguous`', () => {
        const f = scanContent('agents/roadmaps/archive/old.md', 'The behaviour here.\n', [BEHAVIOUR]);
        expect(f[0]!.category).toBe('ambiguous');
    });

    it('classifies ordinary source prose as `authored-prose`', () => {
        const f = scanContent('src/skills/x/SKILL.md', 'The behaviour here.\n', [BEHAVIOUR]);
        expect(f[0]!.category).toBe('authored-prose');
    });
});

describe('lint_canonical_terms — inflection and case', () => {
    it('catches the variant stem, not just the exact word', () => {
        const doc = 'behaviours, behavioural and behaviourally all count.\n';
        const f = scanContent('src/x.md', doc, [BEHAVIOUR]);
        expect(f.map((x) => x.variant)).toEqual(['behaviours', 'behavioural', 'behaviourally']);
    });

    it('rewrites preserving inflection and capitalization', () => {
        const subagent: TermPair = { canonical: 'subagent', variant: 'sub-agent', confidence: 'test' };
        expect(canonicalizeToken('sub-agents', subagent)).toBe('subagents');
        expect(canonicalizeToken('Sub-agent', subagent)).toBe('Subagent');
        expect(canonicalizeToken('behavioural', BEHAVIOUR)).toBe('behavioral');
        expect(canonicalizeToken('Behaviours', BEHAVIOUR)).toBe('Behaviors');
    });
});

describe('lint_canonical_terms — the map it reads', () => {
    it('skips the pair the map explicitly declines to decide', () => {
        const pairs = loadPairs();
        // `preflight` / `pre-flight` carries `canonical: null` — undecided is not
        // an instruction, and a gate that guessed a side would be enforcing a
        // decision the map refused to make.
        expect(pairs.map((p) => p.variant)).not.toContain('pre-flight');
        expect(pairs.length).toBeGreaterThanOrEqual(8);
    });
});
