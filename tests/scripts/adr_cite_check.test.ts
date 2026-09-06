import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    CITATION_ROOTS,
    TRIGGER_VERDICTS,
    PARTIAL_COVERAGE,
    LOW_EVIDENCE_NOTICE,
    SURFACES_NOT_SCANNED,
    amendment_blocks,
    basis_ref_kind,
    cite_check,
    corpus_summary,
    corpus_survey,
    cited_refs,
    normalise_ref,
    parse_frontmatter,
    trigger_state,
    unresolved_basis_refs,
} from '../../src/scripts/adr_cite_check.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Run the REAL binary over a fixture tree, the way CI calls it.
 *
 * In-process calls cannot see argv parsing, the entry guard, or the
 * `scanned:`/exit-code contract — and those are exactly the layers the CI wiring
 * added, so they are the layers that need testing.
 */
function runCli(root: string, args: readonly string[]): { code: number; out: string } {
    const tsx = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
    const res = spawnSync(tsx, [path.join(REPO_ROOT, 'src/scripts/adr_cite_check.ts'), ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, ADR_CITE_CHECK_ROOT: root },
    });
    return { code: res.status ?? 1, out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

/** An ADR frontmatter block with the two axes, for the shadow-mode cases. */
function adrWithAxes(opts: {
    num: string;
    status: string;
    kind: string;
    strength: string;
    discovery?: string;
    basis?: string;
    evidenceBasis?: readonly string[];
    reopenPolicy?: string;
    protectedDimensions?: readonly string[];
}): string {
    return [
        '---',
        `adr: ${String(Number(opts.num))}`,
        `status: ${opts.status}`,
        'date: 2026-08-21',
        `decision: axes-probe-${opts.num}`,
        'review_trigger: >-',
        '  Reopen when the premise this recorded stops holding.',
        'provenance:',
        `  kind: ${opts.kind}`,
        '  decision_makers: [probe]',
        '  human_directed: false',
        '  agentic_mode: council',
        'evidence:',
        `  strength: ${opts.strength}`,
        ...(opts.discovery !== undefined ? [`  discovery: ${opts.discovery}`] : []),
        ...(opts.evidenceBasis === undefined
            ? ['  basis: []']
            : ['  basis:', ...opts.evidenceBasis.map((b) => `    - ${b}`)]),
        ...(opts.basis !== undefined ? [`authority_basis: ${opts.basis}`] : []),
        ...(opts.reopenPolicy !== undefined ? [`reopen_policy: ${opts.reopenPolicy}`] : []),
        ...(opts.protectedDimensions !== undefined
            ? [`protected_dimensions: [${opts.protectedDimensions.join(', ')}]`]
            : []),
        '---',
        '',
        'Body.',
        '',
    ].join('\n');
}

/**
 * A throwaway decision corpus. The tests assert the tool's behaviour, never the
 * real tree's content — a fixture keeps them from going red the day someone
 * legitimately supersedes ADR-028.
 */
let root: string;

function write(rel: string, body: string): void {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, 'utf-8');
}

beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-cite-'));

    write(
        'docs/decisions/ADR-001-precondition-shipped.md',
        [
            '---',
            'adr: 1',
            'status: accepted',
            'date: 2026-05-06',
            'decision: kernel-swap-deferred',
            'review_trigger: >-',
            '  Reopen once the router compiler ships; the swap re-evaluation is',
            '  mandatory before the next milestone.',
            '---',
            '',
            '# ADR-001',
            '',
            'Body.',
            '',
        ].join('\n'),
    );

    write(
        'docs/decisions/ADR-020-no-trigger.md',
        ['---', 'adr: 20', 'status: accepted', 'date: 2026-05-10', 'decision: no-trigger', '---', '', 'Body.', ''].join(
            '\n',
        ),
    );

    write(
        'docs/decisions/ADR-028-dead.md',
        [
            '---',
            'adr: 28',
            'status: superseded',
            'date: 2026-05-25',
            'decision: root-layout',
            'superseded_by: ADR-045',
            '---',
            '',
            'Body.',
            '',
        ].join('\n'),
    );

    write(
        'docs/decisions/ADR-035-amended.md',
        [
            '---',
            'adr: 35',
            'status: accepted',
            'date: 2026-05-30',
            'decision: model-capability-tiers',
            'review_trigger: >-',
            '  Reopen if a vendor ships a band the three tiers cannot express.',
            '---',
            '',
            '## Amendment 1 (2026-08-15) — fourth tier reopened',
            '',
            'Body.',
            '',
        ].join('\n'),
    );

    write(
        'docs/decisions/ADR-232-reopener.md',
        [
            '---',
            'adr: 232',
            'status: accepted',
            'date: 2026-08-15',
            'decision: frontier-tier-reopened',
            'review_trigger: >-',
            '  Reopen if the fourth family disappears from the vendor line-up.',
            '---',
            '',
            'This amends ADR-035.',
            '',
        ].join('\n'),
    );

    write('docs/decisions/INDEX.md', '# Index\n\nADR-001 ADR-020 ADR-028 ADR-035 ADR-232\n');
});

afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('normalise_ref', () => {
    it('accepts every flat citation shape the corpus uses', () => {
        expect(normalise_ref('ADR-211')?.id).toBe('ADR-211');
        expect(normalise_ref('adr-211')?.id).toBe('ADR-211');
        expect(normalise_ref('211')?.id).toBe('ADR-211');
        expect(normalise_ref('docs/decisions/ADR-211-harvest-freeze.md')?.id).toBe('ADR-211');
        expect(normalise_ref('ADR-211')?.area).toBeNull();
    });

    it('zero-pads so ADR-1 and ADR-001 are the same decision', () => {
        expect(normalise_ref('ADR-1')?.id).toBe('ADR-001');
    });

    it('resolves a per-area citation to its area — the surface the flat pattern could never match', () => {
        expect(normalise_ref('ADR-cost-0001')).toEqual({ id: 'ADR-cost-0001', area: 'cost', num: '0001' });
        expect(normalise_ref('docs/adrs/telegraph/0002-dormant.md')).toEqual({
            id: 'ADR-telegraph-0002',
            area: 'telegraph',
            num: '0002',
        });
    });

    it('returns null when there is no number to resolve', () => {
        expect(normalise_ref('adr-layout')).toBeNull();
    });
});

describe('parse_frontmatter', () => {
    it('joins a folded value — every review_trigger in the corpus is folded', () => {
        const fm = parse_frontmatter(
            ['---', 'review_trigger: >-', '  first line', '  second line', '---', '', 'body'].join('\n'),
        );
        expect(fm?.['review_trigger']).toBe('first line second line');
    });

    it('returns null without a frontmatter block', () => {
        expect(parse_frontmatter('# no frontmatter\n')).toBeNull();
    });
});

describe('trigger_state', () => {
    it('is `none` when the ADR recorded no reopen condition', () => {
        expect(trigger_state({})).toBe('none');
    });

    it('is `indeterminate` for a semantic condition, never a guessed boolean', () => {
        expect(trigger_state({ review_trigger: 'Reopen when the capacity premise changes.' })).toBe('indeterminate');
    });
});

describe('amendment_blocks', () => {
    it('matches all three conventions present in the corpus', () => {
        const body = [
            '## Amendment 1 (2026-08-15)',
            'text',
            '### Amendment — 2026-07-02 · scope',
            'text',
            '**Amended 2026-06-01 — premise corrected**',
            'text',
        ].join('\n');
        expect(amendment_blocks(body)).toHaveLength(3);
    });

    it('finds nothing in an unamended body', () => {
        expect(amendment_blocks('## Context\n\nplain text\n')).toEqual([]);
    });
});

