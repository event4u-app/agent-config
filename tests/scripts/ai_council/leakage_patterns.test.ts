// Tests for src/scripts/ai_council/leakage_patterns.ts — the version-pinned
// pattern list for the leakage bench's PATTERN-STRIPPED arm
// (road-to-inbox-harvest-2026-08-e-council-topology-evidence,
// blocker: leakage-bench-needs-assembler-and-design-forks, todo item 3;
// AI-council verdict 2026-08-31, Fork 3, conditions 1, 2 and 6).
import { describe, expect, it } from 'vitest';

import {
    ARM_LABEL,
    CATEGORY_PLACEHOLDER,
    FORBIDDEN_ARM_LABELS,
    LEAKAGE_PATTERNS,
    LEAKAGE_PATTERN_LIST_VERSION,
    PATTERN_LIST_DIGEST,
    applyLeakagePatterns,
    attachLogIds,
    canonicalPatternListSource,
    makeRecordingAnonymiser,
    patternListDigest,
} from '../../../src/scripts/ai_council/leakage_patterns.js';
import type { TransformationSpan } from '../../../src/scripts/ai_council/leakage_patterns.js';

// ── Condition 1 — the list is version-pinned, and an edit cannot be silent ──

describe('condition 1 — version pinning', () => {
    it('the live list hashes to the recorded digest', () => {
        // The whole enforcement of "version-pinned" available before a run
        // exists: it cannot stop an edit, it makes one impossible to make
        // quietly. Editing a regex, a rationale or the version without editing
        // PATTERN_LIST_DIGEST turns this red.
        expect(patternListDigest()).toBe(PATTERN_LIST_DIGEST);
    });

    it('the canonical source covers every field a rule carries', () => {
        const canonical = canonicalPatternListSource();
        for (const rule of LEAKAGE_PATTERNS) {
            expect(canonical).toContain(rule.id);
            // JSON.stringify escapes the quotes a rationale may contain, so the
            // comparison is against the encoded form rather than the raw one.
            expect(canonical).toContain(JSON.stringify(rule.rationale).slice(1, -1));
            expect(canonical).toContain(JSON.stringify(rule.source).slice(1, -1));
            expect(canonical).toContain(rule.falsePositiveRisk);
        }
        expect(canonical).toContain(LEAKAGE_PATTERN_LIST_VERSION);
    });

    it('rule ids are unique — the log attributes by id', () => {
        const ids = LEAKAGE_PATTERNS.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('every rule is global and case-insensitive, or is deliberately case-sensitive', () => {
        for (const rule of LEAKAGE_PATTERNS) {
            expect(rule.flags).toContain('g');
        }
        // The one case-SENSITIVE rule is `selfid-as-an-ai-by`, whose tail
        // anchors on a capitalised vendor name; asserted so a later `i` cannot
        // be added without this test noticing.
        const caseSensitive = LEAKAGE_PATTERNS.filter((r) => !r.flags.includes('i')).map((r) => r.id);
        expect(caseSensitive).toEqual(['selfid-as-an-ai-by']);
    });
});

// ── Condition 6 — the arm is `pattern-stripped`, NEVER `identifier-free` ────

describe('condition 6 — arm label', () => {
    it('exposes exactly one arm label and it is pattern-stripped', () => {
        expect(ARM_LABEL).toBe('pattern-stripped');
    });

    it('no forbidden label appears anywhere in the pinned artefact', () => {
        const canonical = canonicalPatternListSource().toLowerCase();
        for (const forbidden of FORBIDDEN_ARM_LABELS) {
            expect(canonical).not.toContain(forbidden);
        }
    });

    it('placeholders never promise identifier freedom', () => {
        for (const placeholder of Object.values(CATEGORY_PLACEHOLDER)) {
            expect(placeholder.toLowerCase()).not.toContain('identifier-free');
            expect(placeholder.toLowerCase()).not.toContain('anonym');
        }
    });
});

// ── Condition 2 — the span-level transformation log ─────────────────────────

describe('condition 2 — span log', () => {
    const BODY = "I am Claude, made by Anthropic. Ask claude-sonnet-4-5 or GPT-4o about OpenAI's plan.";

    it('every span slices back out of the ORIGINAL text', () => {
        // The property that makes a log auditable: offsets index the input, so
        // a reader can reconstruct what was removed without the writer.
        const { spans } = applyLeakagePatterns(BODY);
        expect(spans.length).toBeGreaterThan(0);
        for (const span of spans) {
            expect(BODY.slice(span.start, span.end)).toBe(span.matched);
        }
    });

    it('spans are ascending and non-overlapping', () => {
        const { spans } = applyLeakagePatterns(BODY);
        for (let i = 1; i < spans.length; i += 1) {
            const prev = spans[i - 1] as TransformationSpan;
            const cur = spans[i] as TransformationSpan;
            expect(cur.start).toBeGreaterThanOrEqual(prev.end);
        }
    });

    it('the log carries its own list version', () => {
        expect(applyLeakagePatterns(BODY).patternListVersion).toBe(LEAKAGE_PATTERN_LIST_VERSION);
    });

    it('a body with no registered identifier yields an empty log and unchanged text', () => {
        // Empty is a RESULT, not a failure — the same distinction the corpus
        // assembler draws between an exclusion and a refusal.
        const clean = 'The migration should run inside a transaction and the index is on (a, b).';
        const out = applyLeakagePatterns(clean);
        expect(out.text).toBe(clean);
        expect(out.spans).toEqual([]);
    });

    it('the recording seam collects one span list per call, in call order', () => {
        const sink: TransformationSpan[][] = [];
        const anonymise = makeRecordingAnonymiser(sink);
        anonymise('nothing here');
        anonymise('I am Claude');
        expect(sink).toHaveLength(2);
        expect(sink[0]).toEqual([]);
        expect(sink[1]?.[0]?.patternId).toBe('selfid-i-am-assistant');
    });

    it('attachLogIds refuses a log it cannot attribute', () => {
        // A log whose length disagrees with the corpus is unattributable, and
        // publishing an unattributable log is worse than publishing none.
        expect(() => attachLogIds([[], []], ['item-a'])).toThrow(/cannot be attributed/);
    });
});

// ── Ordering — the pinned tier order, asserted by patternId not by text ─────

describe('tier ordering is part of the artefact', () => {
    it('a self-identification frame is ONE self-id span, not a product span', () => {
        const { spans } = applyLeakagePatterns('I am Claude and I can help.');
        expect(spans).toHaveLength(1);
        expect(spans[0]?.patternId).toBe('selfid-i-am-assistant');
        expect(spans[0]?.matched).toBe('I am Claude');
    });

    it('a model id is consumed whole, not split into vendor plus debris', () => {
        const { text, spans } = applyLeakagePatterns('Use claude-sonnet-4-5 here.');
        expect(spans).toHaveLength(1);
        expect(spans[0]?.patternId).toBe('model-claude-family');
        expect(text).toBe('Use [REDACTED-MODEL] here.');
    });

    it('a bare product token still falls to the product rule', () => {
        const { spans } = applyLeakagePatterns('Claude disagreed with the reviewer.');
        expect(spans[0]?.patternId).toBe('product-claude');
        expect(spans[0]?.category).toBe('provider-name');
    });
});

// ── Family invariance — the placeholder cannot itself name the family ──────

describe('replacement is family-invariant', () => {
    it('two families with the same category yield the same placeholder', () => {
        const a = applyLeakagePatterns('Anthropic said so.');
        const b = applyLeakagePatterns('OpenAI said so.');
        expect(a.text).toBe('[REDACTED-VENDOR] said so.');
        expect(b.text).toBe(a.text);
    });

    it('no placeholder contains a vendor, product or model token', () => {
        const tokens = ['anthropic', 'openai', 'claude', 'chatgpt', 'gpt', 'gemini', 'codex', 'llama'];
        for (const placeholder of Object.values(CATEGORY_PLACEHOLDER)) {
            for (const token of tokens) {
                expect(placeholder.toLowerCase()).not.toContain(token);
            }
        }
    });
});

// ── The DENIAL half: over-stripping is as much a defect as under-stripping ──

describe('admission rule 1 — ambiguous bare tokens are NOT stripped', () => {
    // These are the cases a permissive list would eat. A passing strip test
    // proves the rules fire; only these prove they do not fire everywhere.
    const survivors = [
        'A meta comment about the metadata table.',
        'The mistral wind blows through the valley.',
        'I did not grok the migration plan.',
        'She played the bard in the school play.',
        'Gemini is her star sign, apparently.',
        'Google the error message before filing a bug.',
        'The metaprogramming here is too clever.',
    ];
    for (const text of survivors) {
        it(`leaves untouched: ${text}`, () => {
            const out = applyLeakagePatterns(text);
            expect(out.text).toBe(text);
            expect(out.spans).toEqual([]);
        });
    }

    it('does not swallow sentence-final punctuation into a model id', () => {
        // The greedy `[\w.-]*` bug: `gemini-2.5-pro.` would take the period and
        // delete the sentence boundary along with the identifier.
        const out = applyLeakagePatterns('It runs on gemini-2.5-pro.');
        expect(out.text).toBe('It runs on [REDACTED-MODEL].');
        expect(out.spans[0]?.matched).toBe('gemini-2.5-pro');
    });
});

// ── Determinism — the arm must be reproducible from the pinned list alone ──

describe('determinism', () => {
    it('repeated application of the list to the same body is byte-identical', () => {
        const body = 'GPT-4o and claude-opus-4 and Anthropic and OpenAI and gpt.';
        const first = applyLeakagePatterns(body);
        const second = applyLeakagePatterns(body);
        expect(second.text).toBe(first.text);
        expect(second.spans).toEqual(first.spans);
    });

    it('repeat calls find the same number of matches', () => {
        // NOT a sensitivity proof for the per-call regex recompile: the
        // sabotage run hoisted the regex into a module cache and this stayed
        // GREEN, because the exec loop runs to null and resets `lastIndex`
        // itself. What this pins is the observable property — call count does
        // not decay across calls — not the mechanism that would protect it if
        // the loop ever exited early.
        const body = 'Anthropic. Anthropic. Anthropic.';
        expect(applyLeakagePatterns(body).spans).toHaveLength(3);
        expect(applyLeakagePatterns(body).spans).toHaveLength(3);
    });
});
