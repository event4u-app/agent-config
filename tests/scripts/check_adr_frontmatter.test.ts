import { describe, expect, it } from 'vitest';

import {
    type AdrFinding,
    adr_number,
    check_amendment_links,
    check_amendment_shape,
    check_one,
    check_reopen_authority,
    check_supersession_links,
    parse_adr_refs,
    split_dimensions,
    trigger_is_meaningful,
} from '../../src/scripts/check_adr_frontmatter.js';

/**
 * Covers the reopen-authority fields added by road-to-adr-revisit-governance.
 * The pre-existing checks (required fields, status enum, `review_trigger`) had
 * no test file at all — the two smoke cases at the bottom close that gap for
 * the paths this change touches, not for the whole validator.
 */

function fm(body: string): string {
    return `---\n${body}\n---\n\n# ADR\n`;
}

describe('split_dimensions', () => {
    it('reads an inline list', () => {
        expect(split_dimensions('[purpose, security_floor]')).toEqual(['purpose', 'security_floor']);
    });

    it('reads a folded block list, dashes stripped', () => {
        expect(split_dimensions('- purpose - governance')).toEqual(['purpose', 'governance']);
    });

    it('is empty for an empty value', () => {
        expect(split_dimensions('')).toEqual([]);
    });
});

describe('check_reopen_authority', () => {
    it('says nothing when both fields are absent — absent is unclassified, not a finding', () => {
        const findings: AdrFinding[] = [];
        check_reopen_authority('x.md', { status: 'accepted' }, findings);
        expect(findings).toEqual([]);
    });

    it('accepts every documented policy value', () => {
        for (const policy of ['directional', 'owner', 'unclassified']) {
            const findings: AdrFinding[] = [];
            check_reopen_authority('x.md', { reopen_policy: policy, protected_dimensions: '[purpose]' }, findings);
            expect(findings.filter((f) => f.level === 'error')).toEqual([]);
        }
    });

    it('errors on an unknown policy — a typo must not silently mis-route authority', () => {
        const findings: AdrFinding[] = [];
        check_reopen_authority('x.md', { reopen_policy: 'council' }, findings);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.level).toBe('error');
        expect(findings[0]?.message).toContain('reopen_policy');
    });

    it('errors on an unknown protected dimension', () => {
        const findings: AdrFinding[] = [];
        check_reopen_authority('x.md', { protected_dimensions: '[purpose, velocity]' }, findings);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.message).toContain('velocity');
    });

    it('warns — never errors — on `owner` with no named reserved interest', () => {
        const findings: AdrFinding[] = [];
        check_reopen_authority('x.md', { reopen_policy: 'owner' }, findings);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.level).toBe('warn');
    });
});

describe('check_one — the new fields never make an existing ADR fail', () => {
    it('passes a grandfathered ADR that carries neither new field', () => {
        const text = fm(['adr: 1', 'status: accepted', 'date: 2026-05-06', 'decision: something'].join('\n'));
        const errors = check_one('ADR-001-x.md', text).filter((f) => f.level === 'error');
        expect(errors).toEqual([]);
    });

    it('still fails a post-cutoff ADR with no review_trigger — the older gate is intact', () => {
        const text = fm(['adr: 200', 'status: accepted', 'date: 2026-08-01', 'decision: something'].join('\n'));
        const errors = check_one('ADR-200-x.md', text).filter((f) => f.level === 'error');
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toContain('review_trigger');
    });
});

describe('adr_number', () => {
    it('normalises every reference shape to a bare number', () => {
        expect(adr_number('ADR-035')).toBe('35');
        expect(adr_number('035')).toBe('35');
        expect(adr_number('35')).toBe('35');
        expect(adr_number(' 105 (Decision 2 only — the contract stands)')).toBe('105');
    });

    it('is null when nothing resolves', () => {
        expect(adr_number('—')).toBeNull();
        expect(adr_number('none')).toBeNull();
    });
});

describe('check_amendment_shape', () => {
    it('ignores the em-dash placeholder and an absent key', () => {
        const findings: AdrFinding[] = [];
        check_amendment_shape('x.md', { amends: '—' }, findings);
        check_amendment_shape('x.md', {}, findings);
        expect(findings).toEqual([]);
    });

    it('errors when a link value names no ADR number', () => {
        const findings: AdrFinding[] = [];
        check_amendment_shape('x.md', { amended_by: 'the other one' }, findings);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.level).toBe('error');
    });
});