describe('cite_check', () => {
    it('reports a superseded ADR as not a live lock, naming the successor', () => {
        const [r] = cite_check(['ADR-028'], root);
        expect(r?.resolved).toBe(true);
        expect(r?.status).toBe('superseded');
        expect(r?.verdict).toContain('NOT A LIVE LOCK');
        expect(r?.verdict).toContain('ADR-045');
    });

    it('flags an amended ADR so the original text is not cited alone', () => {
        const [r] = cite_check(['ADR-035'], root);
        expect(r?.amendment_blocks).toHaveLength(1);
        expect(r?.verdict).toContain('AMENDED');
    });

    it('surfaces the one-sided reopen through back-references', () => {
        const [r] = cite_check(['ADR-035'], root);
        expect(r?.referenced_by.some((f) => f.includes('ADR-232'))).toBe(true);
    });

    it('excludes the generated INDEX from back-references', () => {
        const [r] = cite_check(['ADR-001'], root);
        expect(r?.referenced_by.some((f) => f.includes('INDEX.md'))).toBe(false);
    });

    it('names a live ADR with a semantic trigger indeterminate, not blocking', () => {
        const [r] = cite_check(['ADR-001'], root);
        expect(r?.trigger_state).toBe('indeterminate');
        expect(r?.verdict).toContain('INDETERMINATE');
    });

    it('calls a missing reopen condition a defect in the ADR, not a stronger lock', () => {
        const [r] = cite_check(['ADR-020'], root);
        expect(r?.trigger_state).toBe('none');
        expect(r?.verdict).toContain('NO REOPEN CONDITION');
    });

    it('keeps a `rejected` ADR live — a rejected proposal still binds', () => {
        // The failure this pins: folding `rejected` in with `superseded` makes
        // the tool clear a lock that still holds. Found by running the tool
        // over the real eleven-ADR blocking set.
        write(
            'docs/decisions/ADR-054-rejected.md',
            ['---', 'adr: 54', 'status: rejected', 'date: 2026-06-05', 'decision: decay-restate', '---', '', 'Body.', ''].join('\n'),
        );
        const [r] = cite_check(['ADR-054'], root);
        expect(r?.verdict).toContain('LIVE');
        expect(r?.verdict).not.toContain('NOT A LIVE LOCK');
    });

    it('does not resolve an unknown number, and says so', () => {
        const [r] = cite_check(['ADR-999'], root);
        expect(r?.resolved).toBe(false);
        expect(r?.verdict).toContain('UNRESOLVED');
    });

    it('resolves a per-area ADR by path and by ADR-<area>-NNNN', () => {
        write('docs/adrs/cost/0001-hard-stop-hook.md', '> Area: cost · Status: accepted\n\nBody.\n');
        for (const ref of ['ADR-cost-0001', 'docs/adrs/cost/0001-hard-stop-hook.md']) {
            const [r] = cite_check([ref], root);
            expect(r?.resolved, `${ref} must resolve`).toBe(true);
            expect(r?.file).toContain('docs/adrs/cost/0001');
        }
    });

    it('does not let a bare number address a per-area ADR — numbering restarts per area', () => {
        write('docs/adrs/cost/0001-hard-stop-hook.md', '> Area: cost\n\nBody.\n');
        write('docs/adrs/router/0001-three-tier.md', '> Area: router\n\nBody.\n');
        const [r] = cite_check(['0001'], root);
        // Resolves against the flat surface (ADR-001) or not at all — never
        // silently against one of two same-numbered per-area files.
        expect(r?.file ?? '').not.toContain('docs/adrs');
    });

    it('publishes an EMPTY partial-coverage list — the gap closed, the shape did not', () => {
        // The entry that lived here said per-area records carry no frontmatter,
        // which stopped being true on 2026-08-21; its replacement was prose
        // denying partial coverage inside a field named for it. The constant is
        // kept because `partial_coverage` is a published `--json` key (asserted
        // in the CLI block below) — an empty list is the honest value.
        expect(PARTIAL_COVERAGE).toEqual([]);
    });

    it('publishes the surfaces it deliberately does not scan', () => {
        expect(SURFACES_NOT_SCANNED.length).toBeGreaterThan(0);
        expect(SURFACES_NOT_SCANNED.join(' ')).toContain('docs/contracts/adr-');
    });
});

describe('the two descriptive axes at cite time', () => {
    it('surfaces provenance, evidence, discovery and authority_basis on a graded record', () => {
        write('docs/decisions/ADR-300-graded.md', adrWithAxes({ num: '300', status: 'accepted', kind: 'mixed', strength: 'E3', basis: 'owner_intent' }));
        const [r] = cite_check(['ADR-300'], root);
        expect(r?.provenance_kind).toBe('mixed');
        expect(r?.provenance_agentic_mode).toBe('council');
        expect(r?.evidence_strength).toBe('E3');
        expect(r?.authority_basis).toBe('owner_intent');
    });

    it('leaves every axis absent on a record that carries none — an ungraded ADR is not a weakly graded one', () => {
        const [r] = cite_check(['ADR-020'], root);
        expect(r?.provenance_kind).toBeUndefined();
        expect(r?.evidence_strength).toBeUndefined();
        expect(r?.authority_effect).toBeUndefined();
    });
});

