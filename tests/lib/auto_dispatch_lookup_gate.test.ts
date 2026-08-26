/**
 * `classifyLookup` — the code-graph primitive is a GATED accelerant.
 *
 * Both directions are pinned, because the defect this closed was not "the wrong
 * primitive" but "the primitive did not follow the gate at all": the contract
 * has always described the graph as opportunistic and conditional on
 * `hooks.code_graph.enabled`, and the classifier hardcoded it.
 *
 * The class recognition is asserted separately from the primitive on purpose. A
 * change that stopped recognising `definition` and `references` altogether would
 * also make the primitive grep, and a single assertion could not tell the two
 * apart.
 */
import { describe, expect, it } from 'vitest';

import { classifyLookup } from '../../src/scripts/_lib/auto_dispatch.js';

const DEFINITION = 'Where is resolveSubagentRouting defined?';
const REFERENCES = 'Who calls resolve_canary_name across the repo?';

describe('with the graph gated OFF — the default, and this repository', () => {
    it('still recognises the lookup class', () => {
        expect(classifyLookup(DEFINITION).lookup_class).toBe('definition');
        expect(classifyLookup(REFERENCES).lookup_class).toBe('references');
    });

    it('routes to capped grep, which is the arm the measurement favours', () => {
        expect(classifyLookup(DEFINITION).primitive).toBe('fts-or-capped-grep');
        expect(classifyLookup(REFERENCES).primitive).toBe('fts-or-capped-grep');
    });

    it('says WHY in the reason, so a reader is not left inferring it', () => {
        expect(classifyLookup(DEFINITION).reason).toContain('hooks.code_graph.enabled');
    });

    it('treats an ABSENT flag as off, not as unknown', () => {
        // An absent flag means nobody said the index is present and fresh, and
        // an accelerant taken on an absent index is a miss that escalates —
        // slower than the grep it replaced.
        expect(classifyLookup(DEFINITION, {}).primitive).toBe('fts-or-capped-grep');
        expect(classifyLookup(DEFINITION, { codeGraphEnabled: undefined }).primitive).toBe(
            'fts-or-capped-grep',
        );
    });
});

describe('with the graph gated ON', () => {
    it('routes to the code-graph primitive — turning the flag on is the whole change', () => {
        expect(classifyLookup(DEFINITION, { codeGraphEnabled: true }).primitive).toBe('code-graph-query');
        expect(classifyLookup(REFERENCES, { codeGraphEnabled: true }).primitive).toBe('code-graph-query');
    });
});

describe('classes the gate does not touch', () => {
    it('string-existence was already grep and is unchanged in both states', () => {
        const q = "Does the string 'budget_routing' exist anywhere in src?";
        expect(classifyLookup(q).primitive).toBe('fts-or-capped-grep');
        expect(classifyLookup(q, { codeGraphEnabled: true }).primitive).toBe('fts-or-capped-grep');
    });

    it('a non-lookup task still escalates rather than being down-guessed', () => {
        const r = classifyLookup('Refactor the billing module to use the new gateway');
        expect(r.route).toBe('escalate');
        expect(r.primitive).toBeNull();
    });
});