describe('check_amendment_links — the reciprocal half `supersedes` never had', () => {
    const corpus = (rows: Record<string, string>[]) =>
        rows.map((fm, i) => ({ rel: `ADR-${String(i)}.md`, fm }));

    it('passes a bidirectional pair', () => {
        const f = check_amendment_links(
            corpus([
                { adr: '35', amended_by: 'ADR-232' },
                { adr: '232', amends: 'ADR-035' },
            ]),
        );
        expect(f).toEqual([]);
    });

    it('tolerates the annotated form the corpus already uses', () => {
        // ADR-117 carries `amends: 105 (Decision 2 only — …)`; the parenthetical
        // must not defeat the reciprocal match.
        const f = check_amendment_links(
            corpus([
                { adr: '117', amends: '105 (Decision 2 only — the contract itself stands)' },
                { adr: '105', amended_by: 'ADR-117' },
            ]),
        );
        expect(f).toEqual([]);
    });

    it('errors on a one-sided link — invisible from the stale side', () => {
        const f = check_amendment_links(corpus([{ adr: '35', amended_by: 'ADR-232' }, { adr: '232' }]));
        expect(f).toHaveLength(1);
        expect(f[0]?.message).toContain('one-sided');
    });

    it('errors when the target does not exist', () => {
        const f = check_amendment_links(corpus([{ adr: '35', amended_by: 'ADR-999' }]));
        expect(f).toHaveLength(1);
        expect(f[0]?.message).toContain('does not exist');
    });

    it('says nothing about a corpus with no amendment links at all', () => {
        expect(check_amendment_links(corpus([{ adr: '1' }, { adr: '2' }]))).toEqual([]);
    });
});

/**
 * The two descriptive axes (`provenance`, `evidence`) and the transitional
 * `review_trigger` vocabulary.
 *
 * Every case here plants a violation and asserts the check fires. The validator
 * runs green over all 177 real ADRs, which proves it does not false-positive
 * and proves nothing at all about whether it can fire — hence a negative case
 * per rule rather than a happy path per rule.
 */
describe('descriptive axes — provenance', () => {
    function withProvenance(lines: string[], extra = ''): string {
        return fm(
            ['adr: 300', 'status: accepted', 'date: 2026-08-21', 'decision: probe', 'review_trigger: unclassified', 'provenance:', ...lines.map((l) => `  ${l}`), extra]
                .filter((l) => l !== '')
                .join('\n'),
        );
    }

    it('accepts each valid kind', () => {
        for (const kind of ['human', 'agentic', 'mixed', 'unknown']) {
            const f = check_one('a.md', withProvenance([`kind: ${kind}`]));
            expect(f.filter((x) => x.message.includes('provenance'))).toEqual([]);
        }
    });

    it('rejects `council` as a kind — a council is agentic with a mode', () => {
        const f = check_one('a.md', withProvenance(['kind: council']));
        expect(f.some((x) => x.message.includes('is not one of') && x.message.includes('agentic_mode: council'))).toBe(true);
    });

    it('rejects a provenance map with no kind', () => {
        const f = check_one('a.md', withProvenance(['decision_makers: [owner]']));
        expect(f.some((x) => x.message.includes('carries no `kind`'))).toBe(true);
    });

    it('rejects a scalar where a map belongs', () => {
        const f = check_one(
            'a.md',
            fm('adr: 300\nstatus: accepted\ndate: 2026-08-21\ndecision: probe\nreview_trigger: unclassified\nprovenance: agentic'),
        );
        expect(f.some((x) => x.message.includes('must be a map'))).toBe(true);
    });

    // The regression this pair pins: the guard used to read `fm.scalars` alone,
    // and the reader routes an inline list into `nested` — so a malformed axis
    // written as a list produced ZERO findings and every consumer downstream
    // read the axis as absent. Sabotage-verified: restoring the scalars-only
    // guard turns both of these red.
    it('rejects an inline LIST where a map belongs (provenance)', () => {
        const f = check_one(
            'a.md',
            fm('adr: 300\nstatus: accepted\ndate: 2026-08-21\ndecision: probe\nreview_trigger: unclassified\nprovenance: [human]'),
        );
        expect(f.some((x) => x.message.includes('must be a map'))).toBe(true);
    });

    it('rejects an inline LIST where a map belongs (evidence)', () => {
        const f = check_one(
            'a.md',
            fm('adr: 300\nstatus: accepted\ndate: 2026-08-21\ndecision: probe\nreview_trigger: unclassified\nevidence: [E9]'),
        );
        expect(f.some((x) => x.message.includes('must be a map'))).toBe(true);
    });

    it('rejects an unknown agentic_mode', () => {
        const f = check_one('a.md', withProvenance(['kind: agentic', 'agentic_mode: quorum']));
        expect(f.some((x) => x.message.includes('agentic_mode `quorum`'))).toBe(true);
    });
});