describe('trigger_state — `unclassified` is no condition, not an unknown one', () => {
    it('maps the transitional value to `none`', () => {
        expect(trigger_state({ review_trigger: 'unclassified' })).toBe('none');
        expect(trigger_state({ review_trigger: 'Unclassified' })).toBe('none');
    });

    it('still maps a real condition to `indeterminate`', () => {
        expect(trigger_state({ review_trigger: 'Reopen when PSR-12 is withdrawn' })).toBe('indeterminate');
    });

    it('still maps an absent trigger to `none`', () => {
        expect(trigger_state({})).toBe('none');
    });
});

describe('trigger_state — the dated sub-class', () => {
    const D = (iso: string) => new Date(`${iso}T00:00:00Z`);
    const EXPIRY_134 =
        'Expiry 2026-09-15 — at that date the maintainer either posts or commits a ' +
        'superseding deferral ADR with a signed reason and a new expiry at most 90 days out.';

    it('is `not-fired` strictly before the named day', () => {
        expect(trigger_state({ review_trigger: EXPIRY_134 }, D('2026-09-14'))).toBe('not-fired');
    });

    it('is `fired` on the named day and after it', () => {
        expect(trigger_state({ review_trigger: EXPIRY_134 }, D('2026-09-15'))).toBe('fired');
        expect(trigger_state({ review_trigger: EXPIRY_134 }, D('2027-01-01'))).toBe('fired');
    });

    it('reads a bare leading ISO date as the same sub-class', () => {
        expect(trigger_state({ review_trigger: '2026-10-01 — revisit the pin.' }, D('2026-09-14'))).toBe(
            'not-fired',
        );
    });

    // The boundary IS the safety property: a date mentioned inside a semantic
    // condition must not promote that condition to a decided one, or the
    // carve-out becomes the trigger grammar two council seats rejected.
    it('leaves a semantic condition that merely MENTIONS a date indeterminate', () => {
        expect(
            trigger_state(
                { review_trigger: 'Revisit at the 2026-11-10 review date, or earlier on either event.' },
                D('2027-01-01'),
            ),
        ).toBe('indeterminate');
    });

    it('reports a trigger that announces a date it cannot read, rather than degrading it', () => {
        expect(trigger_state({ review_trigger: 'Expiry Q4 2026 — decide then.' }, D('2026-09-14'))).toBe(
            'dated-unparsed',
        );
        expect(trigger_state({ review_trigger: 'Expiry 2026-13-45 — decide then.' }, D('2026-09-14'))).toBe(
            'dated-unparsed',
        );
    });
});

