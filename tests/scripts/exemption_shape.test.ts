import { describe, expect, it } from 'vitest';

import { exemptionFindings, quotesOwnerSearch, unsearchedExemptions } from '../../src/scripts/_lib/exemption_shape.js';

const TREE = 'agents/roadmaps';
const SUBDIR = 'later';
const DISPOSED = 'Archiving or parking costs more because the defect keeps arriving';

describe('quotes-owner-search — an added exemption quotes the owner search it ran', () => {
    it('quotes-owner-search: accepts verb, query, whole-tree scope and an empty result in one clause', () => {
        for (const search of [
            'a grep over agents/roadmaps/{*,later,stubs} for exemption_shape, days since returns nothing',
            'rg over agents/roadmaps for brand-voice, tokens.json at main@085ec41ff returns only archived files',
            "`grep -rln 'spool' agents/roadmaps` → nothing",
            'searched agents/roadmaps/* for spool and output_store: 0 hits',
            'agent-config roadmap:context returned no owner',
        ]) {
            expect(quotesOwnerSearch(`${DISPOSED}; ${search}.`), search).toBe(true);
            expect(unsearchedExemptions([{ file: 'a.md', reason: `${DISPOSED}; ${search}.` }]), search).toEqual([]);
        }
    });

    it('quotes-owner-search: reports a disposition word with no search behind it', () => {
        const reason = `${DISPOSED}, and no active roadmap owns the intake side.`;
        expect(quotesOwnerSearch(reason)).toBe(false);
        expect(unsearchedExemptions([{ file: 'a.md', reason }])).toEqual([
            { file: 'a.md', kind: 'unsearched', twin: null, reason },
        ]);
        // report-only: the gating findings are unchanged
        expect(exemptionFindings([{ file: 'a.md', reason }])).toEqual([]);
    });

    it('quotes-owner-search: the parts spread over separate clauses are not a search (council 2026-10-16)', () => {
        expect(quotesOwnerSearch('grep was considered; agents/roadmaps contains plans; another check returned 0 hits')).toBe(false);
    });

    it('quotes-owner-search: each of query, scope and empty result is required', () => {
        // no query
        expect(quotesOwnerSearch(`${DISPOSED}; rg agents/roadmaps returned 0 hits`)).toBe(false);
        // a scope outside the roadmap tree
        expect(quotesOwnerSearch(`${DISPOSED}; a grep over src/ for x returns nothing`)).toBe(false);
        // one subdirectory alone is not the tree
        expect(quotesOwnerSearch(`${DISPOSED}; rg 'OIDC' ${TREE}/${SUBDIR} returned 0 hits`)).toBe(false);
        // a search that found something is a reason to land on the owner
        expect(quotesOwnerSearch(`${DISPOSED}; rg 'OIDC' agents/roadmaps → 2 files`)).toBe(false);
        // an arrow with no result
        expect(quotesOwnerSearch(`${DISPOSED}; search agents/roadmaps for x -> pending`)).toBe(false);
        // no result at all
        expect(quotesOwnerSearch(`${DISPOSED}; I grepped agents/roadmaps for the identifiers`)).toBe(false);
    });

    it('quotes-owner-search: a shapeless reason is shapeless, not also unsearched', () => {
        const reason = 'a grep over agents/roadmaps for x returns nothing';
        expect(exemptionFindings([{ file: 'a.md', reason }])[0]?.kind).toBe('shapeless');
        expect(unsearchedExemptions([{ file: 'a.md', reason: 'lane 5 of road-to-x' }])).toEqual([]);
    });
});