describe('descriptive axes — evidence', () => {
    function withEvidence(lines: string[]): string {
        return fm(
            ['adr: 301', 'status: accepted', 'date: 2026-08-21', 'decision: probe', 'review_trigger: unclassified', 'evidence:', ...lines.map((l) => `  ${l}`)].join('\n'),
        );
    }

    it('accepts E0 with an explicit discovery state', () => {
        const f = check_one('a.md', withEvidence(['strength: E0', 'discovery: incomplete']));
        expect(f.filter((x) => x.message.includes('evidence'))).toEqual([]);
    });

    it('rejects E0 without a discovery state — an unsearched absence is not an established one', () => {
        const f = check_one('a.md', withEvidence(['strength: E0']));
        expect(f.some((x) => x.message.includes('unsearched absence is not an established one'))).toBe(true);
    });

    it('rejects an unknown strength', () => {
        const f = check_one('a.md', withEvidence(['strength: E5', 'discovery: complete']));
        expect(f.some((x) => x.message.includes('strength `E5`'))).toBe(true);
    });

    it('rejects an unknown discovery state', () => {
        const f = check_one('a.md', withEvidence(['strength: E0', 'discovery: partial']));
        expect(f.some((x) => x.message.includes('discovery `partial`'))).toBe(true);
    });

    it.each(['E2', 'E3', 'E4'])('rejects %s with no basis — a grade above E1 asserts a source', (grade) => {
        const f = check_one('a.md', withEvidence([`strength: ${grade}`]));
        expect(f.some((x) => x.message.includes('cites no `basis`'))).toBe(true);
    });

    it('accepts E3 with a basis list', () => {
        const f = check_one('a.md', withEvidence(['strength: E3', 'basis:', '  - docs/CLAIMS.md#code-graph-retrieval-null']));
        expect(f.filter((x) => x.message.includes('evidence'))).toEqual([]);
    });

    it('does not require a basis for E1 — one local observation may be the record itself', () => {
        const f = check_one('a.md', withEvidence(['strength: E1']));
        expect(f.filter((x) => x.message.includes('basis'))).toEqual([]);
    });
});

describe('descriptive axes — authority_basis', () => {
    function withBasis(value: string, evidence: string[] = []): string {
        const lines = ['adr: 302', 'status: accepted', 'date: 2026-08-21', 'decision: probe', 'review_trigger: unclassified', `authority_basis: ${value}`];
        if (evidence.length > 0) lines.push('evidence:', ...evidence.map((l) => `  ${l}`));
        return fm(lines.join('\n'));
    }

    it('accepts the two legal values', () => {
        for (const v of ['evidence', 'owner_intent']) {
            expect(check_one('a.md', withBasis(v)).filter((x) => x.message.includes('authority_basis'))).toEqual([]);
        }
    });

    it('rejects an invented value', () => {
        const f = check_one('a.md', withBasis('council_intent'));
        expect(f.some((x) => x.message.includes('authority_basis `council_intent`'))).toBe(true);
    });

    it('rejects owner_intent dressed as an empirical grade with no basis', () => {
        const f = check_one('a.md', withBasis('owner_intent', ['strength: E3']));
        expect(f.some((x) => x.message.includes('dressing intent as measurement'))).toBe(true);
    });

    it('accepts owner_intent at E0 — the honest form for a purpose decision', () => {
        const f = check_one('a.md', withBasis('owner_intent', ['strength: E0', 'discovery: complete']));
        expect(f.filter((x) => x.message.includes('intent'))).toEqual([]);
    });
});