describe('authority_effect: disabled-shadow-mode', () => {
    /**
     * The literal is load-bearing (council ruling): no grade authorizes anything
     * in this change, so the output reports a DISABLED effect rather than
     * asserting a provisional permission that does not exist. These cases plant
     * each axis combination and assert the block fires or does not — a check
     * never seen red has unknown sensitivity.
     */
    it('fires on accepted + E0 — planted here on an agentic record, which the predicate never reads', () => {
        write('docs/decisions/ADR-301-e0.md', adrWithAxes({ num: '301', status: 'accepted', kind: 'agentic', strength: 'E0', discovery: 'incomplete' }));
        const [r] = cite_check(['ADR-301'], root);
        expect(r?.authority_effect).toBe('disabled-shadow-mode');
    });

    it('fires on accepted + E1 — same, provenance is not part of the condition', () => {
        write('docs/decisions/ADR-302-e1.md', adrWithAxes({ num: '302', status: 'accepted', kind: 'agentic', strength: 'E1' }));
        const [r] = cite_check(['ADR-302'], root);
        expect(r?.authority_effect).toBe('disabled-shadow-mode');
    });

    it('does NOT fire on E2 — the grade is where the line sits', () => {
        write('docs/decisions/ADR-303-e2.md', adrWithAxes({ num: '303', status: 'accepted', kind: 'agentic', strength: 'E2' }));
        const [r] = cite_check(['ADR-303'], root);
        expect(r?.evidence_strength).toBe('E2');
        expect(r?.authority_effect).toBeUndefined();
    });

    it('DOES fire on a human E0 with no owner claim — the notice is about evidence, not authorship', () => {
        // This case asserted the OPPOSITE until 2026-08-21. The predicate gated
        // on `provenance.kind === 'agentic'`, which withheld the notice from
        // every thin HUMAN record. Caught in neutral review: the notice states
        // that a record does not by itself establish its alternatives invalid,
        // and that is a claim about EVIDENCE strength — a human snapshot has
        // exactly as little of it. The real exemption is `owner_intent`, tested
        // next; the provenance gate was reaching for that and grabbing a
        // correlate, since most owner-intent records happen to be human-made.
        write('docs/decisions/ADR-306-human-e0.md', adrWithAxes({ num: '306', status: 'accepted', kind: 'human', strength: 'E0', discovery: 'incomplete' }));
        const [r] = cite_check(['ADR-306'], root);
        expect(r?.provenance_kind).toBe('human');
        expect(r?.authority_effect).toBe('disabled-shadow-mode');
    });

    it('does NOT fire on an owner_intent record — its alternatives are foreclosed by ownership, not by evidence', () => {
        write('docs/decisions/ADR-307-owner.md', adrWithAxes({ num: '307', status: 'accepted', kind: 'human', strength: 'E0', discovery: 'complete', basis: 'owner_intent' }));
        const [r] = cite_check(['ADR-307'], root);
        expect(r?.authority_basis).toBe('owner_intent');
        expect(r?.evidence_strength).toBe('E0');
        expect(r?.authority_effect).toBeUndefined();
    });

    it('does NOT fire on a superseded record — it is not a live lock at all', () => {
        write('docs/decisions/ADR-305-dead-e0.md', adrWithAxes({ num: '305', status: 'superseded', kind: 'agentic', strength: 'E0', discovery: 'incomplete' }));
        const [r] = cite_check(['ADR-305'], root);
        expect(r?.verdict).toContain('NOT A LIVE LOCK');
        expect(r?.authority_effect).toBeUndefined();
    });

    it('does NOT fire when the axes are absent — silence is not a grade', () => {
        const [r] = cite_check(['ADR-001'], root);
        expect(r?.authority_effect).toBeUndefined();
    });

    it('prints the block verbatim, and only for the record that carries the effect', () => {
        write('docs/decisions/ADR-306-e0.md', adrWithAxes({ num: '306', status: 'accepted', kind: 'agentic', strength: 'E0', discovery: 'incomplete' }));
        write('docs/decisions/ADR-307-e2.md', adrWithAxes({ num: '307', status: 'accepted', kind: 'agentic', strength: 'E2' }));
        const fired = runCli(root, ['ADR-306']);
        expect(fired.out).toContain(LOW_EVIDENCE_NOTICE);
        expect(fired.out).toContain('does not by itself');
        const quiet = runCli(root, ['ADR-307']);
        expect(quiet.out).not.toContain('disabled-shadow-mode');
    });
});