describe('review_trigger vocabulary — permanence is invalid at every stage', () => {
    function withTrigger(value: string, status = 'accepted'): string {
        return fm(`adr: 303\nstatus: ${status}\ndate: 2026-08-21\ndecision: probe\nreview_trigger: ${value}`);
    }

    it.each(['terminal', 'none', 'never', 'n/a', '-'])('rejects `%s`', (value) => {
        const f = check_one('a.md', withTrigger(value));
        expect(f.some((x) => x.message.includes('permanence under a field name'))).toBe(true);
    });

    it('accepts the transitional `unclassified`', () => {
        const f = check_one('a.md', withTrigger('unclassified'));
        expect(f.filter((x) => x.message.includes('permanence'))).toEqual([]);
    });

    it('rejects a trigger whose prose asserts permanence', () => {
        const f = check_one('a.md', withTrigger('This decision holds forever and is never revisited'));
        expect(f.some((x) => x.message.includes('asserts permanence'))).toBe(true);
    });

    it('says nothing on a superseded record — historical records need no active path', () => {
        const f = check_one('a.md', withTrigger('terminal', 'superseded'));
        expect(f.filter((x) => x.message.includes('permanence'))).toEqual([]);
    });

    it('accepts a real condition', () => {
        const f = check_one(
            'a.md',
            withTrigger('Reopen when PHP-FIG withdraws PSR-12 or the interface stops requiring it'),
        );
        expect(f.filter((x) => x.message.includes('permanence'))).toEqual([]);
    });
});

/**
 * The staged `unclassified` migration value.
 *
 * This block exists because the contract and the validator contradicted each
 * other and the contradiction was latent: `adr-layout` blesses
 * `review_trigger: unclassified` on an existing record, while
 * `trigger_is_meaningful` rejected anything under 20 characters and
 * `unclassified` is 12. Nothing in the tree carried the value yet, so nothing
 * was red — it would have fired on the first backfill, i.e. on the first person
 * to follow the document.
 */
describe('review_trigger: unclassified — legal on an existing record, not on a new one', () => {
    function rec(date: string, trigger: string): string {
        return fm(`adr: 304\nstatus: accepted\ndate: ${date}\ndecision: probe\nreview_trigger: ${trigger}`);
    }

    it('is accepted on a pre-existing record (dated before the grandfather cutoff)', () => {
        const f = check_one('a.md', rec('2026-05-16', 'unclassified'));
        expect(f.filter((x) => x.message.includes('review_trigger'))).toEqual([]);
    });

    it('is REJECTED on a record dated after the cutoff — a new record has no migration to be in', () => {
        const f = check_one('a.md', rec('2026-08-21', 'unclassified'));
        expect(f.some((x) => x.message.includes('migration value for a record that already existed'))).toBe(true);
    });

    it('is rejected on an undated record rather than being given the benefit of the doubt', () => {
        const f = check_one('a.md', fm('adr: 304\nstatus: accepted\ndecision: probe\nreview_trigger: unclassified'));
        expect(f.some((x) => x.message.includes('undated'))).toBe(true);
    });

    it('does not trip the cadence check — the length floor would have rejected it at 12 chars', () => {
        expect(trigger_is_meaningful('unclassified')).toBe(true);
        expect(trigger_is_meaningful('Unclassified')).toBe(true);
    });

    it('still rejects a genuinely too-short trigger, so the carve-out did not open the floor', () => {
        expect(trigger_is_meaningful('when it breaks')).toBe(false);
    });

    it('still rejects a bare cadence', () => {
        expect(trigger_is_meaningful('annually')).toBe(false);
        expect(trigger_is_meaningful('every 6 months')).toBe(false);
    });

    it('says nothing on a superseded record dated after the cutoff', () => {
        const f = check_one('a.md', fm('adr: 304\nstatus: superseded\ndate: 2026-08-21\ndecision: probe\nreview_trigger: unclassified'));
        expect(f.filter((x) => x.message.includes('migration value'))).toEqual([]);
    });
});

/**
 * The reciprocal half for `supersedes:` / `superseded_by:`.
 *
 * Every case plants a violation and asserts it fires, or plants the exact
 * corpus shape a naive parser gets wrong and asserts silence. The two shapes
 * that matter are the list (ADR-206 carries sixteen targets in one field) and
 * the parenthetical qualifier (ADR-124 carries two annotated refs, ADR-209 one
 * whose note contains an em dash and a digit) — a first-number parser turns the
 * first into fifteen phantom findings and the second into a missed match.
 */