describe('the reserved-authority reads — evidence.basis, reopen_policy, protected_dimensions', () => {
    /**
     * `decision-revisit-gate` step 2 tells an agent to read a record's basis and
     * its reserved dimensions from this tool. Until 2026-08-21 the tool printed
     * neither: `CiteResult` had no field for `evidence.basis` and `render()`
     * emitted no `reopen_policy` / `protected_dimensions` — so two of the reads
     * the rule delegated here were not performable from here at all.
     */
    const withBasis = {
        num: '401',
        status: 'accepted',
        kind: 'mixed',
        strength: 'E3',
        discovery: 'complete',
        reopenPolicy: 'owner',
        protectedDimensions: ['purpose', 'governance'],
        evidenceBasis: [
            'docs/decisions/ADR-001-precondition-shipped.md',
            'docs/decisions/ADR-999-never-written.md',
            'https://example.invalid/paper (2026-08-21)',
            'claim:some-registered-claim',
        ],
    } as const;

    it('carries evidence.basis verbatim and flags only the repo path that is gone', () => {
        write('docs/decisions/ADR-401-basis.md', adrWithAxes(withBasis));
        const [r] = cite_check(['ADR-401'], root);
        expect(r?.evidence_basis).toEqual([...withBasis.evidenceBasis]);
        // Exactly one entry: the missing repo path. The URL is not fetched and
        // the `claim:` id is not resolved, so neither may appear here.
        expect(r?.evidence_basis_unresolved).toEqual(['docs/decisions/ADR-999-never-written.md']);
    });

    it('prints each basis ref with a found / MISSING / not-checked marker', () => {
        write('docs/decisions/ADR-401-basis.md', adrWithAxes(withBasis));
        const { out } = runCli(root, ['ADR-401']);
        expect(out).toContain('evidence_basis   4 ref(s), 1 unresolved:');
        expect(out).toContain('[found] docs/decisions/ADR-001-precondition-shipped.md');
        expect(out).toContain('[MISSING] docs/decisions/ADR-999-never-written.md');
        expect(out).toContain('[not checked: url] https://example.invalid/paper');
        expect(out).toContain('[not checked: claim] claim:some-registered-claim');
    });

    it('prints the declared reopen_policy and every protected dimension', () => {
        write('docs/decisions/ADR-401-basis.md', adrWithAxes(withBasis));
        const [r] = cite_check(['ADR-401'], root);
        expect(r?.reopen_policy).toBe('owner');
        expect(r?.reopen_policy_defaulted).toBe(false);
        expect(r?.protected_dimensions).toEqual(['purpose', 'governance']);
        const { out } = runCli(root, ['ADR-401']);
        expect(out).toContain('reopen_policy    owner (declared)');
        expect(out).toContain('protected dims   purpose, governance');
    });

    it('resolves an ABSENT reopen_policy to unclassified and says it was defaulted', () => {
        // `adr-layout § Reopen authority`: absent → `unclassified`, never
        // `owner`. Printing a blank would make the reader re-derive a default
        // the contract already fixed; printing `unclassified` unmarked would
        // hide that nobody classified it.
        write('docs/decisions/ADR-402-unclassified.md', adrWithAxes({ num: '402', status: 'accepted', kind: 'human', strength: 'E2' }));
        const [r] = cite_check(['ADR-402'], root);
        expect(r?.reopen_policy).toBe('unclassified');
        expect(r?.reopen_policy_defaulted).toBe(true);
        expect(r?.protected_dimensions).toEqual([]);
        const { out } = runCli(root, ['ADR-402']);
        expect(out).toContain('reopen_policy    unclassified (absent → default)');
        expect(out).toContain('protected dims   — (none declared)');
        expect(out).toContain('evidence_basis   — (none recorded)');
    });

    it('emits all four fields in --json, not only in the human render', () => {
        write('docs/decisions/ADR-401-basis.md', adrWithAxes(withBasis));
        const { out, code } = runCli(root, ['ADR-401', '--json']);
        expect(code).toBe(0);
        const payload = JSON.parse(out) as {
            results: {
                evidence_basis?: string[];
                evidence_basis_unresolved?: string[];
                reopen_policy?: string;
                reopen_policy_defaulted?: boolean;
                protected_dimensions?: string[];
            }[];
        };
        const rec = payload.results[0];
        expect(rec?.evidence_basis).toHaveLength(4);
        expect(rec?.evidence_basis_unresolved).toEqual(['docs/decisions/ADR-999-never-written.md']);
        expect(rec?.reopen_policy).toBe('owner');
        expect(rec?.reopen_policy_defaulted).toBe(false);
        expect(rec?.protected_dimensions).toEqual(['purpose', 'governance']);
    });

    it('classifies a ref shape without fetching or resolving anything', () => {
        expect(basis_ref_kind('https://example.invalid/x')).toBe('url');
        expect(basis_ref_kind('http://example.invalid/x')).toBe('url');
        expect(basis_ref_kind('claim:foo-bar')).toBe('claim');
        expect(basis_ref_kind('docs/decisions/ADR-001-x.md')).toBe('path');
        expect(basis_ref_kind('src/scripts/x.ts:44-51')).toBe('path');
    });

    it('strips a trailing note and a line anchor before the existence check', () => {
        // Both shapes occur in the corpus; neither is part of the filename, and
        // checking the unstripped string would report every one of them missing.
        const found = unresolved_basis_refs(
            [
                'docs/decisions/ADR-001-precondition-shipped.md:12-20',
                'docs/decisions/ADR-001-precondition-shipped.md (2026-08-21)',
            ],
            root,
        );
        expect(found).toEqual([]);
    });
});

describe('cited_refs — the CI corpus', () => {
    it('discovers a citation from every declared root', () => {
        const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-cites-'));
        for (const [i, r] of CITATION_ROOTS.entries()) {
            fs.mkdirSync(path.join(tree, r), { recursive: true });
            fs.writeFileSync(path.join(tree, r, 'f.md'), `See ADR-1${String(i)}0.\n`, 'utf-8');
        }
        const found = cited_refs(tree);
        expect(found).toHaveLength(CITATION_ROOTS.length);
        fs.rmSync(tree, { recursive: true, force: true });
    });

    it('does not discover the template placeholders the corpus really contains', () => {
        const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-cites-'));
        fs.mkdirSync(path.join(tree, 'src', 'rules'), { recursive: true });
        // `ADR-0N` is live in producing-the-review.md; without the boundary
        // guard it is discovered as a citation to `ADR-0` and reds the gate.
        // `ADR-082-410-one-click-relaunch.md` is a live filename reference;
        // without the letter-initial area rule it is discovered as area `082`.
        fs.writeFileSync(
            path.join(tree, 'src', 'rules', 'r.md'),
            'ADR-0N and ADR-NNN and [ADR-082](ADR-082-410-one-click-relaunch.md)\n',
            'utf-8',
        );
        expect(cited_refs(tree)).toEqual(['ADR-082']);
        fs.rmSync(tree, { recursive: true, force: true });
    });
});

describe('the CI gate — exit codes and the scanned: line', () => {
    /** A minimal tree: one ADR, one citing rule. */
    function corpus(citation: string | null): string {
        const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-gate-'));
        fs.mkdirSync(path.join(tree, 'docs', 'decisions'), { recursive: true });
        fs.mkdirSync(path.join(tree, 'src', 'rules'), { recursive: true });
        fs.writeFileSync(
            path.join(tree, 'docs', 'decisions', 'ADR-001-probe.md'),
            '---\nstatus: accepted\ndate: 2026-08-21\ndecision: probe\n---\n\nBody.\n',
            'utf-8',
        );
        fs.writeFileSync(
            path.join(tree, 'src', 'rules', 'r.md'),
            citation === null ? 'No decision is named here.\n' : `See ${citation}.\n`,
            'utf-8',
        );
        return tree;
    }

    it('emits the machine-readable count exactly once, and only that line matches', () => {
        const tree = corpus('ADR-001');
        const { out, code } = runCli(tree, ['--cited']);
        const hits = out.split('\n').filter((l) => /^scanned: \d+$/.test(l));
        expect(hits).toEqual(['scanned: 1']);
        expect(code).toBe(0);
        fs.rmSync(tree, { recursive: true, force: true });
    });

    it('exits 0 when every citation resolves', () => {
        const tree = corpus('ADR-001');
        expect(runCli(tree, ['--cited']).code).toBe(0);
        fs.rmSync(tree, { recursive: true, force: true });
    });

    it('exits non-zero on an unresolvable citation — the condition the gate fails on', () => {
        const tree = corpus('ADR-993');
        const { code, out } = runCli(tree, ['--cited']);
        expect(code).not.toBe(0);
        expect(out).toContain('UNRESOLVED');
        fs.rmSync(tree, { recursive: true, force: true });
    });

    it('exits non-zero rather than green when the citation roots name no ADR at all', () => {
        // The dead-scan-root shape: a moved or emptied citation root must not
        // present as a clean run over nothing.
        const tree = corpus(null);
        const { code, out } = runCli(tree, ['--cited']);
        expect(code).not.toBe(0);
        expect(out).toContain('scan scope is');
        fs.rmSync(tree, { recursive: true, force: true });
    });

    it('carries the ledger tally in --json instead of printing it beside the payload', () => {
        const tree = corpus('ADR-001');
        const { out, code } = runCli(tree, ['--cited', '--json']);
        expect(code).toBe(0);
        expect(out).not.toContain('scanned: ');
        const payload = JSON.parse(out) as { ledger?: { planned: number; failed: number } };
        expect(payload.ledger?.planned).toBe(1);
        expect(payload.ledger?.failed).toBe(0);
        fs.rmSync(tree, { recursive: true, force: true });
    });

    it('still emits the partial_coverage key in --json, now empty, so a consumer does not break', () => {
        // Removing the KEY would be a breaking change to this published shape;
        // removing the dead ENTRY is not. This pins the distinction.
        const tree = corpus('ADR-001');
        const { out, code } = runCli(tree, ['--cited', '--json']);
        expect(code).toBe(0);
        const payload = JSON.parse(out) as Record<string, unknown>;
        expect(Object.keys(payload)).toContain('partial_coverage');
        expect(payload.partial_coverage).toEqual([]);
        fs.rmSync(tree, { recursive: true, force: true });
    });

    it('still refuses a bare call with no refs and no --cited', () => {
        expect(runCli(root, []).code).toBe(2);
    });

    it('delivers a large --json payload whole through a pipe, not the first 64 KB', () => {
        // A real defect on this branch, not a hypothetical: `process.exit()`
        // tore the process down before Node flushed an async stdout, so the
        // 167 KB real-corpus payload arrived at a parser as exactly 65,536
        // bytes. `runCli` reads through a pipe, so this case can see it; the
        // one-record case above cannot, which is why it is separate.
        const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-big-'));
        fs.mkdirSync(path.join(tree, 'docs', 'decisions'), { recursive: true });
        fs.mkdirSync(path.join(tree, 'src', 'rules'), { recursive: true });
        const padding = 'x'.repeat(400);
        const refs: string[] = [];
        for (let i = 1; i <= 200; i += 1) {
            const num = String(i).padStart(3, '0');
            refs.push(`ADR-${num}`);
            fs.writeFileSync(
                path.join(tree, 'docs', 'decisions', `ADR-${num}-probe.md`),
                `---\nstatus: accepted\ndate: 2026-08-21\ndecision: probe-${num}\nreview_trigger: >-\n  ${padding}\n---\n\nBody.\n`,
                'utf-8',
            );
        }
        fs.writeFileSync(path.join(tree, 'src', 'rules', 'r.md'), `${refs.join(' ')}\n`, 'utf-8');

        const { out, code } = runCli(tree, ['--cited', '--json']);
        expect(code).toBe(0);
        expect(out.length).toBeGreaterThan(65536);
        const payload = JSON.parse(out) as { results: unknown[] };
        expect(payload.results).toHaveLength(200);
        fs.rmSync(tree, { recursive: true, force: true });
    });
});