describe('parse_adr_refs', () => {
    it('is empty for an absent key, an empty value, and every placeholder', () => {
        expect(parse_adr_refs(undefined)).toEqual([]);
        expect(parse_adr_refs('')).toEqual([]);
        for (const p of ['—', '–', '-', 'none', 'N/A']) {
            expect(parse_adr_refs(p)).toEqual([]);
        }
    });

    it('reads every member of a list, not just the first', () => {
        const refs = parse_adr_refs('ADR-068, ADR-070, ADR-071');
        expect(refs.map((r) => r.number)).toEqual(['68', '70', '71']);
    });

    it('keeps a comma inside a qualifier out of the split', () => {
        const refs = parse_adr_refs('ADR-088 (engine-adoption only, not the contract), ADR-094');
        expect(refs.map((r) => r.number)).toEqual(['88', '94']);
        expect(refs[0]?.qualifier).toBe('engine-adoption only, not the contract');
    });

    it('reads the number with the qualifier removed, so a digit in the note cannot win', () => {
        // The real ADR-209 shape: the note carries "Decision 2" and an em dash.
        const refs = parse_adr_refs('ADR-030 (Decision 2 — the carve-out only)');
        expect(refs).toHaveLength(1);
        expect(refs[0]?.number).toBe('30');
    });

    it('is order-independent about the qualifier — a leading note does not become the number', () => {
        expect(parse_adr_refs('(Decision 2 only) ADR-030')[0]?.number).toBe('30');
    });

    it('reports a segment that names no ADR number rather than dropping it', () => {
        const refs = parse_adr_refs('the other one');
        expect(refs).toHaveLength(1);
        expect(refs[0]?.number).toBeNull();
    });

    it('skips a placeholder member inside a list', () => {
        expect(parse_adr_refs('ADR-017, —').map((r) => r.number)).toEqual(['17']);
    });
});

describe('check_supersession_links', () => {
    const corpus = (rows: Record<string, string>[]) =>
        rows.map((fmRow, i) => ({ rel: `ADR-${String(i)}.md`, fm: fmRow }));

    it('is silent on a clean reciprocal pair', () => {
        const f = check_supersession_links(
            corpus([
                { adr: '45', supersedes: 'ADR-028' },
                { adr: '28', superseded_by: 'ADR-045' },
            ]),
        );
        expect(f).toEqual([]);
    });

    it('is silent when both sides carry the em-dash placeholder', () => {
        const f = check_supersession_links(
            corpus([
                { adr: '1', supersedes: '—', superseded_by: '—' },
                { adr: '2', supersedes: '—', superseded_by: '—' },
            ]),
        );
        expect(f).toEqual([]);
    });

    it('fires on a one-sided `superseded_by` — the ADR-067 shape', () => {
        const f = check_supersession_links(corpus([{ adr: '67', superseded_by: '111' }, { adr: '111' }]));
        expect(f).toHaveLength(1);
        expect(f[0]?.level).toBe('warn');
        expect(f[0]?.kind).toBe('supersession_link');
        expect(f[0]?.message).toContain('one-sided');
    });

    it('fires on a one-sided `supersedes` — the ADR-043 shape', () => {
        const f = check_supersession_links(corpus([{ adr: '43', supersedes: 'ADR-017' }, { adr: '17' }]));
        expect(f).toHaveLength(1);
        expect(f[0]?.kind).toBe('supersession_link');
        expect(f[0]?.message).toContain('one-sided');
    });

    it('is silent on a sixteen-target list whose back-links are all present (the ADR-206 shape)', () => {
        // The case a first-number parser fails: it reads ADR-068 and reports the
        // other fifteen as one-sided. Fifteen phantom findings, zero defects.
        const targets = Array.from({ length: 16 }, (_v, i) => 68 + i);
        const rows: Record<string, string>[] = [
            { adr: '206', supersedes: targets.map((n) => `ADR-0${String(n)}`).join(', ') },
            ...targets.map((n) => ({ adr: String(n), superseded_by: '206' })),
        ];
        expect(check_supersession_links(corpus(rows))).toEqual([]);
    });

    it('fires exactly once when one member of a sixteen-target list lacks its back-link', () => {
        const targets = Array.from({ length: 16 }, (_v, i) => 68 + i);
        const rows: Record<string, string>[] = [
            { adr: '206', supersedes: targets.map((n) => `ADR-0${String(n)}`).join(', ') },
            // ADR-075 is present but carries no reciprocal.
            ...targets.map((n) => (n === 75 ? { adr: '75' } : { adr: String(n), superseded_by: '206' })),
        ];
        const f = check_supersession_links(corpus(rows));
        expect(f.filter((x) => x.kind === 'supersession_link')).toHaveLength(1);
        expect(f[0]?.message).toContain('ADR-075');
    });

    it('matches through a parenthetical qualifier on either side', () => {
        const f = check_supersession_links(
            corpus([
                { adr: '124', supersedes: 'ADR-088 (engine-adoption interpretation only)' },
                { adr: '88', superseded_by: 'ADR-124 (engine-adoption interpretation only)' },
            ]),
        );
        expect(f.filter((x) => x.kind === 'supersession_link')).toEqual([]);
    });

    it('reports the free-text qualifier as its own finding class, separate from the link', () => {
        const f = check_supersession_links(
            corpus([
                { adr: '124', supersedes: 'ADR-088 (engine-adoption interpretation only)' },
                { adr: '88', superseded_by: 'ADR-124 (engine-adoption interpretation only)' },
            ]),
        );
        const partial = f.filter((x) => x.kind === 'supersession_qualifier');
        expect(partial).toHaveLength(2);
        expect(partial[0]?.level).toBe('warn');
        expect(partial[0]?.message).toContain('PARTIAL');
    });

    it('errors when the target does not exist', () => {
        const f = check_supersession_links(corpus([{ adr: '35', superseded_by: 'ADR-999' }]));
        expect(f).toHaveLength(1);
        expect(f[0]?.level).toBe('error');
        expect(f[0]?.message).toContain('does not exist');
    });

    it('errors when a value names no ADR number at all', () => {
        const f = check_supersession_links(corpus([{ adr: '35', supersedes: 'the older one' }]));
        expect(f).toHaveLength(1);
        expect(f[0]?.level).toBe('error');
        expect(f[0]?.message).toContain('names no ADR number');
    });

    it('says nothing about a corpus with no supersession links at all', () => {
        expect(check_supersession_links(corpus([{ adr: '1' }, { adr: '2' }]))).toEqual([]);
    });

    it('does not confuse the amendment fields for supersession ones', () => {
        const f = check_supersession_links(corpus([{ adr: '232', amends: 'ADR-035' }, { adr: '35' }]));
        expect(f).toEqual([]);
    });
});