// `road-to-decision-conformance` Phase 2 — the corpus survey.
//
// A NEAR MISS WORTH PINNING. The first implementation keyed the citation join on
// a private `/ADR-(\d+)/` regex on one side and `normalise_ref()` on the other.
// It typechecked-failed but ran, the join produced an empty set, and the report
// read "0 of 160 accepted ADRs are cited outside docs/decisions/ — 100.0 %
// uncited". That is a plausible, alarming, entirely fabricated number, and
// nothing about the output said it was wrong. Both sides now derive the id from
// `normalise_ref`, and this suite is what would catch the drift returning.
describe('adr corpus survey — one row per record', () => {
    it('surveys every decision record and the counts close', () => {
        const rows = corpus_survey();
        const sum = corpus_summary(rows);
        expect(rows.length).toBeGreaterThan(150);
        expect(sum.total).toBe(rows.length);
        // Every row lands in exactly one status bucket.
        const statusSum = Object.values(sum.by_status).reduce((a, b) => a + b, 0);
        expect(statusSum).toBe(sum.total);
    });

    it('THE 2.2 VERIFY: the three trigger states sum to the carrying count', () => {
        const sum = corpus_summary(corpus_survey());
        const three = TRIGGER_VERDICTS.reduce((a, k) => a + (sum.trigger_counts[k] ?? 0), 0);
        expect(three).toBe(sum.with_trigger);
        // `none` is deliberately NOT one of the three — a record with no trigger
        // is outside the denominator, not a fourth bucket inside it.
        expect(TRIGGER_VERDICTS).not.toContain('none');
    });

    it('the citation join is NOT empty — the near-miss regression', () => {
        const sum = corpus_summary(corpus_survey());
        expect(sum.accepted).toBeGreaterThan(100);
        // The broken join made this 0. A real corpus cites most of its accepted
        // decisions somewhere outside the decision directory.
        expect(sum.accepted_cited_outside).toBeGreaterThan(50);
        expect(sum.uncited_pct).toBeLessThan(60);
    });

    it('every row carries a status and a reopen_policy, defaulted not blank', () => {
        for (const r of corpus_survey()) {
            expect(r.status, `${r.file} has no status`).not.toBe('');
            expect(r.reopen_policy, `${r.file} has a blank reopen_policy`).not.toBe('');
        }
    });

    it('has_trigger and the trigger verdict agree', () => {
        for (const r of corpus_survey()) {
            if (r.has_trigger) {
                expect(TRIGGER_VERDICTS as readonly string[], r.file).toContain(r.trigger);
            } else {
                expect(r.trigger, r.file).toBe('none');
            }
        }
    });
});