describe('reciprocal links — per-area numbers never collide with flat ADR numbers', () => {
    // `adr: 0001` appears on six of the seven per-area records, so a single
    // Map keyed on the number kept one of seven and shadowed flat ADR-001 too.
    // The false-NEGATIVE is the dangerous direction: a per-area record's
    // reciprocal would mask a genuinely broken flat link as fine.
    const flat = {
        rel: 'docs/decisions/ADR-001-x.md',
        fm: { adr: '001', superseded_by: 'ADR-002' },
    };
    const perArea = {
        rel: 'docs/adrs/telegraph/0001-y.md',
        fm: { adr: '0001', area: 'telegraph', supersedes: '—' },
        perArea: true,
    };
    const other = { rel: 'docs/decisions/ADR-002-z.md', fm: { adr: '002', supersedes: '—' } };

    // Sensitivity note: sabotage-verified, and only the SECOND test goes red
    // when the per-area skip is removed. This one stays green because the flat
    // record's own link still resolves — it pins the wrong-file-blamed
    // direction, not the shadowing mechanism.
    it('blames the flat record, never the per-area one, for a one-sided link', () => {
        const f = check_supersession_links([flat, perArea, other]);
        const one = f.filter((x) => x.kind === 'supersession_link');
        expect(one.length).toBe(1);
        expect(one[0]?.file).toBe('docs/decisions/ADR-001-x.md');
        expect(f.some((x) => x.message.includes('docs/adrs/telegraph'))).toBe(false);
    });

    it('does not let a per-area reciprocal satisfy a flat link', () => {
        const masking = {
            rel: 'docs/adrs/telegraph/0002-w.md',
            fm: { adr: '0002', area: 'telegraph', supersedes: 'ADR-001' },
            perArea: true,
        };
        const f = check_supersession_links([flat, masking]);
        expect(f.some((x) => x.kind === 'supersession_link')).toBe(true);
    });
});
